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

describe('POST /api/transfers/reserve', () => {
  it('reserves funds successfully', async () => {
    const res = await request(app)
      .post('/api/transfers/reserve')
      .set(authHeaders)
      .set('x-idempotency-key', idempotencyKey())
      .send({ fromAccountId: '7788255', toAccountId: '9960268', amount: '100.00', currency: 'GMD' });

    expect(res.status).toBe(201);
    expect(res.body.transferState).toBe('RESERVED');
    expect(res.body.amount).toBe('100.00');
    expect(res.body.homeTransactionId).toMatch(/^TBP-/);
  });

  it('rejects insufficient balance', async () => {
    const res = await request(app)
      .post('/api/transfers/reserve')
      .set(authHeaders)
      .set('x-idempotency-key', idempotencyKey())
      .send({ fromAccountId: '7788255', amount: '999999.00', currency: 'GMD' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INSUFFICIENT_FUNDS');
  });

  it('rejects non-GMD currency', async () => {
    const res = await request(app)
      .post('/api/transfers/reserve')
      .set(authHeaders)
      .set('x-idempotency-key', idempotencyKey())
      .send({ fromAccountId: '7788255', amount: '10.00', currency: 'USD' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('CURRENCY_MISMATCH');
  });
});

describe('Transfer lifecycle: reserve -> commit', () => {
  let transferId: string;

  it('reserves then commits funds', async () => {
    const reserveRes = await request(app)
      .post('/api/transfers/reserve')
      .set(authHeaders)
      .set('x-idempotency-key', idempotencyKey())
      .send({ fromAccountId: '9960268', toAccountId: '3182122', amount: '500.00', currency: 'GMD' });

    expect(reserveRes.status).toBe(201);
    transferId = reserveRes.body.transferId;

    const commitRes = await request(app)
      .put(`/api/transfers/${transferId}/commit`)
      .set(authHeaders);

    expect(commitRes.status).toBe(200);
    expect(commitRes.body.transferState).toBe('COMMITTED');
  });

  it('rejects committing a non-RESERVED transfer', async () => {
    const res = await request(app)
      .put(`/api/transfers/${transferId}/commit`)
      .set(authHeaders);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('INVALID_TRANSFER_STATE');
  });
});

describe('Transfer lifecycle: reserve -> cancel', () => {
  it('cancels and returns funds', async () => {
    const balBefore = await request(app)
      .get('/api/accounts/3182122/balance')
      .set(authHeaders);
    const beforeBalance = balBefore.body.balance;

    const reserveRes = await request(app)
      .post('/api/transfers/reserve')
      .set(authHeaders)
      .set('x-idempotency-key', idempotencyKey())
      .send({ fromAccountId: '3182122', amount: '200.00', currency: 'GMD' });

    expect(reserveRes.status).toBe(201);

    const cancelRes = await request(app)
      .put(`/api/transfers/${reserveRes.body.transferId}/cancel`)
      .set(authHeaders);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.transferState).toBe('CANCELLED');

    const balAfter = await request(app)
      .get('/api/accounts/3182122/balance')
      .set(authHeaders);
    expect(balAfter.body.balance).toBe(beforeBalance);
  });
});

describe('POST /api/transfers/:transferId/refund', () => {
  it('refunds a committed transfer', async () => {
    const reserveRes = await request(app)
      .post('/api/transfers/reserve')
      .set(authHeaders)
      .set('x-idempotency-key', idempotencyKey())
      .send({ fromAccountId: '9960268', toAccountId: '7788255', amount: '50.00', currency: 'GMD' });

    const transferId = reserveRes.body.transferId;

    await request(app)
      .put(`/api/transfers/${transferId}/commit`)
      .set(authHeaders);

    const refundRes = await request(app)
      .post(`/api/transfers/${transferId}/refund`)
      .set(authHeaders)
      .set('x-idempotency-key', idempotencyKey())
      .send({ reason: 'Customer request' });

    expect(refundRes.status).toBe(200);
    expect(refundRes.body.transferState).toBe('REFUNDED');
    expect(refundRes.body.originalTransferId).toBe(transferId);
  });
});

describe('GET /api/transfers', () => {
  it('returns paginated transfer history for an account', async () => {
    const res = await request(app)
      .get('/api/transfers?accountId=9960268')
      .set(authHeaders);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.transfers)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
  });

  it('returns 400 when accountId is missing', async () => {
    const res = await request(app)
      .get('/api/transfers')
      .set(authHeaders);

    expect(res.status).toBe(400);
  });
});

describe('GET /api/transfers/:transferId', () => {
  it('returns 404 for unknown transfer', async () => {
    const res = await request(app)
      .get('/api/transfers/nonexistent-id')
      .set(authHeaders);

    expect(res.status).toBe(404);
  });
});
