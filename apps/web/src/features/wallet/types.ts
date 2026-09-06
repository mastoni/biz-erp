export type WalletStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';
export type WalletEntryType = 'CREDIT' | 'DEBIT';
export type WalletTransactionType =
  | 'TOP_UP'
  | 'INVOICE_PAYMENT'
  | 'POS_SETTLEMENT'
  | 'REFUND'
  | 'DIRECT_CREDIT'
  | 'DIRECT_DEBIT'
  | 'REVERSAL';

export interface WalletAccount {
  id: string;
  account_customer_id: string;
  business_id: string | null;
  wallet_number: string;
  currency: string;
  status: WalletStatus;
  balance: number;
  pending_credit: number;
  pending_debit: number;
  server_version: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WalletLedgerEntry {
  id: string;
  wallet_id: string;
  transaction_type: WalletTransactionType;
  entry_type: WalletEntryType;
  amount: number;
  balance_before: number;
  balance_after: number;
  currency: string;
  reference_type: string;
  reference_id: string;
  idempotency_key?: string;
  actor_id?: string | null;
  actor_scope?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export type TopUpIntentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';

export interface TopUpIntent {
  id: string;
  intent_number: string;
  wallet_id: string;
  account_customer_id: string;
  amount: number;
  fee_amount: number;
  total_payable: number;
  currency: string;
  payment_method?: string | null;
  status: TopUpIntentStatus;
  expires_at: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateTopUpPayload {
  amount: number;
  fee_amount?: number;
  currency?: string;
  payment_method?: string;
  expires_in_hours?: number;
  metadata?: Record<string, unknown>;
}

export interface WalletListResponse {
  items: WalletAccount[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface WalletLedgerResponse {
  items: WalletLedgerEntry[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}
