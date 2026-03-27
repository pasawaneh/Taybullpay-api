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
