import type {
  Purchase,
  PurchaseFilterModel,
  PurchaseItem,
  PurchaseLineViewModel,
  PurchaseListResponse,
  PurchasePayment,
  PurchasePaymentState,
  PurchasePaymentViewModel,
  PurchaseStatus,
  PurchaseSummaryKPI,
  PurchaseTone,
  PurchasesListViewModel,
  PurchaseViewModel,
  SupplierTerm,
} from './types';

export const PURCHASES_PAGE_SIZE = 20;

export const PURCHASES_PAGE_TITLE = 'Pembelian & Stok Masuk';
export const PURCHASES_PAGE_SUBTITLE =
  'Kelola pesanan pembelian (PO), penerimaan barang gudang, dan pembayaran supplier.';
export const PURCHASES_EMPTY_TITLE = 'Belum ada data pembelian';
export const PURCHASES_EMPTY_DESCRIPTION =
  'Buat pesanan pembelian baru untuk memulai pengadaan barang.';
export const PURCHASES_ADD_ACTION_LABEL = 'Buat PO Baru';

export function num(n: number | string | undefined | null): string {
  if (n === undefined || n === null) return '0';
  const parsed = typeof n === 'string' ? Number(n) : n;
  if (isNaN(parsed)) return '0';
  return parsed.toLocaleString('id-ID');
}

export function idr(minor: number | undefined | null): string {
  if (minor === undefined || minor === null) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(minor);
}

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

export function getPurchaseStatusTone(status: PurchaseStatus | string): PurchaseTone {
  switch (status) {
    case 'draft':
      return 'fog';
    case 'sent':
    case 'partial':
      return 'tide';
    case 'received':
      return 'pine';
    case 'cancelled':
      return 'clay';
    default:
      return 'fog';
  }
}

export function getPurchaseStatusLabel(status: PurchaseStatus | string): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'sent':
      return 'Dikirim';
    case 'partial':
      return 'Parsial';
    case 'received':
      return 'Diterima';
    case 'cancelled':
      return 'Dibatalkan';
    default:
      return String(status);
  }
}

export function getPurchasePaymentState(purchase: {
  status: PurchaseStatus | string;
  supplier_term: SupplierTerm | string;
  paid_minor: number;
  total_minor: number;
  received_minor: number;
  outstanding_minor: number;
}): PurchasePaymentState {
  if (purchase.status === 'cancelled') {
    return 'not_applicable';
  }

  const paid = Number(purchase.paid_minor) || 0;
  const total = Number(purchase.total_minor) || 0;
  const received = Number(purchase.received_minor) || 0;

  if (purchase.supplier_term === 'Tunai') {
    if (purchase.status === 'draft' || purchase.status === 'sent') {
      return 'unpaid';
    }
    if (purchase.status === 'received') {
      return 'paid';
    }
    if (purchase.status === 'partial') {
      return 'partial';
    }
    if (paid > 0 && paid >= received && received > 0) {
      return 'paid';
    }
    if (paid > 0) {
      return 'partial';
    }
    return 'unpaid';
  }

  // Tempo 14 / Tempo 30
  if (paid >= total && total > 0) {
    return 'paid';
  }
  if (paid > 0) {
    return 'partial';
  }
  return 'unpaid';
}

export function calculateReceivingProgress(
  items: { ordered_qty: number; received_qty: number }[]
): {
  received_total_qty: number;
  ordered_total_qty: number;
  remaining_total_qty: number;
  receive_percentage: number;
} {
  const ordered_total_qty = items.reduce((s, it) => s + (Number(it.ordered_qty) || 0), 0);
  const received_total_qty = items.reduce((s, it) => s + (Number(it.received_qty) || 0), 0);
  const remaining_total_qty = Math.max(0, ordered_total_qty - received_total_qty);
  const receive_percentage =
    ordered_total_qty > 0
      ? Math.min(100, Math.round((received_total_qty / ordered_total_qty) * 100))
      : 0;

  return {
    received_total_qty,
    ordered_total_qty,
    remaining_total_qty,
    receive_percentage,
  };
}

export function mapPurchaseItemToViewModel(dto: PurchaseItem): PurchaseLineViewModel {
  const ordered_qty = Number(dto.ordered_qty) || 0;
  const received_qty = Number(dto.received_qty) || 0;
  const unit_cost_minor = Number(dto.unit_cost_minor) || 0;
  const subtotal_minor = Number(dto.subtotal_minor) || 0;
  const remaining_qty = Math.max(0, ordered_qty - received_qty);
  const received_value_minor = received_qty * unit_cost_minor;

  return {
    id: dto.id,
    purchase_id: dto.purchase_id,
    product_id: dto.product_id,
    product_name: dto.product_name,
    ordered_qty,
    received_qty,
    remaining_qty,
    unit_cost_minor,
    subtotal_minor,
    received_value_minor,
  };
}

export function mapPurchasePaymentToViewModel(
  dto: PurchasePayment
): PurchasePaymentViewModel {
  return {
    id: dto.id,
    purchase_id: dto.purchase_id,
    amount_minor: Number(dto.amount_minor) || 0,
    method: dto.method,
    reference: dto.reference ?? null,
    idempotency_key: dto.idempotency_key,
    created_at: dto.created_at,
  };
}

export function mapPurchaseToViewModel(dto: Purchase): PurchaseViewModel {
  const mappedItems = (dto.items || []).map((it) => mapPurchaseItemToViewModel(it));
  const mappedPayments = (dto.payments || []).map((p) => mapPurchasePaymentToViewModel(p));
  const progress = calculateReceivingProgress(mappedItems);

  const total_minor = Number(dto.total_minor) || 0;
  const received_minor = Number(dto.received_minor) || 0;
  const paid_minor = Number(dto.paid_minor) || 0;
  const outstanding_minor = Number(dto.outstanding_minor) || 0;

  const payment_state = getPurchasePaymentState({
    status: dto.status,
    supplier_term: dto.supplier_term,
    paid_minor,
    total_minor,
    received_minor,
    outstanding_minor,
  });

  return {
    id: dto.id,
    business_id: dto.business_id,
    branch_id: dto.branch_id,
    supplier_id: dto.supplier_id,
    supplier_name: dto.supplier_name,
    supplier_code: dto.supplier_code,
    code: dto.code,
    date: dto.date,
    due_date: dto.due_date,
    supplier_term: dto.supplier_term,
    status: dto.status,
    status_label: getPurchaseStatusLabel(dto.status),
    status_tone: getPurchaseStatusTone(dto.status),
    payment_state,
    total_minor,
    received_minor,
    paid_minor,
    outstanding_minor,
    note: dto.note ?? null,
    server_version: Number(dto.server_version) || 1,
    created_at: dto.created_at,
    updated_at: dto.updated_at,
    deleted_at: dto.deleted_at ?? null,
    items: mappedItems,
    payments: mappedPayments,
    received_total_qty: progress.received_total_qty,
    ordered_total_qty: progress.ordered_total_qty,
    remaining_total_qty: progress.remaining_total_qty,
    receive_percentage: progress.receive_percentage,
  };
}

export function mapPurchaseSummaryToViewModel(
  dto?: Partial<PurchaseSummaryKPI> | null,
  fallbackItems: PurchaseViewModel[] = []
): PurchaseSummaryKPI {
  if (dto && typeof dto.total_purchases === 'number') {
    return {
      total_purchases: dto.total_purchases,
      draft_count: dto.draft_count ?? 0,
      sent_count: dto.sent_count ?? 0,
      partial_count: dto.partial_count ?? 0,
      received_count: dto.received_count ?? 0,
      cancelled_count: dto.cancelled_count ?? 0,
      total_value_minor: Number(dto.total_value_minor) || 0,
      outstanding_minor: Number(dto.outstanding_minor) || 0,
    };
  }

  const total = fallbackItems.length;
  const draft = fallbackItems.filter((p) => p.status === 'draft').length;
  const sent = fallbackItems.filter((p) => p.status === 'sent').length;
  const partial = fallbackItems.filter((p) => p.status === 'partial').length;
  const received = fallbackItems.filter((p) => p.status === 'received').length;
  const cancelled = fallbackItems.filter((p) => p.status === 'cancelled').length;
  const totalVal = fallbackItems
    .filter((p) => p.status !== 'cancelled')
    .reduce((s, p) => s + p.total_minor, 0);
  const outstanding = fallbackItems
    .filter((p) => p.status !== 'cancelled')
    .reduce((s, p) => s + p.outstanding_minor, 0);

  return {
    total_purchases: total,
    draft_count: draft,
    sent_count: sent,
    partial_count: partial,
    received_count: received,
    cancelled_count: cancelled,
    total_value_minor: totalVal,
    outstanding_minor: outstanding,
  };
}

export function mapPurchaseListToViewModel(
  res: PurchaseListResponse
): PurchasesListViewModel {
  const items = (res.items || []).map((p) => mapPurchaseToViewModel(p));
  const summary = mapPurchaseSummaryToViewModel(res.summary, items);

  return {
    items,
    total: typeof res.total === 'number' ? res.total : items.length,
    limit: res.limit || PURCHASES_PAGE_SIZE,
    offset: res.offset || 0,
    has_more: !!res.has_more,
    summary,
  };
}

export function filterPurchases(
  items: PurchaseViewModel[],
  filter: PurchaseFilterModel
): PurchaseViewModel[] {
  const q = filter.search?.trim().toLowerCase() || '';
  const status = filter.status?.trim().toLowerCase() || '';
  const supplierId = filter.supplierId?.trim() || '';
  const term = filter.term?.trim() || '';

  return items.filter((po) => {
    // Status filter
    if (status && status !== 'semua' && po.status.toLowerCase() !== status) {
      return false;
    }

    // Supplier filter
    if (supplierId && po.supplier_id !== supplierId) {
      return false;
    }

    // Term filter
    if (term && term !== 'Semua' && po.supplier_term !== term) {
      return false;
    }

    // Search query filter
    if (q) {
      const matchCode = po.code.toLowerCase().includes(q);
      const matchSupplier =
        (po.supplier_name?.toLowerCase().includes(q) ?? false) ||
        (po.supplier_code?.toLowerCase().includes(q) ?? false);
      const matchItem = po.items.some((it) => it.product_name.toLowerCase().includes(q));
      const matchNote = po.note?.toLowerCase().includes(q) ?? false;

      if (!matchCode && !matchSupplier && !matchItem && !matchNote) {
        return false;
      }
    }

    return true;
  });
}
