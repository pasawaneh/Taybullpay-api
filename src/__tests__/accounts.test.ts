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

describe('GET /api/accounts/:accountId', () => {
  it('returns account info for valid active account', async () => {
    const res = await request(app)
      .get('/api/accounts/7788255')
      .set(authHeaders);

    expect(res.status).toBe(200);
    expect(res.body.accountId).toBe('7788255');
    expect(res.body.firstName).toBe('Ebrima');
    expect(res.body.currency).toBe('GMD');
  });

  it('returns 404 for unknown account', async () => {
    const res = await request(app)
      .get('/api/accounts/0000000')
      .set(authHeaders);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('ACCOUNT_NOT_FOUND');
  });
});

describe('GET /api/accounts/:accountId/balance', () => {
  it('returns balance for valid account', async () => {
    const res = await request(app)
      .get('/api/accounts/7788255/balance')
      .set(authHeaders);

    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(5000);
    expect(res.body.currency).toBe('GMD');
  });
});

describe('POST /api/accounts', () => {
  it('creates a new account', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .set(authHeaders)
      .set('x-idempotency-key', idempotencyKey())
      .send({
        accountId: '6601234',
        firstName: 'Kumbale',
        lastName: 'Good',
        displayName: 'Kumbale Good',
        dateOfBirth: '1994-02-14',
        type: 'CONSUMER',
        currency: 'GMD',
      });

    expect(res.status).toBe(201);
    expect(res.body.accountId).toBe('6601234');
    expect(res.body.balance).toBe(0);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('rejects non-GMD currency', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .set(authHeaders)
      .set('x-idempotency-key', idempotencyKey())
      .send({
        accountId: '7701234',
        firstName: 'Test',
        lastName: 'User',
        displayName: 'Test User',
        dateOfBirth: '1980-01-01',
        type: 'CONSUMER',
        currency: 'USD',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('CURRENCY_MISMATCH');
  });

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .set(authHeaders)
      .set('x-idempotency-key', idempotencyKey())
      .send({ accountId: '8801234' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('rejects duplicate accountId', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .set(authHeaders)
      .set('x-idempotency-key', idempotencyKey())
      .send({
        accountId: '7788255',
        firstName: 'Duplicate',
        lastName: 'User',
        displayName: 'Duplicate User',
        dateOfBirth: '1990-01-01',
        type: 'CONSUMER',
        currency: 'GMD',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ACCOUNT_EXISTS');
  });
});

describe('PUT /api/accounts/:accountId', () => {
  it('updates account fields', async () => {
    const res = await request(app)
      .put('/api/accounts/9960268')
      .set(authHeaders)
      .send({ firstName: 'Essa', displayName: 'Essa M Jabang' });

    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('Essa');
    expect(res.body.displayName).toBe('Essa M Jabang');
  });

  it('returns 404 for unknown account', async () => {
    const res = await request(app)
      .put('/api/accounts/0000000')
      .set(authHeaders)
      .send({ firstName: 'Ghost' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/accounts/:accountId', () => {
  it('soft-deletes (closes) an account', async () => {
    await request(app)
      .post('/api/accounts')
      .set(authHeaders)
      .set('x-idempotency-key', idempotencyKey())
      .send({
        accountId: '1112233',
        firstName: 'ToDelete',
        lastName: 'User',
        displayName: 'ToDelete User',
        dateOfBirth: '1990-01-01',
        type: 'CONSUMER',
        currency: 'GMD',
      });

    const res = await request(app)
      .delete('/api/accounts/1112233')
      .set(authHeaders);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CLOSED');

    const getRes = await request(app)
      .get('/api/accounts/1112233')
      .set(authHeaders);

    expect(getRes.status).toBe(410);
  });
});

describe('Auth', () => {
  it('rejects requests without credentials', async () => {
    const res = await request(app).get('/api/accounts/7788255');
    expect(res.status).toBe(401);
  });

  it('rejects invalid credentials', async () => {
    const res = await request(app)
      .get('/api/accounts/7788255')
      .set({ 'x-api-key': 'wrong', 'x-api-secret': 'wrong' });
    expect(res.status).toBe(403);
  });
});
