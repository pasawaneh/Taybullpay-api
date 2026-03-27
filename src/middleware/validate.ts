import { Request, Response, NextFunction } from 'express';

interface FieldRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean';
  enum?: string[];
  isAmount?: boolean;
}

type Schema = Record<string, FieldRule>;

export function validate(schema: Schema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];
    const body = req.body || {};

    for (const [field, rule] of Object.entries(schema)) {
      const value = body[field];

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value === undefined || value === null) continue;

      if (rule.type && typeof value !== rule.type) {
        errors.push(`${field} must be of type ${rule.type}`);
        continue;
      }

      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`${field} must be one of: ${rule.enum.join(', ')}`);
      }

      if (rule.isAmount) {
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) {
          errors.push(`${field} must be a positive number`);
        } else {
          const parts = String(value).split('.');
          if (parts[1] && parts[1].length > 2) {
            errors.push(`${field} must have at most 2 decimal places (GMD precision)`);
          }
        }
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid request', details: errors });
      return;
    }

    next();
  };
}

export const validateCreateAccount = validate({
  accountId: { required: true, type: 'string' },
  firstName: { required: true, type: 'string' },
  lastName: { required: true, type: 'string' },
  displayName: { required: true, type: 'string' },
  dateOfBirth: { required: true, type: 'string' },
  type: { required: true, type: 'string', enum: ['CONSUMER', 'AGENT', 'BUSINESS'] },
  currency: { required: true, type: 'string' },
});

export const validateUpdateAccount = validate({
  firstName: { type: 'string' },
  lastName: { type: 'string' },
  middleName: { type: 'string' },
  displayName: { type: 'string' },
  dateOfBirth: { type: 'string' },
  type: { type: 'string', enum: ['CONSUMER', 'AGENT', 'BUSINESS'] },
  status: { type: 'string', enum: ['ACTIVE', 'BLOCKED', 'CLOSED'] },
});

export const validateQuoteRequest = validate({
  amount: { required: true, isAmount: true },
  currency: { required: true, type: 'string' },
});

export const validateReserveTransfer = validate({
  fromAccountId: { required: true, type: 'string' },
  amount: { required: true, isAmount: true },
  currency: { required: true, type: 'string' },
});
