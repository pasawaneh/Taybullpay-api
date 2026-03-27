export interface Account {
  id: string;
  accountId: string;
  idType: string;
  firstName: string;
  lastName: string;
  middleName: string;
  displayName: string;
  dateOfBirth: string;
  type: 'CONSUMER' | 'AGENT' | 'BUSINESS';
  currency: string;
  balance: number;
  kycVerified: boolean;
  status: 'ACTIVE' | 'BLOCKED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
}

export interface Transfer {
  id: string;
  transferId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'RESERVED' | 'COMMITTED' | 'CANCELLED' | 'REFUNDED';
  homeTransactionId: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Quote {
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
  status: 'ACTIVE' | 'EXPIRED' | 'USED';
  createdAt: string;
}

export interface Refund {
  id: string;
  originalTransferId: string;
  amount: number;
  currency: string;
  reason: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}
