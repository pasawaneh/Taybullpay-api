import express from 'express';
import path from 'path';
import http from 'http';
import { authenticate } from './services/auth';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import accountsRouter from './routes/accounts';
import quotesRouter from './routes/quotes';
import transfersRouter from './routes/transfers';
import sendmoneyRouter from './routes/sendmoney';
import logger from './services/logger';

const CONNECTOR_SDK_URL = process.env.CONNECTOR_SDK_URL || 'http://localhost:3003';
const CONNECTOR_DFSP_URL = process.env.CONNECTOR_DFSP_URL || 'http://localhost:3004';

function proxyRequest(targetBase: string) {
  return (req: express.Request, res: express.Response) => {
    const url = new URL(req.url, targetBase);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.status(proxyRes.statusCode || 500);
      let body = '';
      proxyRes.on('data', (chunk) => body += chunk);
      proxyRes.on('end', () => {
        try { res.json(JSON.parse(body)); } catch { res.send(body); }
      });
    });

    proxyReq.on('error', (err) => {
      logger.error(`Proxy error to ${targetBase}`, err);
      res.status(502).json({ error: 'CONNECTOR_UNAVAILABLE', message: `Cannot reach connector at ${targetBase}` });
    });

    if (req.body && Object.keys(req.body).length > 0) {
      proxyReq.write(JSON.stringify(req.body));
    }
    proxyReq.end();
  };
}

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(rateLimiter);

  // Serve test console UI
  app.use(express.static(path.join(__dirname, 'public')));

  // Health check (no auth)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'taybullpay-api', timestamp: new Date().toISOString() });
  });

  // Proxy routes to Gisp connector (no CORS issues)
  app.use('/proxy/connector', (req, res) => {
    proxyRequest(CONNECTOR_SDK_URL)(req, res);
  });
  app.use('/proxy/dfsp', (req, res) => {
    // For send-money, debit payer after successful Mojaloop transfer
    if (req.method === 'POST' && req.url === '/send-money') {
      const payerId = req.body?.payer?.payerId;
      const amount = parseFloat(req.body?.sendAmount || '0');
      const url = new URL(req.url, CONNECTOR_DFSP_URL);
      const options: http.RequestOptions = {
        hostname: url.hostname, port: url.port, path: url.pathname,
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      };
      const proxyReq = http.request(options, (proxyRes) => {
        let body = '';
        proxyRes.on('data', (chunk) => body += chunk);
        proxyRes.on('end', async () => {
          try {
            const data = JSON.parse(body);
            // If transfer completed, debit payer in CBS
            if (proxyRes.statusCode === 200 && payerId && amount > 0) {
              const { getPool } = require('./db/connection');
              const pool = getPool();
              const fee = Math.round(amount * 0.01 * 100) / 100;
              const totalDebit = amount + fee;
              const balBefore = await pool.query('SELECT balance FROM accounts WHERE account_id = $1', [payerId]);
              await pool.query('UPDATE accounts SET balance = balance - $1, updated_at = NOW() WHERE account_id = $2', [totalDebit, payerId]);
              const balAfter = await pool.query('SELECT balance FROM accounts WHERE account_id = $1', [payerId]);
              data.payerDebit = {
                accountId: payerId,
                amount: amount.toFixed(2),
                fee: fee.toFixed(2),
                totalDebited: totalDebit.toFixed(2),
                balanceBefore: parseFloat(balBefore.rows[0]?.balance || 0),
                balanceAfter: parseFloat(balAfter.rows[0]?.balance || 0),
                currency: 'GMD',
              };
              logger.info(`Mojaloop send-money: debited ${payerId} by ${totalDebit} GMD`);
            }
            res.status(proxyRes.statusCode || 200).json(data);
          } catch (e) {
            res.status(proxyRes.statusCode || 500).send(body);
          }
        });
      });
      proxyReq.on('error', (err) => {
        res.status(502).json({ error: 'CONNECTOR_UNAVAILABLE', message: `Cannot reach connector at ${CONNECTOR_DFSP_URL}` });
      });
      proxyReq.write(JSON.stringify(req.body));
      proxyReq.end();
      return;
    }
    proxyRequest(CONNECTOR_DFSP_URL)(req, res);
  });

  // API routes (auth required)
  app.use('/api/accounts', authenticate, accountsRouter);
  app.use('/api/quotes', authenticate, quotesRouter);
  app.use('/api/transfers', authenticate, transfersRouter);
  app.use('/api/send-money', authenticate, sendmoneyRouter);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}
