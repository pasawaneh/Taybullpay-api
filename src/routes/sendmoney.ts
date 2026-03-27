import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../db/connection';
import * as accountRepo from '../repositories/accountRepository';
import * as quoteRepo from '../repositories/quoteRepository';
import { idempotency } from '../middleware/idempotency';
import logger from '../services/logger';

const router = Router();

const FEE_PERCENTAGE = 0.01;
const COMMISSION_PERCENTAGE = 0.005;

// POST /api/send-money - Full P2P transfer in one call
router.post('/', idempotency, async (req: Request, res: Response, next: NextFunction) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const {
      payerId,
      payeeId,
      amount,
      currency,
      note,
    } = req.body;

    // Validate required fields
    if (!payerId || !payeeId || !amount) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'payerId, payeeId, and amount are required',
      });
      return;
    }

    if (currency && currency !== 'GMD') {
      res.status(400).json({ error: 'CURRENCY_MISMATCH', message: 'Only GMD currency is supported' });
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      res.status(400).json({ error: 'INVALID_AMOUNT', message: 'Amount must be a positive number' });
      return;
    }

    await client.query('BEGIN');

    // 1. Look up payer
    const { rows: [payerRow] } = await client.query(
      'SELECT * FROM accounts WHERE account_id = $1 FOR UPDATE',
      [payerId],
    );

    if (!payerRow) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'PAYER_NOT_FOUND', message: `Payer account ${payerId} not found` });
      return;
    }

    if (payerRow.status !== 'ACTIVE') {
      await client.query('ROLLBACK');
      res.status(403).json({ error: 'PAYER_BLOCKED', message: `Payer account ${payerId} is ${payerRow.status}` });
      return;
    }

    // 2. Look up payee
    const { rows: [payeeRow] } = await client.query(
      'SELECT * FROM accounts WHERE account_id = $1 FOR UPDATE',
      [payeeId],
    );

    if (!payeeRow) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'PAYEE_NOT_FOUND', message: `Payee account ${payeeId} not found` });
      return;
    }

    if (payeeRow.status !== 'ACTIVE') {
      await client.query('ROLLBACK');
      res.status(403).json({ error: 'PAYEE_BLOCKED', message: `Payee account ${payeeId} is ${payeeRow.status}` });
      return;
    }

    // 3. Calculate fees
    const feeAmount = Math.round(numericAmount * FEE_PERCENTAGE * 100) / 100;
    const commissionAmount = Math.round(numericAmount * COMMISSION_PERCENTAGE * 100) / 100;
    const totalDebit = numericAmount + feeAmount;

    if (parseFloat(payerRow.balance) < totalDebit) {
      await client.query('ROLLBACK');
      res.status(400).json({
        error: 'INSUFFICIENT_FUNDS',
        message: `Insufficient balance. Available: ${payerRow.balance} GMD, Required: ${totalDebit} GMD (${numericAmount} + ${feeAmount} fee)`,
      });
      return;
    }

    // 4. Save quote
    const quoteId = uuidv4();
    await client.query(
      `INSERT INTO quotes (id, quote_id, payer_account_id, payee_account_id, amount, currency, fee_amount, commission_amount, transfer_amount, expiration, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'USED')`,
      [uuidv4(), quoteId, payerId, payeeId, numericAmount, 'GMD', feeAmount, commissionAmount, numericAmount, new Date(Date.now() + 30 * 60 * 1000).toISOString()],
    );

    // 5. Debit payer (amount + fee)
    await client.query(
      'UPDATE accounts SET balance = balance - $1, updated_at = NOW() WHERE account_id = $2',
      [totalDebit, payerId],
    );

    // 6. Credit payee
    await client.query(
      'UPDATE accounts SET balance = balance + $1, updated_at = NOW() WHERE account_id = $2',
      [numericAmount, payeeId],
    );

    // 7. Create transfer record (directly COMMITTED)
    const transferId = uuidv4();
    const homeTransactionId = `TBP-${Date.now()}`;

    await client.query(
      `INSERT INTO transfers (id, transfer_id, from_account_id, to_account_id, amount, currency, status, home_transaction_id, note)
       VALUES ($1, $2, $3, $4, $5, $6, 'COMMITTED', $7, $8)`,
      [uuidv4(), transferId, payerId, payeeId, numericAmount, 'GMD', homeTransactionId, note || null],
    );

    await client.query('COMMIT');

    // Get updated balances
    const payerBalance = await accountRepo.getBalance(payerId);
    const payeeBalance = await accountRepo.getBalance(payeeId);

    logger.info(`Send money: ${payerId} -> ${payeeId} : ${numericAmount} GMD (fee: ${feeAmount})`);

    res.status(200).json({
      status: 'COMPLETED',
      transferId,
      homeTransactionId,
      quoteId,
      payer: {
        accountId: payerId,
        name: `${payerRow.first_name} ${payerRow.last_name}`,
        balanceBefore: parseFloat(payerRow.balance),
        balanceAfter: payerBalance,
      },
      payee: {
        accountId: payeeId,
        name: `${payeeRow.first_name} ${payeeRow.last_name}`,
        balanceBefore: parseFloat(payeeRow.balance),
        balanceAfter: payeeBalance,
      },
      amount: numericAmount.toFixed(2),
      fee: feeAmount.toFixed(2),
      totalDebited: totalDebit.toFixed(2),
      currency: 'GMD',
      note: note || null,
      completedAt: new Date().toISOString(),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

export default router;
