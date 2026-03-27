import express from 'express';
import { authenticate } from './services/auth';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import accountsRouter from './routes/accounts';
import quotesRouter from './routes/quotes';
import transfersRouter from './routes/transfers';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(rateLimiter);

  // Health check (no auth)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'taybullpay-api', timestamp: new Date().toISOString() });
  });

  // API routes (auth required)
  app.use('/api/accounts', authenticate, accountsRouter);
  app.use('/api/quotes', authenticate, quotesRouter);
  app.use('/api/transfers', authenticate, transfersRouter);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}
