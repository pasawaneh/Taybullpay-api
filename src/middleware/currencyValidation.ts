import { Request, Response, NextFunction } from 'express';

const SUPPORTED_CURRENCY = 'GMD';

export function validateCurrency(req: Request, res: Response, next: NextFunction): void {
  const currency = req.body?.currency;

  if (currency && currency !== SUPPORTED_CURRENCY) {
    res.status(400).json({
      error: 'CURRENCY_MISMATCH',
      message: `Only ${SUPPORTED_CURRENCY} currency is supported, got: ${currency}`,
    });
    return;
  }

  next();
}
