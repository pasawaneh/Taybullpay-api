import 'dotenv/config';
import { createApp } from './app';
import { runMigrations } from './db/migrate';
import { seed } from './db/seed';
import { closePool } from './db/connection';
import logger from './services/logger';

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  // Run migrations and seed
  await runMigrations();
  await seed();

  const app = createApp();

  const server = app.listen(PORT, HOST, () => {
    logger.info(`Taybullpay API running at http://${HOST}:${PORT}`);
    logger.info('Endpoints:');
    logger.info('  GET    /health');
    logger.info('  GET    /api/accounts');
    logger.info('  GET    /api/accounts/:accountId');
    logger.info('  GET    /api/accounts/:accountId/balance');
    logger.info('  POST   /api/accounts');
    logger.info('  PUT    /api/accounts/:accountId');
    logger.info('  DELETE /api/accounts/:accountId');
    logger.info('  POST   /api/quotes');
    logger.info('  GET    /api/quotes/:quoteId');
    logger.info('  GET    /api/transfers?accountId=X');
    logger.info('  POST   /api/transfers/reserve');
    logger.info('  PUT    /api/transfers/:transferId/commit');
    logger.info('  PUT    /api/transfers/:transferId/cancel');
    logger.info('  POST   /api/transfers/:transferId/refund');
    logger.info('  GET    /api/transfers/:transferId');
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.warn(`${signal} received - shutting down`);
    server.close(async () => {
      await closePool();
      logger.info('Server stopped');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Shutdown timed out - forcing exit');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', err);
    process.exit(1);
  });
}

start().catch((err) => {
  logger.error('Failed to start', err);
  process.exit(1);
});
