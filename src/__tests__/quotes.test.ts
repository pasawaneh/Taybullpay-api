import request from 'supertest';
import { createApp } from '../app';
import { setupTestDb, teardownTestDb } from './setup';
import { authHeaders, idempotencyKey } from './helpers';

const app = createApp();

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

describe('POST /api/quotes', () => {
  it('creates a quote with valid data', async () => {
    const res = await request(app)
      .post('/api/quotes')
      .set(authHeaders)
      .set('x-idempotency-key', idempotencyKey())
      .send({ amount: '1000.00', currency: 'GMD' });

    expect(res.status).toBe(201);
    expect(res.body.quoteId).toBeDefined();
    expect(res.body.transferAmount).toBe('1000.00');
    expect(res.body.transferAmountCurrency).toBe('GMD');
    expect(res.body.feeAmount).toBe('10.00');
    expect(res.body.commissionAmount).toBe('5.00');
    expect(res.body.expiration).toBeDefined();
  });

  it('rejects invalid amount', async () => {
    const res = await request(app)
      .post('/api/quotes')
      .set(authHeaders)
      .set('x-idempotency-key', idempotencyKey())
      .send({ amount: '-50', currency: 'GMD' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('rejects non-GMD currency', async () => {
    const res = await request(app)
      .post('/api/quotes')
      .set(authHeaders)
      .set('x-idempotency-key', idempotencyKey())
      .send({ amount: '100', currency: 'EUR' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('CURRENCY_MISMATCH');
  });

  it('rejects too many decimal places', async () => {
    const res = await request(app)
      .post('/api/quotes')
      .set(authHeaders)
      .set('x-idempotency-key', idempotencyKey())
      .send({ amount: '100.555', currency: 'GMD' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/quotes/:quoteId', () => {
  it('returns a created quote', async () => {
    const createRes = await request(app)
      .post('/api/quotes')
      .set(authHeaders)
      .set('x-idempotency-key', idempotencyKey())
      .send({ amount: '200', currency: 'GMD' });

    const res = await request(app)
      .get(`/api/quotes/${createRes.body.quoteId}`)
      .set(authHeaders);

    expect(res.status).toBe(200);
    expect(res.body.quoteId).toBe(createRes.body.quoteId);
  });

  it('returns 404 for unknown quote', async () => {
    const res = await request(app)
      .get('/api/quotes/nonexistent-id')
      .set(authHeaders);

    expect(res.status).toBe(404);
  });
});

describe('GET /health', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('taybullpay-api');
  });
});
