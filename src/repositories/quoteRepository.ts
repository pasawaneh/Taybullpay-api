import { getPool } from '../db/connection';
import { Quote } from '../models/types';

function rowToQuote(row: any): Quote {
  return {
    id: row.id,
    quoteId: row.quote_id,
    payerAccountId: row.payer_account_id,
    payeeAccountId: row.payee_account_id,
    amount: parseFloat(row.amount),
    currency: row.currency,
    feeAmount: parseFloat(row.fee_amount),
    commissionAmount: parseFloat(row.commission_amount),
    transferAmount: parseFloat(row.transfer_amount),
    expiration: row.expiration,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function findByQuoteId(quoteId: string): Promise<Quote | undefined> {
  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM quotes WHERE quote_id = $1', [quoteId]);
  return rows[0] ? rowToQuote(rows[0]) : undefined;
}

export async function save(quote: {
  id: string;
  quoteId: string;
  payerAccountId: string;
  payeeAccountId: string;
  amount: number;
  currency: string;
  feeAmount: number;
  commissionAmount: number;
  transferAmount: number;
  expiration: string;
  status: string;
}): Promise<Quote> {
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO quotes (id, quote_id, payer_account_id, payee_account_id, amount, currency, fee_amount, commission_amount, transfer_amount, expiration, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [quote.id, quote.quoteId, quote.payerAccountId, quote.payeeAccountId, quote.amount, quote.currency, quote.feeAmount, quote.commissionAmount, quote.transferAmount, quote.expiration, quote.status],
  );
  return rowToQuote(rows[0]);
}

export async function updateStatus(quoteId: string, status: string): Promise<void> {
  const pool = getPool();
  await pool.query('UPDATE quotes SET status = $1 WHERE quote_id = $2', [status, quoteId]);
}
