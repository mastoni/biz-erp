/**
 * Customer ViewModel helpers and pure business logic.
 *
 * Provides mapping, tier color tones, avatar initials, relative date formatting,
 * and client-side filtering matching the ERP-DESIGN V1 blueprint.
 */
import type {
  Customer,
  CustomerFilterModel,
  CustomerListResponse,
  CustomerSummaryKPI,
  CustomerTier,
  CustomerViewModel,
  CustomersListViewModel,
} from './types';

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
 * Maps CustomerTier to blueprint badge tone color.
 * Gold -> honey, Silver -> tide, Reguler -> fog
 */
export function getCustomerTierTone(tier: CustomerTier | string): 'honey' | 'tide' | 'fog' {
  if (tier === 'Gold') return 'honey';
  if (tier === 'Silver') return 'tide';
  return 'fog';
}

/**
 * Extracts 2-letter uppercase initials from customer name deterministically.
 */
export function getCustomerInitials(name: string): string {
  if (!name || typeof name !== 'string') return 'PL';
  const clean = name.trim();
  if (!clean) return 'PL';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

/**
 * Computes calendar-based relative visit time from epoch ms timestamp.
 * e.g. "Hari ini", "Kemarin", "2 hari lalu", "Belum ada kunjungan"
 */
export function formatRelativeCustomerVisit(
  epochMs: number | null | undefined,
  nowEpoch: number = Date.now()
): string {
  if (!epochMs || typeof epochMs !== 'number' || isNaN(epochMs)) {
    return 'Belum ada kunjungan';
  }

  const visitDate = new Date(epochMs);
  const nowDate = new Date(nowEpoch);

  // Normalize to UTC calendar dates for day difference
  const utcVisit = Date.UTC(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate());
  const utcNow = Date.UTC(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((utcNow - utcVisit) / msPerDay);

  if (diffDays <= 0) {
    return 'Hari ini';
  }
  if (diffDays === 1) {
    return 'Kemarin';
  }
  if (diffDays < 30) {
    return `${diffDays} hari lalu`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} bulan lalu`;
  }
  return 'Lebih dari setahun lalu';
}

/**
 * Derives a customer display code (e.g. CST-001) for UI ledger readability.
 * Mark as derived display code from index or short UUID prefix.
 */
export function deriveCustomerCode(id: string, index?: number): string {
  if (typeof index === 'number') {
    return `CST-${String(index + 1).padStart(3, '0')}`;
  }
  if (id && id.length >= 6) {
    return `CST-${id.slice(0, 4).toUpperCase()}`;
  }
  return id || 'CST-001';
}

/**
 * Converts a raw backend Customer DTO into a CustomerViewModel.
 */
export function mapCustomerToViewModel(
  dto: Customer,
  index = 0,
  nowEpoch: number = Date.now()
): CustomerViewModel {
  const tier: CustomerTier = dto.tier === 'Gold' || dto.tier === 'Silver' ? dto.tier : 'Reguler';
  const points = typeof dto.points === 'number' && dto.points >= 0 ? dto.points : 0;
  const spendMinor = typeof dto.spend_minor === 'number' && dto.spend_minor >= 0 ? dto.spend_minor : 0;

  return {
    id: dto.id,
    code: deriveCustomerCode(dto.id, index),
    name: dto.name || 'Tanpa Nama',
    phone: dto.phone?.trim() ? dto.phone.trim() : '—',
    email: dto.email?.trim() ? dto.email.trim() : null,
    tier,
    points,
    spend_minor: spendMinor,
    last_visit: formatRelativeCustomerVisit(dto.last_visit_epoch, nowEpoch),
    last_visit_epoch: dto.last_visit_epoch ?? null,
    initials: getCustomerInitials(dto.name),
    tier_tone: getCustomerTierTone(tier),
  };
}

/**
 * Maps raw summary DTO to CustomerSummaryKPI with safe defaults.
 */
export function mapCustomerSummaryToViewModel(
  dto?: Partial<CustomerSummaryKPI> | null,
  fallbackItems: CustomerViewModel[] = []
): CustomerSummaryKPI {
  if (dto && typeof dto.total_customers === 'number') {
    return {
      total_customers: dto.total_customers,
      gold_members: dto.gold_members ?? 0,
      silver_members: dto.silver_members ?? 0,
      regular_members: dto.regular_members ?? 0,
      monthly_spend_minor: dto.monthly_spend_minor ?? 0,
    };
  }

  // Derive from fallback loaded items if summary endpoint is pending
  const total = fallbackItems.length;
  const gold = fallbackItems.filter((c) => c.tier === 'Gold').length;
  const silver = fallbackItems.filter((c) => c.tier === 'Silver').length;
  const regular = fallbackItems.filter((c) => c.tier === 'Reguler').length;
  const spend = fallbackItems.reduce((sum, c) => sum + c.spend_minor, 0);

  return {
    total_customers: total,
    gold_members: gold,
    silver_members: silver,
    regular_members: regular,
    monthly_spend_minor: spend,
  };
}

/**
 * Maps raw CustomerListResponse to CustomersListViewModel.
 */
export function mapCustomersListToViewModel(
  res: CustomerListResponse,
  nowEpoch: number = Date.now()
): CustomersListViewModel {
  const items = (res.items || []).map((c, i) => mapCustomerToViewModel(c, i + (res.offset || 0), nowEpoch));
  const summary = mapCustomerSummaryToViewModel(res.summary, items);

  return {
    items,
    total: typeof res.total === 'number' ? res.total : items.length,
    limit: res.limit || 20,
    offset: res.offset || 0,
    has_more: !!res.has_more,
    summary,
  };
}

/**
 * Filters loaded customer items by search query and tier filter.
 */
export function filterCustomers(
  items: CustomerViewModel[],
  filter: CustomerFilterModel
): CustomerViewModel[] {
  const q = filter.search?.trim().toLowerCase() || '';
  const tier = filter.tier || 'Semua';

  return items.filter((c) => {
    // Tier filter
    if (tier !== 'Semua' && c.tier !== tier) {
      return false;
    }

    // Search query
    if (q) {
      const matchName = c.name.toLowerCase().includes(q);
      const matchPhone = c.phone.toLowerCase().includes(q);
      const matchCode = c.code.toLowerCase().includes(q);
      const matchId = c.id.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchCode && !matchId) {
        return false;
      }
    }

    return true;
  });
}
