import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { getPool, closePool } from './connection';
import logger from '../services/logger';

const seedAccounts = [
  {
    accountId: '7788255',
    idType: 'MSISDN',
    firstName: 'Ebrima',
    lastName: 'Sawaneh',
    middleName: '',
    displayName: 'Ebrima Sawaneh',
    dateOfBirth: '1990-05-15',
    type: 'CONSUMER',
    currency: 'GMD',
    balance: 5000.0,
    kycVerified: true,
    status: 'ACTIVE',
  },
  {
    accountId: '9960268',
    idType: 'MSISDN',
    firstName: 'Essa',
    lastName: 'Jabang',
    middleName: '',
    displayName: 'Essa Jabang',
    dateOfBirth: '1985-11-20',
    type: 'CONSUMER',
    currency: 'GMD',
    balance: 12000.0,
    kycVerified: true,
    status: 'ACTIVE',
  },
  {
    accountId: '3182122',
    idType: 'MSISDN',
    firstName: 'Abubacarr',
    lastName: 'Mahmoud',
    middleName: '',
    displayName: 'Abubacarr Mahmoud',
    dateOfBirth: '1992-03-08',
    type: 'CONSUMER',
    currency: 'GMD',
    balance: 8500.0,
    kycVerified: true,
    status: 'ACTIVE',
  },
  {
    accountId: '5401992',
    idType: 'MSISDN',
    firstName: 'Fanta',
    lastName: 'Ceesay',
    middleName: '',
    displayName: 'Fanta Ceesay',
    dateOfBirth: '1995-08-22',
    type: 'BUSINESS',
    currency: 'GMD',
    balance: 50000.0,
    kycVerified: true,
    status: 'ACTIVE',
  },
];

export async function seed(): Promise<void> {
  const pool = getPool();

  const { rows } = await pool.query('SELECT COUNT(*) as count FROM accounts');
  if (parseInt(rows[0].count, 10) > 0) {
    logger.info('Accounts table already has data, skipping seed');
    return;
  }

  for (const a of seedAccounts) {
    await pool.query(
      `INSERT INTO accounts (id, account_id, id_type, first_name, last_name, middle_name, display_name, date_of_birth, type, currency, balance, kyc_verified, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [uuidv4(), a.accountId, a.idType, a.firstName, a.lastName, a.middleName, a.displayName, a.dateOfBirth, a.type, a.currency, a.balance, a.kycVerified, a.status],
    );
  }

  logger.info(`Seeded ${seedAccounts.length} accounts`);
}

if (require.main === module) {
  seed()
    .then(() => closePool())
    .catch((err) => {
      logger.error('Seed failed', err);
      process.exit(1);
    });
}
