export type WalletAccountStatus = 'PENDING' | 'ACTIVE' | 'FROZEN' | 'CLOSED'

export type WalletTransactionType =
  | 'TOP_UP'
  | 'DEBIT'
  | 'CREDIT'
  | 'TRANSFER'
  | 'REFUND'
  | 'REVERSAL'
  | 'FEE'
  | 'ADJUSTMENT'
  | 'INVOICE_PAYMENT'
  | 'POS_PAYMENT'

export type WalletEntryType = 'DEBIT' | 'CREDIT'

export type WalletActorScope = 'platform' | 'tenant' | 'customer' | 'system'

export interface WalletAccountDto {
  id: string
  account_customer_id: string
  business_id: string | null
  wallet_number: string
  currency: string
  status: WalletAccountStatus
  balance: number
  pending_credit: number
  pending_debit: number
  server_version: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface WalletLedgerDto {
  id: string
  wallet_id: string
  transaction_type: WalletTransactionType
  entry_type: WalletEntryType
  amount: number
  balance_before: number
  balance_after: number
  currency: string
  reference_type: string
  reference_id: string
  idempotency_key: string
  actor_id: string | null
  actor_scope: WalletActorScope
  description: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface CreateWalletAccountInput {
  account_customer_id: string
  business_id?: string | null
  wallet_number?: string
  currency?: string
  metadata?: Record<string, unknown>
  actor_id?: string | null
  actor_scope?: 'platform' | 'tenant' | 'system'
}

export interface WalletMutationInput {
  wallet_id: string
  transaction_type: WalletTransactionType
  entry_type: WalletEntryType
  amount: number
  currency?: string
  reference_type: string
  reference_id: string
  idempotency_key: string
  actor_id?: string | null
  actor_scope: WalletActorScope
  description: string
  metadata?: Record<string, unknown>
}

export interface DebitWalletInput {
  wallet_id: string
  amount: number
  transaction_type?: WalletTransactionType
  currency?: string
  reference_type: string
  reference_id: string
  idempotency_key: string
  actor_id?: string | null
  actor_scope: WalletActorScope
  description: string
  metadata?: Record<string, unknown>
}

export interface CreditWalletInput {
  wallet_id: string
  amount: number
  transaction_type?: WalletTransactionType
  currency?: string
  reference_type: string
  reference_id: string
  idempotency_key: string
  actor_id?: string | null
  actor_scope: WalletActorScope
  description: string
  metadata?: Record<string, unknown>
}

export interface WalletMutationResult {
  account: WalletAccountDto
  ledger: WalletLedgerDto
  already_processed: boolean
}

export interface WalletQueryFilter {
  account_customer_id?: string
  business_id?: string
  status?: WalletAccountStatus
  currency?: string
  limit?: number
  offset?: number
}

export interface WalletLedgerQueryFilter {
  wallet_id: string
  transaction_type?: WalletTransactionType
  entry_type?: WalletEntryType
  limit?: number
  offset?: number
}

export type TopUpIntentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'

export interface TopUpIntentDto {
  id: string
  intent_number: string
  wallet_id: string
  account_customer_id: string
  amount: number
  fee_amount: number
  total_payable: number
  currency: string
  status: TopUpIntentStatus
  payment_method: string | null
  payment_reference: string | null
  gateway_transaction_id: string | null
  expires_at: string
  settled_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateTopUpIntentInput {
  wallet_id: string
  account_customer_id: string
  amount: number
  fee_amount?: number
  currency?: string
  payment_method?: string
  expires_in_hours?: number
  metadata?: Record<string, unknown>
  actor_id?: string | null
  actor_scope?: WalletActorScope
}

export interface SettleTopUpIntentInput {
  intent_number: string
  payment_reference: string
  gateway_transaction_id?: string
  paid_amount?: number
  currency?: string
  payment_method?: string
  actor_id?: string | null
  actor_scope?: WalletActorScope
}

export interface SettleTopUpIntentResult {
  intent: TopUpIntentDto
  wallet_mutation: WalletMutationResult
  already_processed: boolean
}

export interface TopUpIntentQueryFilter {
  wallet_id?: string
  account_customer_id?: string
  status?: TopUpIntentStatus
  limit?: number
  offset?: number
}

