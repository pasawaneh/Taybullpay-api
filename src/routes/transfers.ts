import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../db/connection';
import * as transferRepo from '../repositories/transferRepository';
import * as accountRepo from '../repositories/accountRepository';
import * as refundRepo from '../repositories/refundRepository';
import { validateReserveTransfer } from '../middleware/validate';
import { validateCurrency } from '../middleware/currencyValidation';
import { idempotency } from '../middleware/idempotency';
import logger from '../services/logger';

const router = Router();

// GET /transfers - List transfers for an account (paginated)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.query.accountId as string;
    if (!accountId) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'accountId query parameter is required' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    const { transfers, total } = await transferRepo.findByAccountId(accountId, { limit, offset, status });

    res.json({
      transfers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// POST /transfers/reserve - Reserve funds
router.post('/reserve', idempotency, validateReserveTransfer, validateCurrency, async (req: Request, res: Response, next: NextFunction) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { fromAccountId, toAccountId, amount, currency, transferId, note } = req.body;
    const numericAmount = parseFloat(amount);

    await client.query('BEGIN');

    // Lock the account row for update
    const { rows: [accountRow] } = await client.query(
      'SELECT * FROM accounts WHERE account_id = $1 FOR UPDATE',
      [fromAccountId],
    );

    if (!accountRow) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'PAYER_NOT_FOUND' });
      return;
    }

    if (accountRow.status !== 'ACTIVE') {
      await client.query('ROLLBACK');
      res.status(403).json({ error: 'ACCOUNT_BARRED', message: `Account ${fromAccountId} is not active` });
      return;
    }

    if (parseFloat(accountRow.balance) < numericAmount) {
      await client.query('ROLLBACK');
      res.status(400).json({
        error: 'INSUFFICIENT_FUNDS',
        message: `Insufficient balance. Available: ${accountRow.balance}, Required: ${numericAmount}`,
      });
      return;
    }

    // Debit payer
    await client.query(
      'UPDATE accounts SET balance = balance - $1, updated_at = NOW() WHERE account_id = $2',
      [numericAmount, fromAccountId],
    );

    const homeTransactionId = `TBP-${Date.now()}`;
    const tid = transferId || uuidv4();

    await client.query(
      `INSERT INTO transfers (id, transfer_id, from_account_id, to_account_id, amount, currency, status, home_transaction_id, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [uuidv4(), tid, fromAccountId, toAccountId || '', numericAmount, currency, 'RESERVED', homeTransactionId, note || null],
    );

    await client.query('COMMIT');

    logger.info(`Funds reserved: ${tid} (${numericAmount} ${currency}) from ${fromAccountId}`);

    res.status(201).json({
      transferId: tid,
      homeTransactionId,
      transferState: 'RESERVED',
      amount: numericAmount.toFixed(2),
      currency,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PUT /transfers/:transferId/commit - Commit reserved funds
router.put('/:transferId/commit', async (req: Request, res: Response, next: NextFunction) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const transferId = req.params.transferId as string;

    await client.query('BEGIN');

    const { rows: [transferRow] } = await client.query(
      'SELECT * FROM transfers WHERE transfer_id = $1 FOR UPDATE',
      [transferId],
    );

    if (!transferRow) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'TRANSFER_NOT_FOUND' });
      return;
    }

    if (transferRow.status !== 'RESERVED') {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: 'INVALID_TRANSFER_STATE',
        message: `Transfer is in ${transferRow.status} state, expected RESERVED`,
      });
      return;
    }

    // Credit payee if in our system
    if (transferRow.to_account_id) {
      await client.query(
        'UPDATE accounts SET balance = balance + $1, updated_at = NOW() WHERE account_id = $2',
        [transferRow.amount, transferRow.to_account_id],
      );
    }

    await client.query(
      `UPDATE transfers SET status = 'COMMITTED', updated_at = NOW() WHERE transfer_id = $1`,
      [transferId],
    );

    await client.query('COMMIT');

    logger.info(`Transfer committed: ${transferId}`);

    res.json({
      transferId,
      homeTransactionId: transferRow.home_transaction_id,
      transferState: 'COMMITTED',
      completedTimestamp: new Date().toISOString(),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PUT /transfers/:transferId/cancel - Release reserved funds
router.put('/:transferId/cancel', async (req: Request, res: Response, next: NextFunction) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const transferId = req.params.transferId as string;

    await client.query('BEGIN');

    const { rows: [transferRow] } = await client.query(
      'SELECT * FROM transfers WHERE transfer_id = $1 FOR UPDATE',
      [transferId],
    );

    if (!transferRow) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'TRANSFER_NOT_FOUND' });
      return;
    }

    if (transferRow.status !== 'RESERVED') {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: 'INVALID_TRANSFER_STATE',
        message: `Transfer is in ${transferRow.status} state, expected RESERVED`,
      });
      return;
    }

    // Return funds to payer
    await client.query(
      'UPDATE accounts SET balance = balance + $1, updated_at = NOW() WHERE account_id = $2',
      [transferRow.amount, transferRow.from_account_id],
    );

    await client.query(
      `UPDATE transfers SET status = 'CANCELLED', updated_at = NOW() WHERE transfer_id = $1`,
      [transferId],
    );

    await client.query('COMMIT');

    logger.info(`Transfer cancelled: ${transferId}`);

    res.json({ transferId, transferState: 'CANCELLED' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /transfers/:transferId/refund - Refund a committed transfer
router.post('/:transferId/refund', idempotency, async (req: Request, res: Response, next: NextFunction) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const transferId = req.params.transferId as string;
    const { reason } = req.body;

    await client.query('BEGIN');

    const { rows: [transferRow] } = await client.query(
      'SELECT * FROM transfers WHERE transfer_id = $1 FOR UPDATE',
      [transferId],
    );

    if (!transferRow) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'TRANSFER_NOT_FOUND' });
      return;
    }

    if (transferRow.status !== 'COMMITTED') {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: 'INVALID_TRANSFER_STATE',
        message: `Transfer is in ${transferRow.status} state, expected COMMITTED for refund`,
      });
      return;
    }

    // Reverse: debit payee, credit payer
    if (transferRow.to_account_id) {
      await client.query(
        'UPDATE accounts SET balance = balance - $1, updated_at = NOW() WHERE account_id = $2',
        [transferRow.amount, transferRow.to_account_id],
      );
    }

    await client.query(
      'UPDATE accounts SET balance = balance + $1, updated_at = NOW() WHERE account_id = $2',
      [transferRow.amount, transferRow.from_account_id],
    );

    await client.query(
      `UPDATE transfers SET status = 'REFUNDED', updated_at = NOW() WHERE transfer_id = $1`,
      [transferId],
    );

    const refundId = uuidv4();
    await client.query(
      `INSERT INTO refunds (id, original_transfer_id, amount, currency, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'COMPLETED')`,
      [refundId, transferId, transferRow.amount, transferRow.currency, reason || 'Transfer failed'],
    );

    await client.query('COMMIT');

    logger.info(`Transfer refunded: ${transferId}`);

    res.json({
      refundId,
      originalTransferId: transferId,
      transferState: 'REFUNDED',
      amount: parseFloat(transferRow.amount).toFixed(2),
      currency: transferRow.currency,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// GET /transfers/:transferId - Get transfer status
router.get('/:transferId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transfer = await transferRepo.findByTransferId(req.params.transferId as string);

    if (!transfer) {
      res.status(404).json({ error: 'TRANSFER_NOT_FOUND' });
      return;
    }

    res.json(transfer);
  } catch (err) {
    next(err);
  }
});

export default router;
