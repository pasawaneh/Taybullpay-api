import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as accountRepo from '../repositories/accountRepository';
import { validateCreateAccount, validateUpdateAccount } from '../middleware/validate';
import { validateCurrency } from '../middleware/currencyValidation';
import { idempotency } from '../middleware/idempotency';
import logger from '../services/logger';

const router = Router();

// GET /accounts - List all accounts (paginated)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    const { accounts, total } = await accountRepo.findAll({ limit, offset, status });

    res.json({
      accounts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /accounts/:accountId - Lookup account/KYC info
router.get('/:accountId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.params.accountId as string;
    const account = await accountRepo.findByAccountId(accountId);

    if (!account) {
      res.status(404).json({ error: 'ACCOUNT_NOT_FOUND', message: `Account ${accountId} not found` });
      return;
    }

    if (account.status === 'BLOCKED') {
      res.status(403).json({ error: 'ACCOUNT_BARRED', message: `Account ${accountId} is blocked` });
      return;
    }

    if (account.status === 'CLOSED') {
      res.status(410).json({ error: 'ACCOUNT_CLOSED', message: `Account ${accountId} is closed` });
      return;
    }

    res.json({
      accountId: account.accountId,
      idType: account.idType,
      firstName: account.firstName,
      lastName: account.lastName,
      middleName: account.middleName,
      displayName: account.displayName,
      dateOfBirth: account.dateOfBirth,
      type: account.type,
      currency: account.currency,
      kycVerified: account.kycVerified,
    });
  } catch (err) {
    next(err);
  }
});

// GET /accounts/:accountId/balance
router.get('/:accountId/balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.params.accountId as string;
    const account = await accountRepo.findByAccountId(accountId);

    if (!account) {
      res.status(404).json({ error: 'ACCOUNT_NOT_FOUND' });
      return;
    }

    res.json({
      accountId: account.accountId,
      balance: account.balance,
      currency: account.currency,
    });
  } catch (err) {
    next(err);
  }
});

// POST /accounts - Create a new account
router.post('/', idempotency, validateCreateAccount, validateCurrency, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, idType, firstName, lastName, middleName, displayName, dateOfBirth, type, currency } = req.body;

    const existing = await accountRepo.findByAccountId(accountId);
    if (existing) {
      res.status(409).json({ error: 'ACCOUNT_EXISTS', message: `Account ${accountId} already exists` });
      return;
    }

    const account = await accountRepo.create({
      id: uuidv4(),
      accountId,
      idType: idType || 'MSISDN',
      firstName,
      lastName,
      middleName: middleName || '',
      displayName,
      dateOfBirth,
      type,
      currency,
      balance: 0,
      kycVerified: false,
      status: 'ACTIVE',
    });

    logger.info(`Account created: ${accountId}`);
    res.status(201).json(account);
  } catch (err) {
    next(err);
  }
});

// PUT /accounts/:accountId - Update account
router.put('/:accountId', validateUpdateAccount, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.params.accountId as string;
    const updated = await accountRepo.update(accountId, req.body);

    if (!updated) {
      res.status(404).json({ error: 'ACCOUNT_NOT_FOUND', message: `Account ${accountId} not found` });
      return;
    }

    logger.info(`Account updated: ${accountId}`);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /accounts/:accountId - Soft delete (close) account
router.delete('/:accountId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.params.accountId as string;
    const closed = await accountRepo.softDelete(accountId);

    if (!closed) {
      res.status(404).json({ error: 'ACCOUNT_NOT_FOUND', message: `Account ${accountId} not found or already closed` });
      return;
    }

    logger.info(`Account closed: ${accountId}`);
    res.json({ accountId, status: 'CLOSED' });
  } catch (err) {
    next(err);
  }
});

export default router;
