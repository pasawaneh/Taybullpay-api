import { Pool } from 'pg';
import logger from '../services/logger';

let pool: Pool;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/taybullpay',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected PostgreSQL pool error', err);
    });
  }
  return pool;
}

export function setPool(p: Pool): void {
  pool = p;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
  }
}
