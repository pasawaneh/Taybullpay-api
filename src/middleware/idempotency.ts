import { Request, Response, NextFunction } from 'express';
import * as idempotencyRepo from '../repositories/idempotencyRepository';
import logger from '../services/logger';

export function idempotency(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-idempotency-key'] as string | undefined;

  if (!key) {
    next();
    return;
  }

  const endpoint = `${req.method} ${req.baseUrl}${req.path}`;

  idempotencyRepo
    .find(key, endpoint)
    .then((cached) => {
      if (cached) {
        logger.info(`Idempotency cache hit: ${key} on ${endpoint}`);
        res.status(cached.responseStatus).json(JSON.parse(cached.responseBody));
        return;
      }

      // Override res.json to capture the response
      const originalJson = res.json.bind(res);
      res.json = function (body: any) {
        idempotencyRepo
          .save(key, endpoint, res.statusCode, JSON.stringify(body))
          .catch((err) => logger.error('Failed to save idempotency key', err));
        return originalJson(body);
      };

      next();
    })
    .catch((err) => {
      logger.error('Idempotency check failed', err);
      next();
    });
}
