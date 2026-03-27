import 'dotenv/config';
import { getPool, closePool } from './connection';
import logger from '../services/logger';

import { up as createAccounts } from './migrations/001_create_accounts';
import { up as createTransfers } from './migrations/002_create_transfers';
import { up as createQuotes } from './migrations/003_create_quotes';
import { up as createRefunds } from './migrations/004_create_refunds';
import { up as createIdempotencyKeys } from './migrations/005_create_idempotency_keys';

const migrations = [
  { name: '001_create_accounts', up: createAccounts },
  { name: '002_create_transfers', up: createTransfers },
  { name: '003_create_quotes', up: createQuotes },
  { name: '004_create_refunds', up: createRefunds },
  { name: '005_create_idempotency_keys', up: createIdempotencyKeys },
];

export async function runMigrations(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const { rows } = await pool.query('SELECT name FROM migrations');
  const applied = new Set(rows.map((r: any) => r.name));

  for (const migration of migrations) {
    if (applied.has(migration.name)) {
      logger.debug(`Migration ${migration.name} already applied`);
      continue;
    }

    logger.info(`Running migration: ${migration.name}`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await migration.up(pool);
      await client.query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
      await client.query('COMMIT');
      logger.info(`Migration ${migration.name} applied`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

// Run directly if called as a script
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('All migrations complete');
      return closePool();
    })
    .catch((err) => {
      logger.error('Migration failed', err);
      process.exit(1);
    });
}
