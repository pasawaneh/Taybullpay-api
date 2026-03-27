import { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Fee settings
    INSERT INTO settings (key, value, description, category) VALUES
      ('FEE_PERCENTAGE', '0.01', 'Transfer fee percentage (0.01 = 1%)', 'fees'),
      ('COMMISSION_PERCENTAGE', '0.005', 'Commission percentage (0.005 = 0.5%)', 'fees'),
      ('MAX_TRANSFER_AMOUNT', '1000000', 'Maximum single transfer amount in GMD', 'limits'),
      ('MIN_TRANSFER_AMOUNT', '1', 'Minimum single transfer amount in GMD', 'limits'),
      ('DAILY_TRANSFER_LIMIT', '5000000', 'Daily transfer limit per account in GMD', 'limits'),

      -- Environment
      ('ENVIRONMENT', 'UAT', 'Current environment: UAT or PROD', 'environment'),
      ('CBS_NAME', 'Taybullpay', 'Core Banking System name', 'environment'),
      ('FSP_ID', 'gisp_fsp', 'Financial Service Provider ID', 'environment'),
      ('CURRENCY', 'GMD', 'Operating currency', 'environment'),
      ('SUPPORTED_ID_TYPE', 'MSISDN', 'Supported party ID type', 'environment'),

      -- Connector
      ('CONNECTOR_SDK_URL', 'http://gisp-connector:3003', 'Gisp connector SDK backend URL', 'connector'),
      ('CONNECTOR_DFSP_URL', 'http://gisp-connector:3004', 'Gisp connector DFSP API URL', 'connector'),
      ('SDK_BASE_URL', 'http://sdk-scheme-adapter:4001', 'SDK Scheme Adapter outbound URL', 'connector'),
      ('TTK_URL', 'http://ttk:4040', 'Testing Toolkit FSPIOP URL', 'connector'),

      -- Security
      ('RATE_LIMIT_MAX', '100', 'Max requests per minute per IP', 'security'),
      ('IDEMPOTENCY_ENABLED', 'true', 'Enable idempotency key checking on POST', 'security')
    ON CONFLICT (key) DO NOTHING;
  `);
}
