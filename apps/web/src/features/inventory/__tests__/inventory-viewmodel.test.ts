/**
 * Phase 4C — Inventory ViewModel & Data Layer Suite
 * INVENTORY-VM-001 through INVENTORY-VM-016
 *
 * Pure unit tests: mocks @/lib/api, tests ViewModel mapping + API client params
 * + adjustment payload composition + error classification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import { api } from '@/lib/api';
import {
  getStockStatus,
  formatInventoryStatus,
  calculateStockValue,
  mapStockRowToInventoryStockViewModel,
  mapMovementToInventoryMovementViewModel,
  buildInventoryAdjustmentPayload,
  classifyInventoryMutationError,
  deriveInventoryDataState,
  LOW_STOCK_THRESHOLD,
} from '../inventory-helpers';
import {
  fetchInventorySummary,
  fetchInventoryStocks,
  adjustInventory,
} from '../api';
import type { StockMovement, StockWithProduct } from '../types';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const BRANCH_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PRODUCT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const baseStockRow: StockWithProduct = {
  id: 's1',
  business_id: TENANT_ID,
  branch_id: BRANCH_ID,
  product_id: 'p1',
  product_name: 'Kopi Susu Gula Aren',
  sku: 'SKU-001',
  category: 'Minuman',
  barcode: 'barcode-001',
  price_minor: 15000,
  cost_minor: 8000,
  quantity: 42,
  server_version: 3,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Summary mapping ────────────────────────────────────────────────────────

describe('INVENTORY-VM-001: summary mapping', () => {
  it('maps summary preserving raw integer minor currency', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        total_stock_value_minor: 123456,
        low_stock_count: 2,
        out_of_stock_count: 1,
        total_skus: 10,
      },
    });

    const summary = await fetchInventorySummary(BRANCH_ID, TENANT_ID);

    expect(api.get).toHaveBeenCalledWith('/v1/inventory/summary', {
      params: { business_id: TENANT_ID, branch_id: BRANCH_ID },
    });
    expect(summary.total_stock_value_minor).toBe(123456);
    expect(summary.low_stock_count).toBe(2);
    expect(summary.out_of_stock_count).toBe(1);
    expect(summary.total_skus).toBe(10);
    expect(Number.isInteger(summary.total_stock_value_minor)).toBe(true);
  });
});

// ── Stock mapping ──────────────────────────────────────────────────────────

describe('INVENTORY-VM-002: stock mapping with product metadata', () => {
  it('maps canonical fields plus derived stock_status', () => {
    const vm = mapStockRowToInventoryStockViewModel(baseStockRow);

    expect(vm.product_id).toBe('p1');
    expect(vm.product_name).toBe('Kopi Susu Gula Aren');
    expect(vm.sku).toBe('SKU-001');
    expect(vm.category).toBe('Minuman');
    expect(vm.barcode).toBe('barcode-001');
    expect(vm.price_minor).toBe(15000);
    expect(vm.cost_minor).toBe(8000);
    expect(vm.quantity).toBe(42);
    expect(vm.server_version).toBe(3);
    expect(vm.updated_at).toBe('2026-01-02T00:00:00Z');
    expect(vm.stock_status).toBe('in_stock');
  });
});

// ── Stock status derivation ────────────────────────────────────────────────

describe('INVENTORY-VM-003: out-of-stock status', () => {
  it('classifies quantity 0 as out_of_stock', () => {
    expect(getStockStatus(0)).toBe('out_of_stock');
  });

  it('uses the single canonical threshold constant of 5', () => {
    expect(LOW_STOCK_THRESHOLD).toBe(5);
  });
});

describe('INVENTORY-VM-004: low-stock status', () => {
  it('classifies 1..LOW_STOCK_THRESHOLD as low_stock (boundary inclusive)', () => {
    expect(getStockStatus(1)).toBe('low_stock');
    expect(getStockStatus(LOW_STOCK_THRESHOLD)).toBe('low_stock');
  });
});

describe('INVENTORY-VM-005: in-stock status', () => {
  it('classifies anything above the threshold as in_stock', () => {
    expect(getStockStatus(LOW_STOCK_THRESHOLD + 1)).toBe('in_stock');
    expect(getStockStatus(500)).toBe('in_stock');
  });

  it('formats statuses for display without touching currency', () => {
    expect(formatInventoryStatus('in_stock')).toBe('In stock');
    expect(formatInventoryStatus('low_stock')).toBe('Low stock');
    expect(formatInventoryStatus('out_of_stock')).toBe('Out of stock');
  });
});

// ── Stock value calculation ────────────────────────────────────────────────

describe('INVENTORY-VM-006: stock value calculation', () => {
  it('computes price_minor * quantity in minor units', () => {
    expect(calculateStockValue(15000, 3)).toBe(45000);
  });

  it('yields 0 for zero quantity and preserves 0 price', () => {
    expect(calculateStockValue(15000, 0)).toBe(0);
    expect(calculateStockValue(0, 42)).toBe(0);
  });
});

// ── Movement mapping ───────────────────────────────────────────────────────

function baseMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: 'm1',
    business_id: TENANT_ID,
    branch_id: BRANCH_ID,
    product_id: 'p1',
    quantity: 5,
    movement_type: 'ADJUSTMENT',
    reference: 'init-stock',
    actor: 'owner-user-id',
    timestamp: '2026-01-03T08:00:00Z',
    ...overrides,
  };
}

describe('INVENTORY-VM-007: movement mapping', () => {
  it('maps canonical movement fields; product_name null unless enriched', () => {
    const vm = mapMovementToInventoryMovementViewModel(baseMovement());

    expect(vm.id).toBe('m1');
    expect(vm.branch_id).toBe(BRANCH_ID);
    expect(vm.product_id).toBe('p1');
    expect(vm.product_name).toBeNull();
    expect(vm.quantity).toBe(5);
    expect(vm.movement_type).toBe('ADJUSTMENT');
    expect(vm.reference).toBe('init-stock');
    expect(vm.actor).toBe('owner-user-id');
    expect(vm.timestamp).toBe('2026-01-03T08:00:00Z');
  });
});

describe('INVENTORY-VM-008: STOCK_IN mapping', () => {
  it('preserves STOCK_IN type and positive server-side delta', () => {
    const vm = mapMovementToInventoryMovementViewModel(
      baseMovement({ movement_type: 'STOCK_IN', quantity: 25, reference: 'po-1' })
    );

    expect(vm.movement_type).toBe('STOCK_IN');
    expect(vm.quantity).toBe(25);
    expect(vm.reference).toBe('po-1');
  });
});

describe('INVENTORY-VM-009: STOCK_OUT mapping', () => {
  it('preserves STOCK_OUT type and negative server-side ledger delta', () => {
    // Server stores the ledger delta already negated for STOCK_OUT.
    const vm = mapMovementToInventoryMovementViewModel(
      baseMovement({ movement_type: 'STOCK_OUT', quantity: -4, reference: 'sale-9' })
    );

    expect(vm.movement_type).toBe('STOCK_OUT');
    expect(vm.quantity).toBe(-4);
  });
});

// ── Adjustment payload composition ─────────────────────────────────────────

const form = {
  product_id: PRODUCT_ID,
  quantity_change: 12,
  movement_type: 'STOCK_IN' as const,
  reference: '  po-77  ',
  expected_server_version: 7,
};

describe('INVENTORY-VM-010: adjustment payload', () => {
  it('composes full server payload with context-provided ids', () => {
    const payload = buildInventoryAdjustmentPayload(form, TENANT_ID, BRANCH_ID);

    expect(payload).toEqual({
      business_id: TENANT_ID,
      branch_id: BRANCH_ID,
      product_id: PRODUCT_ID,
      quantity_change: 12,
      expected_server_version: 7,
      reference: 'po-77',
      movement_type: 'STOCK_IN',
    });
  });

  it('adjustInventory sends POST with Idempotency-Key header', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { stock: {}, movement: {} },
    });

    await adjustInventory(
      buildInventoryAdjustmentPayload(form, TENANT_ID, BRANCH_ID),
      'idem-key-1'
    );

    expect(api.post).toHaveBeenCalledWith(
      '/v1/inventory/adjustment',
      expect.objectContaining({ product_id: PRODUCT_ID, movement_type: 'STOCK_IN' }),
      { headers: { 'Idempotency-Key': 'idem-key-1' } }
    );
  });
});

describe('INVENTORY-VM-011: expected_server_version preserved', () => {
  it('passes expected_server_version through verbatim', () => {
    const payload = buildInventoryAdjustmentPayload(
      { ...form, expected_server_version: 41 },
      TENANT_ID,
      BRANCH_ID
    );

    expect(payload.expected_server_version).toBe(41);
  });
});

// ── Error classification ───────────────────────────────────────────────────

function makeAxiosError(status: number, data: unknown): AxiosError {
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: 'Error',
    headers: {},
    config: { headers: {} } as never,
    data: data as never,
  } as never);
}

describe('INVENTORY-VM-012: conflict error classification', () => {
  it('classifies HTTP 409 as conflict and never overwrites silently', () => {
    const classified = classifyInventoryMutationError(
      makeAxiosError(409, { error: { code: 'CONFLICT', message: 'server_version mismatch' } })
    );

    expect(classified.type).toBe('conflict');
    expect(classified.message).toBe('server_version mismatch');
  });

  it('classifies HTTP 400 negative stock as validation error', () => {
    const classified = classifyInventoryMutationError(
      makeAxiosError(400, { error: { message: 'Negative stock is prohibited' } })
    );

    expect(classified.type).toBe('validation');
  });
});

// ── Empty / reload / scope semantics ───────────────────────────────────────

describe('INVENTORY-VM-013: empty branch state', () => {
  it('maps an empty stock dataset to an empty list view model', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [] } });

    const list = await fetchInventoryStocks(BRANCH_ID, TENANT_ID);

    expect(list.items).toEqual([]);
    expect(list.total).toBe(0);
    expect(list.has_more).toBe(false);
    expect(deriveInventoryDataState(false, null, list.items.length)).toBe('empty');
  });
});

describe('INVENTORY-VM-014: tenant change clears inventory state', () => {
  it('refetches with the NEW tenant business_id only', async () => {
    const NEW_TENANT = '22222222-2222-4222-8222-222222222222';

    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [baseStockRow] } });

    const list = await fetchInventoryStocks(BRANCH_ID, NEW_TENANT);

    expect(api.get).toHaveBeenCalledWith(
      '/v1/inventory/stocks',
      expect.objectContaining({
        params: expect.objectContaining({ business_id: NEW_TENANT }),
      }),
    );
    // The old tenant id must not appear anywhere in the request.
    const call = vi.mocked(api.get).mock.calls[0];
    expect(JSON.stringify(call)).not.toContain(TENANT_ID);
    expect(list.items[0].product_id).toBe('p1');
  });
});

describe('INVENTORY-VM-015: branch change reloads stock', () => {
  it('fetches stocks scoped to the newly active branch', async () => {
    const OTHER_BRANCH = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [] } });

    await fetchInventoryStocks(OTHER_BRANCH, TENANT_ID);

    expect(api.get).toHaveBeenCalledWith(
      '/v1/inventory/stocks',
      expect.objectContaining({
        params: expect.objectContaining({ branch_id: OTHER_BRANCH, business_id: TENANT_ID }),
      }),
    );
  });
});

describe('INVENTORY-VM-016: no fake business/branch IDs', () => {
  it('rejects missing or placeholder ids in payload composition', () => {
    expect(() => buildInventoryAdjustmentPayload(form, '', BRANCH_ID)).toThrow(/business_id/);
    expect(() => buildInventoryAdjustmentPayload(form, 'not-a-uuid', BRANCH_ID)).toThrow(/business_id/);
    expect(() => buildInventoryAdjustmentPayload(form, TENANT_ID, '')).toThrow(/branch_id/);
    expect(() =>
      buildInventoryAdjustmentPayload({ ...form, product_id: '' }, TENANT_ID, BRANCH_ID)
    ).toThrow(/product_id/);
  });

  it('data layer passes context ids through unmodified', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [] } });

    await fetchInventoryStocks(BRANCH_ID, TENANT_ID, { product_id: 'p1' });

    expect(api.get).toHaveBeenCalledWith(
      '/v1/inventory/stocks',
      expect.objectContaining({
        params: expect.objectContaining({
          business_id: TENANT_ID,
          branch_id: BRANCH_ID,
          product_ids: 'p1',
        }),
      }),
    );
  });
});
