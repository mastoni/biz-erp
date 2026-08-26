/**
 * Sales ViewModel and CSV transformation helpers.
 */
import {
  CanonicalPaymentMethod,
  DailySalesPointDto,
  PaymentMethodViewModel,
  Sale,
  SalesFilterModel,
  SalesKPIViewModel,
  SalesRangeFilter,
  SalesSummaryDto,
  SalesTransactionViewModel,
  SalesTrendPointViewModel,
} from './types';
import { formatMinor } from '@/lib/format';

export const METHOD_COLORS: Record<CanonicalPaymentMethod, string> = {
  Tunai: '#17593e',
  QRIS: '#d3921f',
  Debit: '#35657f',
};

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/**
 * Normalizes any backend payment string to canonical blueprint types ('Tunai' | 'QRIS' | 'Debit').
 */
export function normalizePaymentMethod(rawMethod: string | null | undefined): {
  canonical: CanonicalPaymentMethod;
  label: string;
  color: string;
} {
  if (!rawMethod) {
    return { canonical: 'Tunai', label: 'Tunai', color: METHOD_COLORS.Tunai };
  }

  const upper = rawMethod.trim().toUpperCase();

  if (upper === 'CASH' || upper === 'TUNAI') {
    return { canonical: 'Tunai', label: 'Tunai', color: METHOD_COLORS.Tunai };
  }
  if (
    upper === 'QRIS' ||
    upper === 'GOPAY' ||
    upper === 'OVO' ||
    upper === 'DANA' ||
    upper === 'SHOPEEPAY' ||
    upper === 'LINKAJA'
  ) {
    return { canonical: 'QRIS', label: 'QRIS', color: METHOD_COLORS.QRIS };
  }
  if (
    upper === 'DEBIT' ||
    upper === 'CARD' ||
    upper === 'CREDIT' ||
    upper === 'KARTU DEBIT' ||
    upper === 'EDC' ||
    upper === 'BANK_TRANSFER'
  ) {
    return { canonical: 'Debit', label: 'Debit', color: METHOD_COLORS.Debit };
  }

  return { canonical: 'Tunai', label: rawMethod, color: METHOD_COLORS.Tunai };
}

/**
 * Formats a Unix epoch timestamp to HH:mm.
 */
export function formatTimeHHmm(epochMs: number): string {
  if (!epochMs || isNaN(epochMs)) return '00:00';
  const d = new Date(epochMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Maps SalesSummary report DTO to SalesKPIViewModel.
 * Note: refund_count remains null until a canonical refund contract is established.
 */
export function mapSalesSummaryToKPI(
  summary?: SalesSummaryDto | null,
  fallbackTransactions?: SalesTransactionViewModel[]
): SalesKPIViewModel {
  if (summary) {
    return {
      total_sales: summary.total_sales,
      total_revenue_minor: summary.total_revenue_minor,
      average_order_value_minor: summary.average_order_value_minor,
      refund_count: null,
    };
  }

  if (fallbackTransactions && fallbackTransactions.length > 0) {
    const completed = fallbackTransactions.filter((t) => t.status === 'selesai');
    const totalRev = completed.reduce((sum, t) => sum + t.total_minor, 0);
    const avg = completed.length > 0 ? Math.round(totalRev / completed.length) : 0;
    return {
      total_sales: fallbackTransactions.length,
      total_revenue_minor: totalRev,
      average_order_value_minor: avg,
      refund_count: null,
    };
  }

  return {
    total_sales: 0,
    total_revenue_minor: 0,
    average_order_value_minor: 0,
    refund_count: null,
  };
}

/**
 * Formats daily sales points for 7-day or 30-day Area Chart.
 */
export function mapDailySalesToTrend(
  points: DailySalesPointDto[],
  range: SalesRangeFilter = '7d'
): SalesTrendPointViewModel[] {
  if (!points || points.length === 0) return [];

  const targetLength = range === '7d' ? 7 : 30;
  const sliced = points.slice(-targetLength);

  return sliced.map((p, idx) => {
    let label: string;
    if (range === '7d') {
      const parts = p.date.split('-');
      if (parts.length === 3) {
        const [y, m, d] = parts.map(Number);
        const dateObj = new Date(Date.UTC(y, m - 1, d));
        label = DAY_NAMES[dateObj.getUTCDay()] || p.date;
      } else {
        label = p.date;
      }
    } else {
      label = String(idx + 1);
    }

    return {
      date: p.date,
      label,
      total_revenue_minor: p.total_revenue_minor,
      transaction_count: p.transaction_count,
    };
  });
}

/**
 * Aggregates payment method breakdown for Donut chart.
 */
export function mapPaymentMethods(
  methods: Array<{ payment_method: string; count: number; total_minor: number }>,
  totalTransactions?: number
): PaymentMethodViewModel[] {
  const groups: Record<CanonicalPaymentMethod, { count: number; total_minor: number; raw: string }> = {
    Tunai: { count: 0, total_minor: 0, raw: 'Tunai' },
    QRIS: { count: 0, total_minor: 0, raw: 'QRIS' },
    Debit: { count: 0, total_minor: 0, raw: 'Debit' },
  };

  for (const m of methods) {
    const norm = normalizePaymentMethod(m.payment_method);
    groups[norm.canonical].count += m.count;
    groups[norm.canonical].total_minor += m.total_minor;
  }

  const totalCount =
    typeof totalTransactions === 'number' && totalTransactions > 0
      ? totalTransactions
      : Object.values(groups).reduce((sum, g) => sum + g.count, 0) || 1;

  const order: CanonicalPaymentMethod[] = ['Tunai', 'QRIS', 'Debit'];

  return order.map((canonical) => {
    const g = groups[canonical];
    const percentage = Math.round((g.count / totalCount) * 100);
    return {
      payment_method: canonical,
      canonical_method: canonical,
      count: g.count,
      total_minor: g.total_minor,
      percentage,
      label: canonical,
      color: METHOD_COLORS[canonical],
    };
  });
}

/**
 * Converts a raw Sale DTO into a SalesTransactionViewModel.
 */
export function mapSaleToViewModel(sale: Sale, fresh = false): SalesTransactionViewModel {
  const norm = normalizePaymentMethod(sale.payment_method);
  const createdEpoch = sale.client_created_at || sale.server_created_at;

  const lines = (sale.items || []).map((item) => ({
    product_id: item.product_id ?? null,
    product_name: item.product_name_snapshot,
    quantity: item.quantity,
    unit_price_minor: item.unit_price_minor,
    line_total_minor: item.quantity * item.unit_price_minor,
  }));

  const itemsCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  return {
    id: sale.id,
    receipt_number: sale.receipt_number || sale.id,
    created_at: createdEpoch,
    time: formatTimeHHmm(createdEpoch),
    cashier: sale.cashier_id || 'Kasir',
    items_count: itemsCount,
    payment_method: norm.label,
    canonical_method: norm.canonical,
    total_minor: sale.grand_total_minor,
    status: 'selesai',
    branch_id: sale.branch_id ?? null,
    fresh,
    lines,
  };
}

/**
 * Filters transaction list by search query and payment method.
 */
export function filterSalesTransactions(
  transactions: SalesTransactionViewModel[],
  filter: SalesFilterModel
): SalesTransactionViewModel[] {
  const q = filter.search?.trim().toLowerCase() || '';
  const method = filter.payment_method || 'Semua';
  const branchId = filter.branch_id;

  return transactions.filter((t) => {
    if (branchId && t.branch_id && t.branch_id !== branchId) {
      return false;
    }

    if (method !== 'Semua' && t.canonical_method !== method) {
      return false;
    }

    if (q) {
      const matchReceipt = t.receipt_number.toLowerCase().includes(q);
      const matchCashier = t.cashier.toLowerCase().includes(q);
      if (!matchReceipt && !matchCashier) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Generates deterministic CSV content matching blueprint headers.
 * Headers: No. Struk, Waktu, Kasir, Item, Metode, Total, Status
 */
export function generateSalesCsv(transactions: SalesTransactionViewModel[]): string {
  const headers = ['No. Struk', 'Waktu', 'Kasir', 'Item', 'Metode', 'Total', 'Status'];

  const rows = transactions.map((t) => [
    t.receipt_number,
    t.time,
    t.cashier,
    String(t.items_count),
    t.canonical_method,
    formatMinor(t.total_minor),
    t.status === 'selesai' ? 'Selesai' : 'Refund',
  ]);

  const escapeCsv = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csvLines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ];

  return csvLines.join('\n');
}

/**
 * Client-side CSV download trigger.
 */
export function downloadSalesCsv(filename: string, transactions: SalesTransactionViewModel[]): void {
  const csvContent = generateSalesCsv(transactions);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
