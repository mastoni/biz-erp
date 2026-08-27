import type {
  Supplier,
  SupplierFilterModel,
  SupplierListResponse,
  SupplierSummaryKPI,
  SupplierViewModel,
  SuppliersListViewModel,
  SupplierTerm,
  SupplierTone,
  SupplierStatus,
} from './types';

export const SUPPLIERS_PAGE_SIZE = 20;

export const SUPPLIERS_PAGE_TITLE = 'Supplier';
export const SUPPLIERS_PAGE_SUBTITLE = 'Mitra pemasok barang, termin pembayaran, dan riwayat kerja sama.';
export const SUPPLIERS_EMPTY_TITLE = 'Supplier tidak ditemukan';
export const SUPPLIERS_EMPTY_DESCRIPTION = 'Belum ada data supplier pada bisnis ini.';
export const SUPPLIERS_ADD_ACTION_LABEL = 'Tambah Supplier';

export const SUPPLIERS_FETCH_FALLBACK = 'Terjadi kesalahan saat mengambil data supplier.';
export const SUPPLIERS_PAGE_FALLBACK = 'Terjadi kesalahan.';

export type SupplierRole = 'OWNER' | 'CASHIER' | null;

export function canAddSupplier(role: SupplierRole): boolean {
  return role === 'OWNER';
}

export function getSupplierTermTone(term: SupplierTerm | string): SupplierTone {
  if (term === 'Tunai') return 'pine';
  return 'tide';
}

export function getSupplierStatusTone(status: SupplierStatus | string): SupplierTone {
  if (status === 'aktif') return 'pine';
  return 'fog';
}

export function mapSupplierToViewModel(dto: Supplier): SupplierViewModel {
  const contact = dto.contact?.trim() ? dto.contact.trim() : '—';
  const phone = dto.phone?.trim() ? dto.phone.trim() : '—';
  const email = dto.email?.trim() ? dto.email.trim() : null;
  const category = dto.category?.trim() ? dto.category.trim() : '—';

  return {
    id: dto.id,
    business_id: dto.business_id,
    code: dto.code,
    code_badge: dto.code.toUpperCase(),
    name: dto.name || 'Tanpa Nama',
    contact,
    phone,
    email,
    category,
    term: dto.term,
    term_tone: getSupplierTermTone(dto.term),
    status: dto.status,
    status_tone: getSupplierStatusTone(dto.status),
    server_version: dto.server_version,
    created_at: dto.created_at,
    updated_at: dto.updated_at,
    deleted_at: dto.deleted_at,
  };
}

export function mapSupplierSummaryToViewModel(
  dto?: Partial<SupplierSummaryKPI> | null,
  fallbackItems: SupplierViewModel[] = []
): SupplierSummaryKPI {
  if (dto && typeof dto.total_suppliers === 'number') {
    return {
      total_suppliers: dto.total_suppliers,
      active_suppliers: dto.active_suppliers ?? 0,
      inactive_suppliers: dto.inactive_suppliers ?? 0,
    };
  }

  const total = fallbackItems.length;
  const active = fallbackItems.filter((s) => s.status === 'aktif').length;
  const inactive = fallbackItems.filter((s) => s.status === 'nonaktif').length;

  return {
    total_suppliers: total,
    active_suppliers: active,
    inactive_suppliers: inactive,
  };
}

export function mapSuppliersListToViewModel(
  res: SupplierListResponse
): SuppliersListViewModel {
  const items = (res.items || []).map((s) => mapSupplierToViewModel(s));
  const summary = mapSupplierSummaryToViewModel(res.summary, items);

  return {
    items,
    total: typeof res.total === 'number' ? res.total : items.length,
    limit: res.limit || SUPPLIERS_PAGE_SIZE,
    offset: res.offset || 0,
    has_more: !!res.has_more,
    summary,
  };
}

export function filterSuppliers(
  items: SupplierViewModel[],
  filter: SupplierFilterModel
): SupplierViewModel[] {
  const q = filter.search?.trim().toLowerCase() || '';

  if (!q) return items;

  return items.filter((s) => {
    return (
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    );
  });
}

export function formatNullableCell(value: string | null | undefined): string {
  return value ?? '-';
}
