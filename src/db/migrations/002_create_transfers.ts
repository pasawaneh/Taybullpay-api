import { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transfers (
      id TEXT PRIMARY KEY,
      transfer_id TEXT UNIQUE NOT NULL,
      from_account_id TEXT NOT NULL,
      to_account_id TEXT DEFAULT '',
      amount NUMERIC(15,2) NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PENDING','RESERVED','COMMITTED','CANCELLED','REFUNDED')),
      home_transaction_id TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_transfers_transfer_id ON transfers(transfer_id);
    CREATE INDEX IF NOT EXISTS idx_transfers_from_account ON transfers(from_account_id);
    CREATE INDEX IF NOT EXISTS idx_transfers_to_account ON transfers(to_account_id);
    CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
  `);
}
