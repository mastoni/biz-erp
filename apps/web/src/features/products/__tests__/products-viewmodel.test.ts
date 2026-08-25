/**
 * Phase 3C — Products ViewModel & Data Layer Suite
 * PRODUCT-VM-001 through PRODUCT-VM-017
 *
 * Pure unit tests: mocks @/lib/api, tests ViewModel mapping + API client params
 * + error classification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import { api } from '@/lib/api';
import {
  calculateMargin,
  getStockStatus,
  mapProductToViewModel,
  mapStockToViewModel,
  enrichWithStock,
  classifyProductError,
  isSkuConflict,
  isBarcodeConflict,
  isVersionConflict,
} from '../viewmodel';
import { fetchProducts, fetchProduct, fetchProductStock } from '../api';
import {
  mapProductListToViewModel,
} from '../viewmodel';
import type { Product } from '../types';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

const BUSINESS_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BRANCH_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const baseProduct: Product = {
  id: 'p1',
  business_id: BUSINESS_ID,
  name: 'Kopi Susu Gula Aren',
  description: 'Kopi dengan gula aren',
  sku: 'SKU-001',
  price_minor: 15000,
  cost_minor: 8000,
  category: 'Minuman',
  barcode: 'barcode-001',
  is_active: true,
  server_version: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── ViewModel mapping ──────────────────────────────────────────────────────

describe('PRODUCT-VM-001: map product response correctly', () => {
  it('maps all canonical fields from API Product to ProductViewModel', () => {
    const vm = mapProductToViewModel(baseProduct);

    expect(vm.id).toBe('p1');
    expect(vm.name).toBe('Kopi Susu Gula Aren');
    expect(vm.description).toBe('Kopi dengan gula aren');
    expect(vm.sku).toBe('SKU-001');
    expect(vm.category).toBe('Minuman');
    expect(vm.barcode).toBe('barcode-001');
    expect(vm.price_minor).toBe(15000);
    expect(vm.cost_minor).toBe(8000);
    expect(vm.is_active).toBe(true);
    expect(vm.server_version).toBe(1);
    expect(vm.created_at).toBe('2026-01-01T00:00:00Z');
    expect(vm.updated_at).toBe('2026-01-01T00:00:00Z');
    expect(vm.stock_quantity).toBeNull();
    expect(vm.stock_status).toBe('unknown');
  });
});

// ── Margin calculation ─────────────────────────────────────────────────────

describe('PRODUCT-VM-002: calculate margin_minor correctly', () => {
  it('computes margin_minor = price_minor - cost_minor', () => {
    const result = calculateMargin(15000, 8000);
    expect(result.margin_minor).toBe(7000);
  });

  it('computes margin_percent = (margin / cost) * 100', () => {
    const result = calculateMargin(15000, 8000);
    expect(result.margin_percent).toBe(87.5);
  });
});

describe('PRODUCT-VM-003: cost_minor null → null margin', () => {
  it('returns null for both margin_minor and margin_percent when cost is null', () => {
    const result = calculateMargin(15000, null);
    expect(result.margin_minor).toBeNull();
    expect(result.margin_percent).toBeNull();
  });
});

describe('PRODUCT-VM-004: cost_minor zero → null percentage', () => {
  it('returns margin_minor as price and margin_percent as null when cost is zero', () => {
    const result = calculateMargin(15000, 0);
    expect(result.margin_minor).toBe(15000);
    expect(result.margin_percent).toBeNull();
  });
});

// ── Stock mapping ───────────────────────────────────────────────────────────

describe('PRODUCT-VM-005: map branch stock correctly', () => {
  it('maps stock DTO to ProductStockViewModel', () => {
    const stock = mapStockToViewModel({
      product_id: 'p1',
      branch_id: BRANCH_ID,
      quantity: 42,
    });

    expect(stock.product_id).toBe('p1');
    expect(stock.branch_id).toBe(BRANCH_ID);
    expect(stock.quantity).toBe(42);
  });

  it('enriches ViewModel with branch-scoped stock', () => {
    const vm = mapProductToViewModel(baseProduct);
    const enriched = enrichWithStock(vm, {
      product_id: 'p1',
      branch_id: BRANCH_ID,
      quantity: 42,
    });

    expect(enriched.stock_quantity).toBe(42);
    expect(enriched.stock_status).toBe('in_stock');
  });
});

describe('PRODUCT-VM-009: pagination mapping', () => {
  it('maps list response to ProductListViewModel with correct pagination metadata', () => {
    const vm = mapProductListToViewModel([baseProduct, baseProduct], 100, 20, 40, true);

    expect(vm.items.length).toBe(2);
    expect(vm.total).toBe(100);
    expect(vm.limit).toBe(20);
    expect(vm.offset).toBe(40);
    expect(vm.has_more).toBe(true);
  });

  it('maps empty list correctly', () => {
    const vm = mapProductListToViewModel([], 0, 20, 0, false);

    expect(vm.items).toEqual([]);
    expect(vm.total).toBe(0);
    expect(vm.limit).toBe(20);
    expect(vm.offset).toBe(0);
    expect(vm.has_more).toBe(false);
  });
});

// ── Stock status logic ─────────────────────────────────────────────────────

describe('stock_status derivation', () => {
  it('in_stock when quantity > threshold', () => {
    expect(getStockStatus(50)).toBe('in_stock');
  });

  it('low_stock when quantity <= LOW_STOCK_THRESHOLD', () => {
    expect(getStockStatus(5)).toBe('low_stock');
    expect(getStockStatus(1)).toBe('low_stock');
  });

  it('out_of_stock when quantity is 0', () => {
    expect(getStockStatus(0)).toBe('out_of_stock');
  });

  it('unknown when quantity is null', () => {
    expect(getStockStatus(null)).toBe('unknown');
  });
});

// ── API client: query params ──────────────────────────────────────────────

describe('PRODUCT-VM-006: search parameter sent correctly', () => {
  it('sends search param to /v1/products', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { items: [], total: 0, limit: 20, offset: 0, has_more: false },
    });

    await fetchProducts({ business_id: BUSINESS_ID, search: 'Widget' });

    expect(api.get).toHaveBeenCalledWith(
      '/v1/products',
      expect.objectContaining({ params: expect.objectContaining({ search: 'Widget' }) }),
    );
  });
});

describe('PRODUCT-VM-007: category filter sent correctly', () => {
  it('sends category param to /v1/products', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { items: [], total: 0, limit: 20, offset: 0, has_more: false },
    });

    await fetchProducts({ business_id: BUSINESS_ID, category: 'Minuman' });

    expect(api.get).toHaveBeenCalledWith(
      '/v1/products',
      expect.objectContaining({ params: expect.objectContaining({ category: 'Minuman' }) }),
    );
  });
});

describe('PRODUCT-VM-008: barcode filter sent correctly', () => {
  it('sends barcode param to /v1/products', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { items: [], total: 0, limit: 20, offset: 0, has_more: false },
    });

    await fetchProducts({ business_id: BUSINESS_ID, barcode: 'barcode-001' });

    expect(api.get).toHaveBeenCalledWith(
      '/v1/products',
      expect.objectContaining({ params: expect.objectContaining({ barcode: 'barcode-001' }) }),
    );
  });
});

describe('PRODUCT-VM-006+007+008: combined filter + pagination params', () => {
  it('sends all params together with correct keys', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { items: [], total: 0, limit: 20, offset: 0, has_more: false },
    });

    await fetchProducts({
      business_id: BUSINESS_ID,
      search: 'Widget',
      category: 'Minuman',
      barcode: 'bc-1',
      limit: 20,
      offset: 40,
    });

    expect(api.get).toHaveBeenCalledWith(
      '/v1/products',
      expect.objectContaining({
        params: expect.objectContaining({
          business_id: BUSINESS_ID,
          search: 'Widget',
          category: 'Minuman',
          barcode: 'bc-1',
          limit: 20,
          offset: 40,
        }),
      }),
    );
  });
});

// ── API client: fetchProduct ────────────────────────────────────────────────

describe('PRODUCT-VM-001+ (via fetchProduct): maps single product response', () => {
  it('fetches /v1/products/:id with business_id tenant context and returns ViewModel', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: baseProduct });

    const vm = await fetchProduct('p1', BUSINESS_ID);

    expect(api.get).toHaveBeenCalledWith('/v1/products/p1', { params: { business_id: BUSINESS_ID } });
    expect(vm.id).toBe('p1');
    expect(vm.name).toBe('Kopi Susu Gula Aren');
    expect(vm.margin_minor).toBe(7000);
    expect(vm.margin_percent).toBe(87.5);
  });
});

// ── API client: fetchProductStock ───────────────────────────────────────────

describe('PRODUCT-VM-016: branch change fetches stock for new branch', () => {
  it('fetches stock for productId + new branchId', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { product_id: 'p1', branch_id: BRANCH_ID, quantity: 30 },
    });

    const stock = await fetchProductStock('p1', BRANCH_ID, BUSINESS_ID);

    expect(api.get).toHaveBeenCalledWith('/v1/inventory/stock', {
      params: {
        business_id: BUSINESS_ID,
        branch_id: BRANCH_ID,
        product_id: 'p1',
      },
    });
    expect(stock.product_id).toBe('p1');
    expect(stock.branch_id).toBe(BRANCH_ID);
    expect(stock.quantity).toBe(30);
  });
});

// ── Mutation: create ────────────────────────────────────────────────────────

describe('PRODUCT-VM-010: create product payload', () => {
  it('sends POST to /v1/sync/products with idempotency key', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: baseProduct });

    // Reuse the existing createProduct from api.ts
    const { createProduct } = await import('../api');

    const payload = {
      id: 'p1',
      business_id: BUSINESS_ID,
      name: 'Kopi Susu Gula Aren',
      price_minor: 15000,
    };

    await createProduct(payload, 'idempotency-key-123');

    expect(api.post).toHaveBeenCalledWith(
      '/v1/sync/products',
      payload,
      { headers: { 'Idempotency-Key': 'idempotency-key-123' } },
    );
  });
});

// ── Mutation: update ─────────────────────────────────────────────────────────

describe('PRODUCT-VM-011: update product payload with expected_server_version', () => {
  it('sends PUT to /v1/sync/products/:id with expected_server_version', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: baseProduct });

    const { updateProduct } = await import('../api');

    const payload = {
      business_id: BUSINESS_ID,
      expected_server_version: 1,
      name: 'Updated Name',
      price_minor: 16000,
    };

    await updateProduct('p1', payload);

    expect(api.put).toHaveBeenCalledWith('/v1/sync/products/p1', payload);
  });
});

// ── Mutation: deactivate ─────────────────────────────────────────────────────

describe('PRODUCT-VM-015: deactivate product state', () => {
  it('sends is_active=false with expected_server_version', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: { ...baseProduct, is_active: false } });

    const { deactivateProduct } = await import('../api');

    await deactivateProduct('p1', BUSINESS_ID, 1);

    expect(api.put).toHaveBeenCalledWith('/v1/sync/products/p1', {
      business_id: BUSINESS_ID,
      expected_server_version: 1,
      is_active: false,
    });
  });
});

// ── Error classification ────────────────────────────────────────────────────

function makeAxiosError(status: number, data: unknown): AxiosError {
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: 'Error',
    headers: {},
    config: { headers: {} } as never,
    data: data as never,
  } as never);
}

describe('PRODUCT-VM-012: SKU conflict becomes controlled error', () => {
  it('classifies 409 SKU_CONFLICT as sku_conflict error type', () => {
    const err = makeAxiosError(409, {
      error: {
        code: 'SKU_CONFLICT',
        message: 'SKU already exists',
        details: { sku: 'SKU-001' },
      },
    });

    const classified = classifyProductError(err);

    expect(classified.type).toBe('sku_conflict');
    expect(classified.message).toBe('SKU already exists');
    expect((classified as { sku: string | null }).sku).toBe('SKU-001');
    expect(isSkuConflict(classified)).toBe(true);
  });
});

describe('PRODUCT-VM-013: barcode conflict becomes controlled error', () => {
  it('classifies 409 BARCODE_CONFLICT as barcode_conflict error type', () => {
    const err = makeAxiosError(409, {
      error: {
        code: 'BARCODE_CONFLICT',
        message: 'Barcode already exists',
        details: { barcode: 'barcode-001' },
      },
    });

    const classified = classifyProductError(err);

    expect(classified.type).toBe('barcode_conflict');
    expect(classified.message).toBe('Barcode already exists');
    expect((classified as { barcode: string | null }).barcode).toBe('barcode-001');
    expect(isBarcodeConflict(classified)).toBe(true);
  });
});

describe('PRODUCT-VM-014: VERSION_CONFLICT becomes controlled state', () => {
  it('classifies 409 VERSION_CONFLICT as version_conflict error type', () => {
    const err = makeAxiosError(409, {
      error: {
        code: 'VERSION_CONFLICT',
        message: 'Stale version',
        details: {
          expected_server_version: 5,
          current_server_version: 10,
        },
      },
    });

    const classified = classifyProductError(err);

    expect(classified.type).toBe('version_conflict');
    expect((classified as { expected: number; current: number }).expected).toBe(5);
    expect((classified as { expected: number; current: number }).current).toBe(10);
    expect(isVersionConflict(classified)).toBe(true);
  });
});

// ── Tenant/branch scope ────────────────────────────────────────────────────

describe('PRODUCT-VM-016: branch change fetches stock for new branch', () => {
  it('stock fetch uses the new branchId, not a stale one', async () => {
    const OTHER_BRANCH = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

    vi.mocked(api.get).mockResolvedValueOnce({
      data: { product_id: 'p1', branch_id: OTHER_BRANCH, quantity: 30 },
    });

    const stock = await fetchProductStock('p1', OTHER_BRANCH, BUSINESS_ID);

    expect(api.get).toHaveBeenCalledWith(
      '/v1/inventory/stock',
      expect.objectContaining({
        params: expect.objectContaining({ branch_id: OTHER_BRANCH }),
      }),
    );
    expect(stock.branch_id).toBe(OTHER_BRANCH);
  });
});

describe('PRODUCT-VM-017: tenant change clears previous product state', () => {
  it('fetchProducts returns a fresh ViewModel with new business_id', async () => {
    const NEW_TENANT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

    vi.mocked(api.get).mockResolvedValueOnce({
      data: { items: [baseProduct], total: 1, limit: 20, offset: 0, has_more: false },
    });

    const vm = await fetchProducts({ business_id: NEW_TENANT, limit: 20, offset: 0 });

    expect(api.get).toHaveBeenCalledWith(
      '/v1/products',
      expect.objectContaining({
        params: expect.objectContaining({ business_id: NEW_TENANT }),
      }),
    );
    expect(vm.items[0].id).toBe('p1');
  });
});
