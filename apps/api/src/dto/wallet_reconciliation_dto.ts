export type DiscrepancyType =
  | 'INVOICE_LEDGER_ORPHAN'
  | 'WALLET_PAYMENT_UNSETTLED'
  | 'AMOUNT_MISMATCH'

export type SettlementDomain = 'CUSTOMER_INVOICE' | 'POS_SALE'

export interface SettlementDiscrepancy {
  discrepancy_type: DiscrepancyType
  domain: SettlementDomain
  reference_id: string
  reference_number: string | null
  business_id: string
  wallet_id: string | null
  wallet_ledger_id: string | null
  expected_amount_minor: number
  actual_amount_minor: number
  difference_minor: number
  details: string
  detected_at: string
}

export interface WalletReconciliationSummary {
  business_id: string
  period_start: string | null
  period_end: string | null
  total_settlements_scanned: number
  total_invoices_scanned: number
  total_sales_scanned: number
  total_reconciled_settlements: number
  total_discrepancies: number
  discrepancy_breakdown: {
    invoice_ledger_orphans: number
    wallet_payment_unsettled: number
    amount_mismatches: number
  }
  total_reconciled_volume_minor: number
  discrepancies: SettlementDiscrepancy[]
  status: 'RECONCILED' | 'DISCREPANCIES_FOUND'
  reconciled_at: string
}

export interface WalletReconciliationFilter {
  business_id?: string
  domain?: SettlementDomain
  fromDate?: string
  toDate?: string
}

export interface WalletRefundRequest {
  reason: string
  idempotency_key: string
}

export interface WalletRefundResult {
  success: boolean
  refund_type: 'CUSTOMER_INVOICE' | 'POS_SALE'
  reference_id: string
  business_id: string
  wallet_id: string
  refund_ledger_id: string
  reversal_journal_id: string | null
  amount_minor: number
  already_refunded?: boolean
  refunded_at: string
}
