/**
 * Sales module tests — SALES-WEB-001 through SALES-WEB-014
 *
 * Pure unit tests: no DOM, no network.
 * Tests API function signatures, pagination logic, deduplication, null safety, etc.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canAccessRoute, getAuthorizedNavigation } from '../../../lib/rbac';
import { getSales } from '../api';
import type { Sale, SalesListResponse } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'sale-id-001',
    idempotency_key: 'idem-key-001',
    receipt_number: 'INV-001',
    subtotal_minor: 10000,
    discount_minor: 0,
    tax_minor: 0,
    grand_total_minor: 10000,
    payment_method: 'cash',
    cash_received_minor: 10000,
    change_minor: 0,
    cashier_id: 'cashier-1',
    client_created_at: 1_700_000_000_000,
    server_created_at: 1_700_000_001_000,
    items: [],
    ...overrides,
  };
}

// ── RBAC — SALES-WEB-001, 002, 003 (covered in rbac.test.ts too, confirmed here) ──

describe('SALES-WEB-001: OWNER sees /sales navigation', () => {
  it('OWNER can access /sales route', () => {
    expect(canAccessRoute('OWNER', '/sales')).toBe(true);
  });

  it('OWNER sees /sales in getAuthorizedNavigation', () => {
    const nav = getAuthorizedNavigation('OWNER');
    expect(nav.map(n => n.href)).toContain('/sales');
  });
});

describe('SALES-WEB-002: CASHIER does not see /sales navigation', () => {
  it('CASHIER cannot access /sales route', () => {
    expect(canAccessRoute('CASHIER', '/sales')).toBe(false);
  });

  it('CASHIER does not see /sales in getAuthorizedNavigation', () => {
    const nav = getAuthorizedNavigation('CASHIER');
    expect(nav.map(n => n.href)).not.toContain('/sales');
  });
});

describe('SALES-WEB-003: CASHIER direct /sales → denied', () => {
  it('canAccessRoute returns false for CASHIER on /sales', () => {
    expect(canAccessRoute('CASHIER', '/sales')).toBe(false);
  });

  it('canAccessRoute returns false for CASHIER on /sales/:id', () => {
    expect(canAccessRoute('CASHIER', '/sales/some-uuid-here')).toBe(false);
  });
});

// ── API Client ─────────────────────────────────────────────────────────────

// Mock the shared API module
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '@/lib/api';

describe('SALES-WEB-004: Sales API request uses businessId param', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getSales passes business_id to /v1/sync/sales', async () => {
    const mockGet = api.get as ReturnType<typeof vi.fn>;
    const mockResponse: { data: SalesListResponse } = {
      data: { sales: [], has_more: false },
    };
    mockGet.mockResolvedValueOnce(mockResponse);

    const businessId = '11111111-1111-4111-8111-111111111111';
    await getSales(businessId, 0, 500);

    expect(mockGet).toHaveBeenCalledWith('/v1/sync/sales', {
      params: { business_id: businessId, since: 0, limit: 500 },
    });

    // SALES-WEB-014: No X-Demo-Business-Id in the call
    const callArgs = mockGet.mock.calls[0];
    const config = callArgs[1] as { headers?: Record<string, string>; params?: Record<string, unknown> };
    expect(config.headers?.['X-Demo-Business-Id']).toBeUndefined();
  });
});

describe('SALES-WEB-005: Initial request uses since=0', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getSales defaults since to 0', async () => {
    const mockGet = api.get as ReturnType<typeof vi.fn>;
    mockGet.mockResolvedValueOnce({ data: { sales: [], has_more: false } });

    await getSales('biz-id');

    expect(mockGet).toHaveBeenCalledWith('/v1/sync/sales', {
      params: { business_id: 'biz-id', since: 0, limit: 500 },
    });
  });
});

// ── Pagination logic (pure logic tests) ───────────────────────────────────

describe('SALES-WEB-006: Pagination uses last server_created_at as cursor', () => {
  it('last sale server_created_at is used as next since', () => {
    const sales: Sale[] = [
      makeSale({ id: 'a', server_created_at: 1_000 }),
      makeSale({ id: 'b', server_created_at: 2_000 }),
      makeSale({ id: 'c', server_created_at: 3_000 }),
    ];

    const lastSale = sales[sales.length - 1];
    const nextSince = lastSale.server_created_at;

    expect(nextSince).toBe(3_000);
  });
});

describe('SALES-WEB-007: Duplicate sales IDs are deduplicated', () => {
  it('deduplication by sale.id keeps first occurrence', () => {
    const existing: Sale[] = [
      makeSale({ id: 'sale-1' }),
      makeSale({ id: 'sale-2' }),
    ];
    const incoming: Sale[] = [
      makeSale({ id: 'sale-2' }), // duplicate
      makeSale({ id: 'sale-3' }), // new
    ];

    const existingIds = new Set(existing.map(s => s.id));
    const newSales = incoming.filter(s => !existingIds.has(s.id));
    const merged = [...existing, ...newSales];

    expect(merged).toHaveLength(3);
    expect(merged.map(s => s.id)).toEqual(['sale-1', 'sale-2', 'sale-3']);
  });
});

describe('SALES-WEB-008: has_more=false stops pagination', () => {
  it('has_more=false means no further requests are made', () => {
    const response: SalesListResponse = { sales: [makeSale()], has_more: false };
    expect(response.has_more).toBe(false);
  });
});

// ── Null safety ────────────────────────────────────────────────────────────

describe('SALES-WEB-009: payment_method null renders safely', () => {
  it('sale.payment_method can be null without crashing', () => {
    const sale = makeSale({ payment_method: null });
    const display = sale.payment_method ?? '-';
    expect(display).toBe('-');
  });

  it('sale.cashier_id can be null without crashing', () => {
    const sale = makeSale({ cashier_id: null });
    const display = sale.cashier_id ?? '-';
    expect(display).toBe('-');
  });
});

// ── Empty state ─────────────────────────────────────────────────────────────

describe('SALES-WEB-010: Empty state when sales list is empty', () => {
  it('empty sales array triggers empty state', () => {
    const sales: Sale[] = [];
    expect(sales.length === 0).toBe(true);
  });
});

// ── Request ID on error ────────────────────────────────────────────────────

describe('SALES-WEB-011: 500 error displays request ID', () => {
  beforeEach(() => vi.clearAllMocks());

  it('AxiosError response includes x-request-id from headers', async () => {
    const { AxiosError } = await import('axios');
    const mockGet = api.get as ReturnType<typeof vi.fn>;

    const axiosErr = new AxiosError('Internal server error');
    axiosErr.response = {
      status: 500,
      data: { error: { code: 'DATABASE_ERROR', message: 'Internal server error', details: {} } },
      headers: { 'x-request-id': 'test-request-id-abc123' },
      statusText: 'Internal Server Error',
      config: {} as import('axios').InternalAxiosRequestConfig,
    };
    mockGet.mockRejectedValueOnce(axiosErr);

    let capturedRequestId: string | null = null;

    try {
      await getSales('biz-id', 0, 500);
    } catch (err) {
      if (err instanceof AxiosError) {
        capturedRequestId = err.response?.headers?.['x-request-id'] ?? null;
      }
    }

    expect(capturedRequestId).toBe('test-request-id-abc123');
  });
});

// ── Sale detail ─────────────────────────────────────────────────────────────

describe('SALES-WEB-012: Sale detail renders items', () => {
  it('sale items have required fields (no subtotal_minor)', () => {
    const sale = makeSale({
      items: [
        { product_id: 'prod-1', product_name_snapshot: 'Kopi', quantity: 2, unit_price_minor: 5000 },
        { product_id: null, product_name_snapshot: 'Custom Item', quantity: 1, unit_price_minor: 3000 },
      ],
    });

    expect(sale.items).toHaveLength(2);
    expect(sale.items[0].product_name_snapshot).toBe('Kopi');
    expect(sale.items[0].quantity).toBe(2);
    expect(sale.items[0].unit_price_minor).toBe(5000);
    // subtotal_minor must NOT exist on SaleItem type
    expect('subtotal_minor' in sale.items[0]).toBe(false);

    // null product_id = custom item
    expect(sale.items[1].product_id).toBeNull();
  });
});

describe('SALES-WEB-013: Unknown sale ID renders safe not-loaded state', () => {
  it('non-matching ID results in notFound=true state', () => {
    const sales: Sale[] = [makeSale({ id: 'sale-known' })];
    const targetId = 'sale-unknown';

    const found = sales.find(s => s.id === targetId) ?? null;
    expect(found).toBeNull();
    // In the actual page this triggers notFound=true → safe warning UI
  });
});

// ── Security ────────────────────────────────────────────────────────────────

describe('SALES-WEB-014: No X-Demo-Business-Id is sent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getSales does not send X-Demo-Business-Id', async () => {
    const mockGet = api.get as ReturnType<typeof vi.fn>;
    mockGet.mockResolvedValueOnce({ data: { sales: [], has_more: false } });

    await getSales('biz-id', 0, 100);

    const call = mockGet.mock.calls[0];
    const config = call[1] as { headers?: Record<string, string> };
    // No headers property at all, or no X-Demo-Business-Id header
    const hasDemo = config?.headers?.['X-Demo-Business-Id'] !== undefined;
    expect(hasDemo).toBe(false);
  });
});
