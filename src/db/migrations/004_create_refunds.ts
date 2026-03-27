import { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS refunds (
      id TEXT PRIMARY KEY,
      original_transfer_id TEXT NOT NULL REFERENCES transfers(transfer_id),
      amount NUMERIC(15,2) NOT NULL,
      currency TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PENDING','COMPLETED','FAILED')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_refunds_transfer_id ON refunds(original_transfer_id);
  `);
}
