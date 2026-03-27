import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as quoteRepo from '../repositories/quoteRepository';
import * as accountRepo from '../repositories/accountRepository';
import { validateQuoteRequest } from '../middleware/validate';
import { validateCurrency } from '../middleware/currencyValidation';
import { idempotency } from '../middleware/idempotency';
import * as settingsRepo from '../repositories/settingsRepository';
import logger from '../services/logger';

const router = Router();

// POST /quotes - Create a quote
router.post('/', idempotency, validateQuoteRequest, validateCurrency, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { payerAccountId, payeeAccountId, amount, currency } = req.body;

    const numericAmount = parseFloat(amount);

    if (payeeAccountId) {
      const payeeAccount = await accountRepo.findByAccountId(payeeAccountId);
      if (!payeeAccount) {
        res.status(404).json({ error: 'PAYEE_NOT_FOUND', message: `Payee account ${payeeAccountId} not found` });
        return;
      }
    }

    const feePercentage = await settingsRepo.getNumber('FEE_PERCENTAGE', 0.01);
    const commissionPercentage = await settingsRepo.getNumber('COMMISSION_PERCENTAGE', 0.005);
    const feeAmount = Math.round(numericAmount * feePercentage * 100) / 100;
    const commissionAmount = Math.round(numericAmount * commissionPercentage * 100) / 100;
    const transferAmount = numericAmount;
    const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const quote = await quoteRepo.save({
      id: uuidv4(),
      quoteId: uuidv4(),
      payerAccountId: payerAccountId || '',
      payeeAccountId: payeeAccountId || '',
      amount: numericAmount,
      currency,
      feeAmount,
      commissionAmount,
      transferAmount,
      expiration,
      status: 'ACTIVE',
    });

    logger.info(`Quote created: ${quote.quoteId}`);

    res.status(201).json({
      quoteId: quote.quoteId,
      transferAmount: transferAmount.toFixed(2),
      transferAmountCurrency: currency,
      feeAmount: feeAmount.toFixed(2),
      feeCurrency: currency,
      commissionAmount: commissionAmount.toFixed(2),
      commissionCurrency: currency,
      expiration: quote.expiration,
    });
  } catch (err) {
    next(err);
  }
});

// GET /quotes/:quoteId
router.get('/:quoteId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quote = await quoteRepo.findByQuoteId(req.params.quoteId as string);

    if (!quote) {
      res.status(404).json({ error: 'QUOTE_NOT_FOUND' });
      return;
    }

    if (new Date(quote.expiration) < new Date()) {
      await quoteRepo.updateStatus(quote.quoteId, 'EXPIRED');
      res.status(410).json({ error: 'QUOTE_EXPIRED' });
      return;
    }

    res.json({
      quoteId: quote.quoteId,
      transferAmount: quote.transferAmount.toFixed(2),
      transferAmountCurrency: quote.currency,
      feeAmount: quote.feeAmount.toFixed(2),
      feeCurrency: quote.currency,
      commissionAmount: quote.commissionAmount.toFixed(2),
      commissionCurrency: quote.currency,
      expiration: quote.expiration,
      status: quote.status,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
