import { getPool } from '../db/connection';

export async function find(key: string, endpoint: string): Promise<{ responseStatus: number; responseBody: string } | undefined> {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT response_status, response_body FROM idempotency_keys WHERE key = $1 AND endpoint = $2',
    [key, endpoint],
  );
  if (!rows[0]) return undefined;
  return {
    responseStatus: rows[0].response_status,
    responseBody: rows[0].response_body,
  };
}

export async function save(key: string, endpoint: string, responseStatus: number, responseBody: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO idempotency_keys (key, endpoint, response_status, response_body)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (key, endpoint) DO NOTHING`,
    [key, endpoint, responseStatus, responseBody],
  );
}
