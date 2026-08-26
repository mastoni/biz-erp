/**
 * Sales domain and ViewModel types.
 */

export interface SaleItem {
  product_id: string | null;
  product_name_snapshot: string;
  quantity: number;
  unit_price_minor: number;
}

export interface Sale {
  id: string;
  idempotency_key: string;
  branch_id?: string | null;
  receipt_number: string;
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  grand_total_minor: number;
  payment_method: string | null;
  cash_received_minor: number;
  change_minor: number;
  cashier_id: string | null;
  client_created_at: number;
  server_created_at: number;
  items: SaleItem[];
}

export interface SalesListResponse {
  sales: Sale[];
  has_more: boolean;
}

export interface SalesQueryParams {
  businessId: string;
  since?: number;
  limit?: number;
  branchId?: string;
}

export interface SalesSummaryDto {
  total_sales: number;
  total_revenue_minor: number;
  total_items_sold: number;
  average_order_value_minor: number;
  payment_methods: Array<{
    payment_method: string;
    count: number;
    total_minor: number;
  }>;
}

export interface DailySalesPointDto {
  date: string;
  total_revenue_minor: number;
  transaction_count: number;
}

export interface DailySalesResponseDto {
  points: DailySalesPointDto[];
}

export interface RecentSaleItemDto {
  id: string;
  receipt_number: string;
  total_minor: number;
  payment_method: string | null;
  cashier_id: string | null;
  created_at: string;
  branch_id: string | null;
}

export interface RecentSalesResponseDto {
  sales: RecentSaleItemDto[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ViewModels & UI state types
// ─────────────────────────────────────────────────────────────────────────────

export type CanonicalPaymentMethod = 'Tunai' | 'QRIS' | 'Debit';

export type SalesRangeFilter = '7d' | '30d';

export type SalesPaymentMethodFilter = 'Semua' | 'Tunai' | 'QRIS' | 'Debit';

export type SalesTransactionStatus = 'selesai' | 'refund';

export type SalesDataState = 'loading' | 'ready' | 'empty' | 'error';

export type SalesTransactionState = 'collapsed' | 'expanded' | 'fresh';

export interface SalesKPIViewModel {
  total_sales: number;
  total_revenue_minor: number;
  average_order_value_minor: number;
  refund_count: number | null; // null/pending contract
}

export interface SalesTrendPointViewModel {
  date: string; // YYYY-MM-DD
  label: string; // "Sen", "Sel" or day number
  total_revenue_minor: number;
  transaction_count: number;
}

export interface PaymentMethodViewModel {
  payment_method: string;
  canonical_method: CanonicalPaymentMethod;
  count: number;
  total_minor: number;
  percentage: number;
  label: string;
  color: string;
}

export interface SalesLineItemViewModel {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price_minor: number;
  line_total_minor: number;
}

export interface SalesTransactionViewModel {
  id: string;
  receipt_number: string;
  created_at: number;
  time: string;
  cashier: string;
  items_count: number;
  payment_method: string;
  canonical_method: CanonicalPaymentMethod;
  total_minor: number;
  status: SalesTransactionStatus;
  branch_id: string | null;
  fresh?: boolean;
  lines: SalesLineItemViewModel[];
}

export interface SalesFilterModel {
  search?: string;
  payment_method?: SalesPaymentMethodFilter;
  range?: SalesRangeFilter;
  branch_id?: string;
}

export interface SalesListViewModel {
  kpi: SalesKPIViewModel;
  trend_points: SalesTrendPointViewModel[];
  payment_methods: PaymentMethodViewModel[];
  transactions: SalesTransactionViewModel[];
  filtered_transactions: SalesTransactionViewModel[];
  total: number;
  has_more: boolean;
}
