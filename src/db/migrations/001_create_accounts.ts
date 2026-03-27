import { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      account_id TEXT UNIQUE NOT NULL,
      id_type TEXT NOT NULL DEFAULT 'MSISDN',
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      middle_name TEXT DEFAULT '',
      display_name TEXT NOT NULL,
      date_of_birth TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('CONSUMER','AGENT','BUSINESS')),
      currency TEXT NOT NULL DEFAULT 'GMD',
      balance NUMERIC(15,2) NOT NULL DEFAULT 0,
      kyc_verified BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','BLOCKED','CLOSED')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_accounts_account_id ON accounts(account_id);
    CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
  `);
}
