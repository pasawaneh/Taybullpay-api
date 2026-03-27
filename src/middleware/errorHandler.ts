import { Request, Response, NextFunction } from 'express';
import logger from '../services/logger';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });

  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
  });
}
