import { getPool } from '../db/connection';
import { Refund } from '../models/types';

function rowToRefund(row: any): Refund {
  return {
    id: row.id,
    originalTransferId: row.original_transfer_id,
    amount: parseFloat(row.amount),
    currency: row.currency,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function save(refund: {
  id: string;
  originalTransferId: string;
  amount: number;
  currency: string;
  reason: string;
  status: string;
}): Promise<Refund> {
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO refunds (id, original_transfer_id, amount, currency, reason, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [refund.id, refund.originalTransferId, refund.amount, refund.currency, refund.reason, refund.status],
  );
  return rowToRefund(rows[0]);
}

export async function findByTransferId(transferId: string): Promise<Refund[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT * FROM refunds WHERE original_transfer_id = $1 ORDER BY created_at DESC',
    [transferId],
  );
  return rows.map(rowToRefund);
}
