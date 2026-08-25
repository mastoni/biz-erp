/**
 * Dashboard strongly typed ViewModels for Web ERP (PHASE 2D).
 *
 * Distinguishes tenant-scoped vs. branch-scoped metrics clearly.
 * Preserves raw minor currency integer values until presentation.
 */

export interface DashboardKpi {
  // Branch-scoped metrics
  total_revenue_minor: number;
  total_sales: number;
  average_order_value_minor: number;

  // Tenant-scoped metrics
  total_products: number;
  total_customers: number;
}

export interface HourlySalesBucket {
  hour: number; // 0–23
  total_revenue_minor: number;
  transaction_count: number;
}

export interface PaymentMethodShare {
  payment_method: string;
  label: string;
  count: number;
  total_minor: number;
  percentage: number;
}

export interface TopProductItem {
  product_id: string;
  product_name: string;
  quantity_sold: number;
  revenue_minor?: number;
}

export interface RecentTransactionItem {
  id: string;
  receipt_number: string;
  total_minor: number;
  payment_method: string | null;
  cashier_id: string | null;
  created_at: string;
  branch_id: string | null;
}

export interface StockAlertSummary {
  out_of_stock_count: number;
  low_stock_count?: number;
}

export interface DashboardViewModel {
  branch_id: string | null;
  kpis: DashboardKpi;
  hourly_sales: HourlySalesBucket[];
  payment_mix: PaymentMethodShare[];
  top_products: TopProductItem[];
  recent_transactions: RecentTransactionItem[];
  stock_alerts: StockAlertSummary;
}

export type DashboardLoadState = 'idle' | 'loading' | 'success' | 'error';
