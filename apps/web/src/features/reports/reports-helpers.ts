/**
 * Phase 7C — Reports Pure Helpers & Formatters
 */
import type {
  ReportsRange,
  SalesSummaryReport,
  ProductSalesReport,
  DailySalesPoint,
  RecentSaleItem,
  ReportsExecutiveKPI,
  CashFlowPoint,
  SalesCompositionItem,
  TopProductItem,
  InventoryCategoryItem,
  InventoryReportViewModel,
  ProfitLossViewModel,
  ReportTab,
} from './types';

export const CATEGORY_COLORS: Record<string, string> = {
  Minuman: '#17593e',
  Makanan: '#d3921f',
  Snack: '#35657f',
  Sembako: '#8a5f10',
  Rokok: '#bc4b2f',
  Digital: '#6d3fa8',
  Lainnya: '#68746c',
};

/**
 * Format numeric value with ID locale thousand separators.
 */
export function num(n: number | string | undefined | null): string {
  if (n === undefined || n === null) return '0';
  const parsed = typeof n === 'string' ? Number(n) : n;
  if (isNaN(parsed)) return '0';
  return parsed.toLocaleString('id-ID');
}

/**
 * Format major-unit IDR.
 */
export function idr(n: number | undefined | null): string {
  if (n === undefined || n === null) return 'Rp 0';
  return `Rp ${num(n)}`;
}

/**
 * Format minor-unit integers to abbreviated IDR (e.g. "Rp 73,28 jt" / "Rp 845 rb").
 */
export function idrShort(minor: number | undefined | null): string {
  if (minor === undefined || minor === null) return 'Rp 0';
  const abs = Math.abs(minor);
  const sign = minor < 0 ? '-' : '';
  const f = (v: number) =>
    v.toLocaleString('id-ID', { maximumFractionDigits: v >= 100 ? 0 : v >= 10 ? 1 : 2 });
  if (abs >= 1_000_000_000) return `Rp ${sign}${f(abs / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `Rp ${sign}${f(abs / 1_000_000)} jt`;
  if (abs >= 1_000) return `Rp ${sign}${f(abs / 1_000)} rb`;
  return `Rp ${sign}${abs}`;
}

/**
 * Format percentage.
 */
export function pct(n: number, signed = true): string {
  const s = n.toLocaleString('id-ID', { maximumFractionDigits: 1 });
  return signed && n > 0 ? `+${s}%` : `${s}%`;
}

/**
 * Calculate ISO Date range for 7d or 30d relative to reference date.
 */
export function formatReportsDateRange(
  range: ReportsRange,
  now: Date = new Date()
): { from: string; to: string } {
  const days = range === '7d' ? 7 : 30;
  const to = now.toISOString();
  const fromDate = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  fromDate.setUTCHours(0, 0, 0, 0);
  const from = fromDate.toISOString();
  return { from, to };
}

/**
 * Map Executive KPI.
 */
export function mapExecutiveKPI(
  summary: SalesSummaryReport | null,
  hppMinor: number | null = null,
  expenseMinor: number | null = null
): ReportsExecutiveKPI {
  const revenue_minor = summary?.total_revenue_minor ?? 0;
  const gross_profit_minor = hppMinor !== null ? revenue_minor - hppMinor : null;
  const gross_margin_percent =
    gross_profit_minor !== null && revenue_minor > 0
      ? (gross_profit_minor / revenue_minor) * 100
      : null;
  const operating_expense_minor = expenseMinor;
  const net_profit_minor =
    gross_profit_minor !== null && expenseMinor !== null
      ? gross_profit_minor - expenseMinor
      : null;

  return {
    revenue_minor,
    gross_profit_minor,
    gross_margin_percent,
    operating_expense_minor,
    net_profit_minor,
  };
}

/**
 * Map Cash Flow points from daily sales.
 */
export function mapCashFlowPoints(
  points: DailySalesPoint[],
  outflows?: Record<string, number | null>
): CashFlowPoint[] {
  return points.map((p) => {
    const parts = p.date.split('-');
    const label = parts.length === 3 ? `${Number(parts[2])}/${Number(parts[1])}` : p.date;
    const outflow_minor = outflows && outflows[p.date] !== undefined ? outflows[p.date] : null;

    return {
      date: p.date,
      label,
      inflow_minor: p.total_revenue_minor,
      outflow_minor,
    };
  });
}

/**
 * Group product sales by category for Donut chart composition.
 */
export function mapSalesComposition(
  products: ProductSalesReport[]
): SalesCompositionItem[] {
  const totalUnits = products.reduce((acc, p) => acc + p.total_quantity, 0);
  const groups: Record<string, { quantity: number; revenue_minor: number }> = {};

  for (const p of products) {
    const cat = p.category || 'Lainnya';
    if (!groups[cat]) {
      groups[cat] = { quantity: 0, revenue_minor: 0 };
    }
    groups[cat].quantity += p.total_quantity;
    groups[cat].revenue_minor += p.total_revenue_minor;
  }

  const items = Object.entries(groups).map(([category, data]) => {
    const percentage = totalUnits > 0 ? Math.round((data.quantity / totalUnits) * 100) : 0;
    const color = CATEGORY_COLORS[category] || '#68746c';
    return {
      category,
      quantity: data.quantity,
      revenue_minor: data.revenue_minor,
      percentage,
      color,
    };
  });

  return items.sort((a, b) => b.quantity - a.quantity);
}

/**
 * Derive top 5 products sorted deterministically.
 */
export function mapTopProducts(
  products: ProductSalesReport[],
  limit = 5
): TopProductItem[] {
  const sorted = [...products].sort((a, b) => {
    if (b.total_quantity !== a.total_quantity) {
      return b.total_quantity - a.total_quantity;
    }
    if (b.total_revenue_minor !== a.total_revenue_minor) {
      return b.total_revenue_minor - a.total_revenue_minor;
    }
    return a.product_id.localeCompare(b.product_id);
  });

  const maxQty = sorted[0]?.total_quantity || 1;

  return sorted.slice(0, limit).map((p) => ({
    product_id: p.product_id,
    product_name: p.product_name,
    category: p.category ?? null,
    quantity_sold: p.total_quantity,
    revenue_minor: p.total_revenue_minor,
    percentage: Math.round((p.total_quantity / maxQty) * 100),
  }));
}

/**
 * Map Inventory Report from canonical products and stock records.
 */
export function mapInventoryReport(
  items: Array<{
    category?: string | null;
    sku?: string | null;
    price_minor: number;
    cost_minor?: number | null;
    quantity: number;
    is_active?: boolean;
  }>
): InventoryReportViewModel {
  const groups: Record<
    string,
    {
      sku_count: number;
      quantity: number;
      valuation_minor: number;
      cost_valuation_minor: number;
      has_incomplete_cost: boolean;
    }
  > = {};

  let total_skus = 0;
  let total_quantity = 0;
  let total_valuation_minor = 0;
  let total_cost_valuation_minor = 0;
  let global_incomplete_cost = false;

  for (const item of items) {
    if (item.is_active === false) continue;
    const cat = item.category || 'Lainnya';
    if (!groups[cat]) {
      groups[cat] = {
        sku_count: 0,
        quantity: 0,
        valuation_minor: 0,
        cost_valuation_minor: 0,
        has_incomplete_cost: false,
      };
    }

    const itemValuation = item.price_minor * item.quantity;
    groups[cat].sku_count += 1;
    groups[cat].quantity += item.quantity;
    groups[cat].valuation_minor += itemValuation;

    if (item.cost_minor !== undefined && item.cost_minor !== null) {
      groups[cat].cost_valuation_minor += item.cost_minor * item.quantity;
      total_cost_valuation_minor += item.cost_minor * item.quantity;
    } else {
      groups[cat].has_incomplete_cost = true;
      global_incomplete_cost = true;
    }

    total_skus += 1;
    total_quantity += item.quantity;
    total_valuation_minor += itemValuation;
  }

  const categories: InventoryCategoryItem[] = Object.entries(groups)
    .map(([category, g]) => ({
      category,
      sku_count: g.sku_count,
      quantity: g.quantity,
      valuation_minor: g.valuation_minor,
      cost_valuation_minor: g.has_incomplete_cost ? null : g.cost_valuation_minor,
      percentage: total_valuation_minor > 0 ? Math.round((g.valuation_minor / total_valuation_minor) * 100) : 0,
      color: CATEGORY_COLORS[category] || '#68746c',
    }))
    .sort((a, b) => b.valuation_minor - a.valuation_minor);

  return {
    categories,
    total_skus,
    total_quantity,
    valuation_minor: total_valuation_minor,
    cost_valuation_minor: global_incomplete_cost ? null : total_cost_valuation_minor,
  };
}

/**
 * Map formal Profit & Loss statement.
 */
export function mapProfitLoss(
  revenueMinor: number,
  hppMinor: number | null,
  expenseMinor: number | null
): ProfitLossViewModel {
  const gross_profit_minor = hppMinor !== null ? revenueMinor - hppMinor : null;
  const gross_margin_percent =
    gross_profit_minor !== null && revenueMinor > 0
      ? (gross_profit_minor / revenueMinor) * 100
      : null;
  const net_profit_minor =
    gross_profit_minor !== null && expenseMinor !== null
      ? gross_profit_minor - expenseMinor
      : null;

  let status: ProfitLossViewModel['status'] = 'COMPLETE';
  if (hppMinor === null) {
    status = 'INCOMPLETE_COST_UNAVAILABLE';
  } else if (expenseMinor === null) {
    status = 'EXPENSE_UNAVAILABLE';
  }

  return {
    revenue_minor: revenueMinor,
    hpp_minor: hppMinor,
    gross_profit_minor,
    gross_margin_percent,
    operating_expense_minor: expenseMinor,
    net_profit_minor,
    status,
  };
}

/**
 * Generate CSV text with Indonesian semicolon delimiter and UTF-8 BOM.
 */
export function generateReportsCsv(
  tab: ReportTab,
  data: {
    range?: ReportsRange;
    sales?: RecentSaleItem[];
    profitLoss?: ProfitLossViewModel;
    inventory?: InventoryReportViewModel;
    items?: Array<{ sku: string; name: string; category: string; stock: number; price: number }>;
  }
): string {
  const rows: (string | number)[][] = [];

  if (tab === 'penjualan') {
    rows.push(['Periode', data.range === '7d' ? '7 hari terakhir' : '30 hari terakhir']);
    rows.push([]);
    rows.push(['No. Struk', 'Waktu', 'Kasir', 'Metode', 'Total', 'Status']);
    if (data.sales) {
      for (const s of data.sales) {
        rows.push([
          s.receipt_number || s.id,
          s.created_at,
          s.cashier_id || 'Kasir',
          s.payment_method || 'CASH',
          s.total_minor,
          'Selesai',
        ]);
      }
    }
  } else if (tab === 'labarugi') {
    const pnl = data.profitLoss;
    rows.push(['Komponen', 'Nilai (Rp)']);
    rows.push(['Pendapatan Penjualan', (pnl?.revenue_minor ?? 0)]);
    rows.push(['Harga Pokok Penjualan (HPP)', pnl?.hpp_minor !== null && pnl?.hpp_minor !== undefined ? -pnl.hpp_minor : 'Tidak Tersedia']);
    rows.push(['Laba Kotor', pnl?.gross_profit_minor !== null && pnl?.gross_profit_minor !== undefined ? pnl.gross_profit_minor : 'Tidak Tersedia']);
    rows.push(['Beban Operasional', pnl?.operating_expense_minor !== null && pnl?.operating_expense_minor !== undefined ? -pnl.operating_expense_minor : 'Tidak Tersedia']);
    rows.push(['Laba Bersih', pnl?.net_profit_minor !== null && pnl?.net_profit_minor !== undefined ? pnl.net_profit_minor : 'Tidak Tersedia']);
  } else if (tab === 'stok') {
    rows.push(['SKU', 'Produk', 'Kategori', 'Stok', 'Harga (Rp)', 'Nilai Stok (Rp)']);
    if (data.items) {
      for (const item of data.items) {
        rows.push([
          item.sku,
          item.name,
          item.category,
          item.stock,
          item.price,
          item.price * item.stock,
        ]);
      }
    }
    rows.push([]);
    rows.push(['Total Nilai Stok', '', '', '', '', (data.inventory?.valuation_minor ?? 0)]);
  } else if (tab === 'pembelian') {
    rows.push(['No. PO', 'Supplier', 'Tanggal', 'Jatuh Tempo', 'Item', 'Total', 'Status']);
  } else if (tab === 'hutangpiutang') {
    rows.push(['Jenis', 'ID', 'Pihak', 'Keterangan', 'Jatuh Tempo', 'Nominal', 'Status']);
  } else if (tab === 'digital') {
    rows.push(['Ref', 'Waktu', 'Layanan', 'Tujuan', 'Nominal', 'Admin', 'Komisi', 'Status']);
  }

  const csvBody = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');

  return '\uFEFF' + csvBody;
}
