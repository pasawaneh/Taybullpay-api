import { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      quote_id TEXT UNIQUE NOT NULL,
      payer_account_id TEXT DEFAULT '',
      payee_account_id TEXT DEFAULT '',
      amount NUMERIC(15,2) NOT NULL,
      currency TEXT NOT NULL,
      fee_amount NUMERIC(15,2) NOT NULL,
      commission_amount NUMERIC(15,2) NOT NULL,
      transfer_amount NUMERIC(15,2) NOT NULL,
      expiration TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','EXPIRED','USED')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_quotes_quote_id ON quotes(quote_id);
  `);
}
