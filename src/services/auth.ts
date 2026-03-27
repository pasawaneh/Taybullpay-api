import { Request, Response, NextFunction } from 'express';
import logger from './logger';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;
  const apiSecret = req.headers['x-api-secret'] as string;

  const expectedKey = process.env.API_KEY || 'test-key';
  const expectedSecret = process.env.API_SECRET || 'test-secret';

  if (!apiKey || !apiSecret) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing API credentials' });
    return;
  }

  if (apiKey !== expectedKey || apiSecret !== expectedSecret) {
    logger.warn(`Invalid API credentials from ${req.ip}`);
    res.status(403).json({ error: 'FORBIDDEN', message: 'Invalid API credentials' });
    return;
  }

  next();
}
