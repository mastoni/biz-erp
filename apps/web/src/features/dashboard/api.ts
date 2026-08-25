import { api } from '@/lib/api';
import type {
  DashboardViewModel,
  DashboardKpi,
  HourlySalesBucket,
  PaymentMethodShare,
  TopProductItem,
  RecentTransactionItem,
  StockAlertSummary,
} from './types';

export interface FetchDashboardParams {
  branchId?: string | null;
  from?: string;
  to?: string;
}

export function formatPaymentMethodLabel(method: string | null | undefined): string {
  if (!method) return 'Lainnya';
  switch (method.toUpperCase()) {
    case 'CASH':
      return 'Tunai';
    case 'QRIS':
      return 'QRIS';
    case 'TRANSFER':
      return 'Transfer Bank';
    case 'CARD':
      return 'Kartu';
    default:
      return method;
  }
}

/**
 * Fetch and normalize all dashboard metrics into a single DashboardViewModel.
 *
 * Calls canonical backend endpoints with active branch_id scoping where required:
 * - GET /v1/dashboard
 * - GET /v1/reports/sales-summary
 * - GET /v1/reports/sales-hourly
 * - GET /v1/reports/recent-sales
 */
export async function fetchDashboardViewModel(
  params: FetchDashboardParams = {}
): Promise<DashboardViewModel> {
  const today = new Date().toISOString().split('T')[0];
  const rawFrom = params.from || today;
  const rawTo = params.to || today;
  const from = rawFrom.includes('T') ? rawFrom : `${rawFrom}T00:00:00.000Z`;
  const to = rawTo.includes('T') ? rawTo : `${rawTo}T23:59:59.999Z`;
  const branchId = params.branchId?.trim() || undefined;

  const queryParams: Record<string, string> = { from, to };
  if (branchId) {
    queryParams.branch_id = branchId;
  }

  // 1. Fetch data concurrently
  const [dashRes, summaryRes, hourlyRes, recentRes] = await Promise.all([
    api.get('/v1/dashboard', { params: queryParams }).catch((err) => {
      throw err;
    }),
    api.get('/v1/reports/sales-summary', { params: queryParams }).catch(() => ({
      data: { sales_summary: null },
    })),
    api.get('/v1/reports/sales-hourly', { params: queryParams }).catch(() => ({
      data: { buckets: [] },
    })),
    api.get('/v1/reports/recent-sales', {
      params: branchId ? { branch_id: branchId, limit: 10 } : { limit: 10 },
    }).catch(() => ({
      data: { sales: [] },
    })),
  ]);

  const dashData = dashRes.data || {};
  const summaryData = summaryRes.data?.sales_summary || {};
  const hourlyData = hourlyRes.data?.buckets || [];
  const recentData = recentRes.data?.sales || [];

  // 2. Normalize KPIs
  const totalRevenueMinor = Number(dashData.total_revenue_minor ?? summaryData.total_revenue_minor ?? 0);
  const totalSales = Number(dashData.total_sales ?? summaryData.total_sales ?? 0);
  const avgOrderValueMinor = Number(
    summaryData.average_order_value_minor ?? (totalSales > 0 ? Math.round(totalRevenueMinor / totalSales) : 0)
  );

  const kpis: DashboardKpi = {
    total_revenue_minor: totalRevenueMinor,
    total_sales: totalSales,
    average_order_value_minor: avgOrderValueMinor,
    total_products: Number(dashData.total_products ?? 0),
    total_customers: Number(dashData.total_customers ?? 0),
  };

  // 3. Normalize Hourly Buckets (Ensure all 24 buckets exist)
  const hourlyMap = new Map<number, { total_revenue_minor: number; transaction_count: number }>();
  if (Array.isArray(hourlyData)) {
    for (const b of hourlyData) {
      hourlyMap.set(Number(b.hour), {
        total_revenue_minor: Number(b.total_revenue_minor ?? 0),
        transaction_count: Number(b.transaction_count ?? 0),
      });
    }
  }

  const hourlySales: HourlySalesBucket[] = [];
  for (let h = 0; h < 24; h++) {
    const existing = hourlyMap.get(h);
    hourlySales.push({
      hour: h,
      total_revenue_minor: existing ? existing.total_revenue_minor : 0,
      transaction_count: existing ? existing.transaction_count : 0,
    });
  }

  // 4. Normalize Payment Method Mix
  const rawPaymentMethods = summaryData.payment_methods || [];
  const paymentMix: PaymentMethodShare[] = Array.isArray(rawPaymentMethods)
    ? rawPaymentMethods.map((pm: any) => {
        const totalMinor = Number(pm.total_minor ?? 0);
        const percentage = totalRevenueMinor > 0 ? (totalMinor / totalRevenueMinor) * 100 : 0;
        return {
          payment_method: String(pm.payment_method ?? 'UNKNOWN'),
          label: formatPaymentMethodLabel(pm.payment_method),
          count: Number(pm.count ?? 0),
          total_minor: totalMinor,
          percentage: Math.round(percentage * 10) / 10,
        };
      })
    : [];

  // 5. Normalize Top Products
  const rawTopProducts = dashData.top_products || [];
  const topProducts: TopProductItem[] = Array.isArray(rawTopProducts)
    ? rawTopProducts.map((p: any) => ({
        product_id: String(p.product_id ?? ''),
        product_name: String(p.product_name ?? 'Produk'),
        quantity_sold: Number(p.quantity_sold ?? 0),
        revenue_minor: p.revenue_minor !== undefined ? Number(p.revenue_minor) : undefined,
      }))
    : [];

  // 6. Normalize Recent Transactions
  const recentTransactions: RecentTransactionItem[] = Array.isArray(recentData)
    ? recentData.map((s: any) => ({
        id: String(s.id ?? ''),
        receipt_number: String(s.receipt_number ?? '-'),
        total_minor: Number(s.total_minor ?? 0),
        payment_method: s.payment_method ?? null,
        cashier_id: s.cashier_id ?? null,
        created_at: String(s.created_at ?? ''),
        branch_id: s.branch_id ?? null,
      }))
    : [];

  // 7. Normalize Stock Alerts
  const stockAlerts: StockAlertSummary = {
    out_of_stock_count: Number(dashData.out_of_stock_count ?? 0),
  };

  return {
    branch_id: params.branchId ?? null,
    kpis,
    hourly_sales: hourlySales,
    payment_mix: paymentMix,
    top_products: topProducts,
    recent_transactions: recentTransactions,
    stock_alerts: stockAlerts,
  };
}
