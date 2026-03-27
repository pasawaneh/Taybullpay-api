import { getPool } from '../db/connection';
import { Account } from '../models/types';

function rowToAccount(row: any): Account {
  return {
    id: row.id,
    accountId: row.account_id,
    idType: row.id_type,
    firstName: row.first_name,
    lastName: row.last_name,
    middleName: row.middle_name,
    displayName: row.display_name,
    dateOfBirth: row.date_of_birth,
    type: row.type,
    currency: row.currency,
    balance: parseFloat(row.balance),
    kycVerified: row.kyc_verified,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findByAccountId(accountId: string): Promise<Account | undefined> {
  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM accounts WHERE account_id = $1', [accountId]);
  return rows[0] ? rowToAccount(rows[0]) : undefined;
}

export async function findAll(options: { limit: number; offset: number; status?: string }): Promise<{ accounts: Account[]; total: number }> {
  const pool = getPool();
  const params: any[] = [];
  let where = '';

  if (options.status) {
    params.push(options.status);
    where = `WHERE status = $${params.length}`;
  }

  const countResult = await pool.query(`SELECT COUNT(*) as count FROM accounts ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(options.limit, options.offset);
  const { rows } = await pool.query(
    `SELECT * FROM accounts ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return { accounts: rows.map(rowToAccount), total };
}

export async function create(data: {
  id: string;
  accountId: string;
  idType: string;
  firstName: string;
  lastName: string;
  middleName: string;
  displayName: string;
  dateOfBirth: string;
  type: string;
  currency: string;
  balance: number;
  kycVerified: boolean;
  status: string;
}): Promise<Account> {
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO accounts (id, account_id, id_type, first_name, last_name, middle_name, display_name, date_of_birth, type, currency, balance, kyc_verified, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [data.id, data.accountId, data.idType, data.firstName, data.lastName, data.middleName, data.displayName, data.dateOfBirth, data.type, data.currency, data.balance, data.kycVerified, data.status],
  );
  return rowToAccount(rows[0]);
}

export async function update(accountId: string, fields: Partial<Pick<Account, 'firstName' | 'lastName' | 'middleName' | 'displayName' | 'dateOfBirth' | 'type' | 'kycVerified' | 'status'>>): Promise<Account | undefined> {
  const pool = getPool();

  const existing = await findByAccountId(accountId);
  if (!existing) return undefined;

  const setClauses: string[] = [];
  const values: any[] = [];
  let idx = 1;

  const fieldMap: Record<string, string> = {
    firstName: 'first_name',
    lastName: 'last_name',
    middleName: 'middle_name',
    displayName: 'display_name',
    dateOfBirth: 'date_of_birth',
    type: 'type',
    kycVerified: 'kyc_verified',
    status: 'status',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if ((fields as any)[key] !== undefined) {
      setClauses.push(`${col} = $${idx}`);
      values.push((fields as any)[key]);
      idx++;
    }
  }

  if (setClauses.length === 0) return existing;

  setClauses.push(`updated_at = NOW()`);
  values.push(accountId);

  const { rows } = await pool.query(
    `UPDATE accounts SET ${setClauses.join(', ')} WHERE account_id = $${idx} RETURNING *`,
    values,
  );

  return rows[0] ? rowToAccount(rows[0]) : undefined;
}

export async function softDelete(accountId: string): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE accounts SET status = 'CLOSED', updated_at = NOW() WHERE account_id = $1 AND status != 'CLOSED'`,
    [accountId],
  );
  return (rowCount ?? 0) > 0;
}

export async function updateBalance(accountId: string, delta: number): Promise<void> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE accounts SET balance = balance + $1, updated_at = NOW() WHERE account_id = $2`,
    [delta, accountId],
  );
  if ((rowCount ?? 0) === 0) {
    throw new Error(`Account ${accountId} not found for balance update`);
  }
}

export async function getBalance(accountId: string): Promise<number | undefined> {
  const pool = getPool();
  const { rows } = await pool.query('SELECT balance FROM accounts WHERE account_id = $1', [accountId]);
  return rows[0] ? parseFloat(rows[0].balance) : undefined;
}
