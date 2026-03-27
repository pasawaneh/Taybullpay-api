import { Pool } from 'pg';
import { setPool, closePool } from '../db/connection';
import { runMigrations } from '../db/migrate';
import { seed } from '../db/seed';

// Use a test database
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/taybullpay_test';
process.env.API_KEY = 'test-key';
process.env.API_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

export async function setupTestDb(): Promise<void> {
  await runMigrations();
  // Clean all data and re-seed for each test suite
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('DELETE FROM refunds');
  await pool.query('DELETE FROM idempotency_keys');
  await pool.query('DELETE FROM transfers');
  await pool.query('DELETE FROM quotes');
  await pool.query('DELETE FROM accounts');
  await pool.end();

  await seed();
}

export async function teardownTestDb(): Promise<void> {
  await closePool();
}
