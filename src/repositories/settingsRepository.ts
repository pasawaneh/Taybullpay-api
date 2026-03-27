import { getPool } from '../db/connection';

export interface Setting {
  key: string;
  value: string;
  description: string | null;
  category: string;
  updatedAt: string;
}

function rowToSetting(row: any): Setting {
  return {
    key: row.key,
    value: row.value,
    description: row.description,
    category: row.category,
    updatedAt: row.updated_at,
  };
}

export async function getAll(): Promise<Setting[]> {
  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM settings ORDER BY category, key');
  return rows.map(rowToSetting);
}

export async function getByCategory(category: string): Promise<Setting[]> {
  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM settings WHERE category = $1 ORDER BY key', [category]);
  return rows.map(rowToSetting);
}

export async function get(key: string): Promise<string | null> {
  const pool = getPool();
  const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
  return rows[0]?.value ?? null;
}

export async function getNumber(key: string, fallback: number): Promise<number> {
  const val = await get(key);
  return val ? parseFloat(val) : fallback;
}

export async function set(key: string, value: string): Promise<Setting> {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *`,
    [value, key],
  );
  if (!rows[0]) {
    throw new Error(`Setting ${key} not found`);
  }
  return rowToSetting(rows[0]);
}

export async function bulkUpdate(updates: { key: string; value: string }[]): Promise<Setting[]> {
  const pool = getPool();
  const client = await pool.connect();
  const results: Setting[] = [];
  try {
    await client.query('BEGIN');
    for (const { key, value } of updates) {
      const { rows } = await client.query(
        `UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *`,
        [value, key],
      );
      if (rows[0]) results.push(rowToSetting(rows[0]));
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return results;
}
