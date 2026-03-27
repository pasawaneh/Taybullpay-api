import { getPool } from '../db/connection';
import { Transfer } from '../models/types';

function rowToTransfer(row: any): Transfer {
  return {
    id: row.id,
    transferId: row.transfer_id,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    amount: parseFloat(row.amount),
    currency: row.currency,
    status: row.status,
    homeTransactionId: row.home_transaction_id,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findByTransferId(transferId: string): Promise<Transfer | undefined> {
  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM transfers WHERE transfer_id = $1', [transferId]);
  return rows[0] ? rowToTransfer(rows[0]) : undefined;
}

export async function findByAccountId(
  accountId: string,
  options: { limit: number; offset: number; status?: string },
): Promise<{ transfers: Transfer[]; total: number }> {
  const pool = getPool();
  const params: any[] = [accountId];
  let where = 'WHERE (from_account_id = $1 OR to_account_id = $1)';

  if (options.status) {
    params.push(options.status);
    where += ` AND status = $${params.length}`;
  }

  const countResult = await pool.query(`SELECT COUNT(*) as count FROM transfers ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(options.limit, options.offset);
  const { rows } = await pool.query(
    `SELECT * FROM transfers ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return { transfers: rows.map(rowToTransfer), total };
}

export async function save(transfer: {
  id: string;
  transferId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  status: string;
  homeTransactionId: string;
  note?: string;
}): Promise<Transfer> {
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO transfers (id, transfer_id, from_account_id, to_account_id, amount, currency, status, home_transaction_id, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [transfer.id, transfer.transferId, transfer.fromAccountId, transfer.toAccountId, transfer.amount, transfer.currency, transfer.status, transfer.homeTransactionId, transfer.note || null],
  );
  return rowToTransfer(rows[0]);
}

export async function updateStatus(transferId: string, status: string): Promise<Transfer | undefined> {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE transfers SET status = $1, updated_at = NOW() WHERE transfer_id = $2 RETURNING *`,
    [status, transferId],
  );
  return rows[0] ? rowToTransfer(rows[0]) : undefined;
}
