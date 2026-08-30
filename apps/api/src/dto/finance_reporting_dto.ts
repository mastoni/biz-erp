import type { AccountType, JournalSourceType } from './finance_dto'

export interface ProfitLossReportDto {
  revenue_minor: number
  cogs_minor: number
  operating_expense_minor: number
  expense_minor: number
  net_income_minor: number
}

export interface BalanceSheetDto {
  total_assets_minor: number
  total_liabilities_minor: number
  total_equity_minor: number
}

export interface GeneralLedgerEntryDto {
  account_id: string
  account_code: string
  account_name: string
  account_type: AccountType
  opening_balance: number
  journal_entry_id: string
  date: string
  source_type: JournalSourceType
  description: string
  debit_minor: number
  credit_minor: number
  running_balance: number
}

export interface GeneralLedgerReportDto {
  opening_balance: number
  period_movements: number
  closing_balance: number
  entries: GeneralLedgerEntryDto[]
}

export interface AccountBalanceReportDto {
  account_id: string
  account_code: string
  account_name: string
  account_type: AccountType
  debit_total: number
  credit_total: number
  balance: number
}

export interface ArAgingBucketDto {
  bucket: string
  amount_minor: number
}

export interface ArAgingReportDto {
  total_outstanding_minor: number
  buckets: ArAgingBucketDto[]
  customers: Array<{
    customer_id: string
    customer_name: string
    outstanding_minor: number
    bucket: string
  }>
}

export interface ApAgingBucketDto {
  bucket: string
  amount_minor: number
}

export interface ApAgingReportDto {
  total_outstanding_minor: number
  buckets: ApAgingBucketDto[]
  suppliers: Array<{
    supplier_id: string
    supplier_name: string
    outstanding_minor: number
    bucket: string
  }>
}

export interface ArReconciliationDto {
  customer_outstanding_minor: number
  total_outstanding_minor: number
  collection_total_minor: number
}

export interface ApReconciliationDto {
  supplier_outstanding_minor: number
  total_ap_minor: number
  payment_total_minor: number
}

export interface ReportingQueryParams {
  businessId: string
  branchId?: string | null
  fromDate?: string | null
  toDate?: string | null
}
