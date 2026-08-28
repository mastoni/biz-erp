// Minimum Finance DTO contract shared by the Finance repositories.
// Locked to Phase 9C.2 accounting semantics. Do not widen scope here.

export type AccountType =
  | 'cash'
  | 'bank'
  | 'mobile'
  | 'receivable'
  | 'payable'
  | 'inventory'
  | 'revenue'
  | 'cogs'
  | 'expense'
  | 'income'

export interface AccountBalanceDto {
  account_id: string
  account_code: string
  account_name: string
  account_type: AccountType
  debit_total: number
  credit_total: number
  balance: number
}

export interface CashflowEntryDto {
  journal_entry_id: string
  date: string
  account_id: string
  account_code: string
  account_name: string
  account_type: 'cash' | 'bank' | 'mobile'
  debit_minor: number
  credit_minor: number
  net_flow: number
  description: string | null
}

export interface FinanceSummaryDto {
  total_assets: number
  total_liabilities: number
  total_equity: number
  total_revenue: number
  total_expense: number
  net_income: number
  cash_inflow: number
  cash_outflow: number
  net_cash_flow: number
}

export type JournalStatus = 'draft' | 'posted' | 'reversed'

export type JournalSourceType =
  | 'SALE'
  | 'PURCHASE_PAYMENT'
  | 'EXPENSE'
  | 'INCOME'
  | 'REVERSAL'

export interface JournalLineDto {
  id: string
  journal_entry_id: string
  account_id: string
  debit_minor: number
  credit_minor: number
  description: string | null
  created_at: string
}

export interface JournalEntryDto {
  id: string
  business_id: string
  branch_id: string | null
  date: string
  source_type: JournalSourceType
  source_id: string
  reference: string | null
  description: string
  status: JournalStatus
  reversed_by: string | null
  reversed_at: string | null
  reversal_of: string | null
  created_at: string
  server_version: number
  lines?: JournalLineDto[]
}
