/**
 * Phase 7C — Reports Domain & ViewModel Types
 */

export type ReportsRange = '7d' | '30d';

export type ReportTab =
  | 'penjualan'
  | 'labarugi'
  | 'stok'
  | 'pembelian'
  | 'hutangpiutang'
  | 'digital';

export type ReportDataState = 'loading' | 'ready' | 'empty' | 'error';

// -----------------------------------------------------------------------------
// Canonical API Data Shapes
// -----------------------------------------------------------------------------

export interface SalesSummaryReport {
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

export interface ProductSalesReport {
  product_id: string;
  product_name: string;
  category?: string | null;
  total_quantity: number;
  total_revenue_minor: number;
}

export interface CustomerSalesReport {
  customer_id?: string;
  customer_name: string;
  total_purchases: number;
  total_spent_minor: number;
}

export interface DailySalesPoint {
  date: string;
  total_revenue_minor: number;
  transaction_count: number;
}

export interface DailySalesResponse {
  points: DailySalesPoint[];
}

export interface RecentSaleItem {
  id: string;
  receipt_number: string;
  total_minor: number;
  payment_method: string | null;
  cashier_id: string | null;
  created_at: string;
  branch_id: string | null;
}

export interface RecentSalesResponse {
  sales: RecentSaleItem[];
}

// -----------------------------------------------------------------------------
// ViewModels
// -----------------------------------------------------------------------------

export interface ReportsExecutiveKPI {
  revenue_minor: number;
  gross_profit_minor: number | null;
  gross_margin_percent: number | null;
  operating_expense_minor: number | null;
  net_profit_minor: number | null;
}

export interface CashFlowPoint {
  date: string;
  label: string;
  inflow_minor: number;
  outflow_minor: number | null;
}

export interface SalesCompositionItem {
  category: string;
  quantity: number;
  revenue_minor: number;
  percentage: number;
  color?: string;
}

export interface TopProductItem {
  product_id: string;
  product_name: string;
  category: string | null;
  quantity_sold: number;
  revenue_minor: number;
  percentage: number;
}

export interface SalesReportViewModel {
  summary: SalesSummaryReport;
  transactions: RecentSaleItem[];
  top_products: TopProductItem[];
}

export interface InventoryCategoryItem {
  category: string;
  sku_count: number;
  quantity: number;
  valuation_minor: number;
  cost_valuation_minor: number | null;
  percentage: number;
  color?: string;
}

export interface InventoryReportViewModel {
  categories: InventoryCategoryItem[];
  total_skus: number;
  total_quantity: number;
  valuation_minor: number;
  cost_valuation_minor: number | null;
}

export interface ProfitLossViewModel {
  revenue_minor: number;
  hpp_minor: number | null;
  gross_profit_minor: number | null;
  gross_margin_percent: number | null;
  operating_expense_minor: number | null;
  net_profit_minor: number | null;
  status: 'COMPLETE' | 'INCOMPLETE_COST_UNAVAILABLE' | 'EXPENSE_UNAVAILABLE';
}

export interface ReportsHubViewModel {
  range: ReportsRange;
  activeTab: ReportTab;
  state: ReportDataState;
  kpi: ReportsExecutiveKPI;
  cashFlow: CashFlowPoint[];
  salesComposition: SalesCompositionItem[];
  salesReport: SalesReportViewModel;
  inventoryReport: InventoryReportViewModel;
  profitLoss: ProfitLossViewModel;
  isP1Tab: boolean;
  p1TabUnavailableMessage: string | null;
}
