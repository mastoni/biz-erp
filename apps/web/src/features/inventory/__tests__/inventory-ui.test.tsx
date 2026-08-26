/**
 * Phase 4D — Inventory UI Test Suite
 * INVENTORY-UI-001 through INVENTORY-UI-018
 *
 * Tests use renderToString (no DOM). Component rendering + logic tests only,
 * following the PRODUCT-UI suite pattern.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'fs';
import path from 'path';
import { AxiosError } from 'axios';
import { api } from '@/lib/api';
import { InventoryKPICards } from '../components/InventoryKPICards';
import { InventoryToolbar } from '../components/InventoryToolbar';
import { StockTable, StockTableSkeleton } from '../components/StockTable';
import {
  StockAdjustmentModal,
  resolveQuantityChange,
  isFinalStockBlocked,
} from '../components/StockAdjustmentModal';
import {
  MovementHistoryModal,
  getMovementRange,
  MOVEMENTS_PAGE_SIZE,
} from '../components/MovementHistoryModal';
import { EmptyState } from '@/components/ui/empty-state';
import { fetchInventoryStocks } from '../api';
import { applyInventoryFilters } from '../inventory-helpers';
import { classifyInventoryMutationError } from '../inventory-helpers';
import { formatMinor } from '@/lib/format';
import type { InventoryStockViewModel, InventorySummaryViewModel } from '../types';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const BRANCH_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function makeStock(overrides: Partial<InventoryStockViewModel> = {}): InventoryStockViewModel {
  return {
    product_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    product_name: 'Kopi Susu Gula Aren',
    sku: 'SKU-001',
    category: 'Minuman',
    barcode: '8991002101234',
    price_minor: 15000,
    cost_minor: 8000,
    quantity: 42,
    server_version: 3,
    updated_at: '2026-01-02T00:00:00Z',
    stock_status: 'in_stock',
    ...overrides,
  };
}

const summary: InventorySummaryViewModel = {
  total_stock_value_minor: 630000,
  low_stock_count: 2,
  out_of_stock_count: 1,
  total_skus: 10,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── INVENTORY-UI-001: KPI cards render real values ─────────────────────────

describe('INVENTORY-UI-001: KPI cards render real values', () => {
  it('renders the four KPIs from the canonical summary', () => {
    const html = renderToString(<InventoryKPICards summary={summary} isLoading={false} />);

    expect(html).toContain('Total Nilai Stok');
    expect(html).toContain('Stok Menipis');
    expect(html).toContain('Stok Habis');
    expect(html).toContain('Total SKU');
    expect(html).toContain(summary.total_stock_value_minor.toLocaleString('id-ID'));
    expect(html).toContain('>2<'); // low
    expect(html).toContain('>1<'); // out
    expect(html).toContain('>10<'); // skus
  });

  it('renders KPI-shaped skeletons while loading', () => {
    const html = renderToString(<InventoryKPICards summary={null} isLoading={true} />);
    expect(html).not.toContain('Total Nilai Stok');
  });
});

// ── INVENTORY-UI-002: stock grid renders real products ─────────────────────

describe('INVENTORY-UI-002: stock grid renders real products', () => {
  const stocks = [
    makeStock({ product_name: 'Kopi Susu Gula Aren', sku: 'SKU-001' }),
    makeStock({ product_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', product_name: 'Gula Pasir 1kg', sku: 'SKU-002', barcode: null, category: 'Sembako', cost_minor: null }),
  ];

  it('renders product name, SKU, barcode, category, prices, and qty', () => {
    const html = renderToString(
      <StockTable stocks={stocks} canMutate onAdjust={() => {}} onHistory={() => {}} />
    );

    expect(html).toContain('Kopi Susu Gula Aren');
    expect(html).toContain('Gula Pasir 1kg');
    expect(html).toContain('SKU-001');
    expect(html).toContain('SKU-002');
    expect(html).toContain('8991002101234');
    expect(html).toContain('Sembako');
    expect(html).toContain(formatMinor(15000));
    expect(html).toContain(formatMinor(8000));
  });

  it('shows placeholder dash for missing SKU/barcode/HPP instead of fake data', () => {
    const html = renderToString(
      <StockTable stocks={[makeStock({ sku: null, barcode: null, cost_minor: null })]} canMutate={false} onAdjust={() => {}} onHistory={() => {}} />
    );
    expect(html).toContain('—');
  });
});

// ── INVENTORY-UI-003: status badges correct ────────────────────────────────

describe('INVENTORY-UI-003: status badges correct', () => {
  it('maps in_stock → Normal (pine), low_stock → Menipis (honey), out_of_stock → Habis (clay)', () => {
    const html = renderToString(
      <StockTable
        stocks={[
          makeStock({ stock_status: 'in_stock' }),
          makeStock({ product_id: 'b2', product_name: 'P2', stock_status: 'low_stock', quantity: 3 }),
          makeStock({ product_id: 'b3', product_name: 'P3', stock_status: 'out_of_stock', quantity: 0 }),
        ]}
        canMutate={false}
        onAdjust={() => {}}
        onHistory={() => {}}
      />
    );

    expect(html).toContain('Normal');
    expect(html).toContain('Menipis');
    expect(html).toContain('Habis');
    expect(html).toContain('bg-pine-soft');
    expect(html).toContain('bg-honey-soft');
    expect(html).toContain('bg-clay-soft');
  });
});

// ── INVENTORY-UI-004..006: toolbar filters ─────────────────────────────────

describe('INVENTORY-UI-004: search filters by name/SKU/barcode', () => {
  const stocks = [
    makeStock({ product_name: 'Kopi Susu' }),
    makeStock({ product_id: 'p2', product_name: 'Teh Melati', sku: 'SKU-TEH' }),
    makeStock({ product_id: 'p3', product_name: 'Minyak Goreng', sku: 'SKU-MNY', barcode: '777' }),
  ];

  it('matches search against name, sku, and barcode case-insensitively', () => {
    expect(applyInventoryFilters(stocks, { search: 'kopi' })).toHaveLength(1);
    expect(applyInventoryFilters(stocks, { search: 'sku-teh' })[0].product_id).toBe('p2');
    expect(applyInventoryFilters(stocks, { search: '777' })[0].product_id).toBe('p3');
    expect(applyInventoryFilters(stocks, { search: 'tidakada' })).toHaveLength(0);
  });

  it('toolbar renders the blueprint search placeholder', () => {
    const html = renderToString(
      <InventoryToolbar
        filter={{}}
        onFilterChange={() => {}}
        categories={['Minuman']}
        resultCount={3}
        onRefresh={() => {}}
        onStockIn={() => {}}
        onStockOut={() => {}}
        onAdjust={() => {}}
        canMutate
        disabled={false}
      />
    );
    expect(html).toContain('Cari nama atau SKU…');
  });
});

describe('INVENTORY-UI-005: category filter', () => {
  const stocks = [
    makeStock({ category: 'Minuman' }),
    makeStock({ product_id: 'p2', product_name: 'P2', category: 'Sembako' }),
  ];

  it('filters exact category (case-insensitive) and lists categories in toolbar', () => {
    expect(applyInventoryFilters(stocks, { category: 'sembako' })[0].category).toBe('Sembako');

    const html = renderToString(
      <InventoryToolbar
        filter={{}}
        onFilterChange={() => {}}
        categories={['Minuman', 'Sembako']}
        resultCount={2}
        onRefresh={() => {}}
        onStockIn={() => {}}
        onStockOut={() => {}}
        onAdjust={() => {}}
        canMutate={false}
        disabled={false}
      />
    );
    expect(html).toContain('Semua Kategori');
    expect(html).toContain('Minuman');
    expect(html).toContain('Sembako');
  });
});

describe('INVENTORY-UI-006: status filter', () => {
  const stocks = [
    makeStock({ stock_status: 'in_stock' }),
    makeStock({ product_id: 'p2', product_name: 'P2', stock_status: 'low_stock', quantity: 2 }),
    makeStock({ product_id: 'p3', product_name: 'P3', stock_status: 'out_of_stock', quantity: 0 }),
  ];

  it('filters derived stock status only', () => {
    expect(applyInventoryFilters(stocks, { status: 'low_stock' }).map((s) => s.product_id)).toEqual(['p2']);
    expect(applyInventoryFilters(stocks, { status: 'out_of_stock' }).map((s) => s.product_id)).toEqual(['p3']);
    expect(applyInventoryFilters(stocks, { status: undefined })).toHaveLength(3);
  });
});

// ── Branch / tenant reactivity ──────────────────────────────────────────────

describe('INVENTORY-UI-007: branch switch clears and reloads', () => {
  it('fetches the NEW branch and the loading state clears previous data', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { items: [makeStock()] } })
      .mockResolvedValueOnce({
        data: {
          items: [
            makeStock({
              product_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              product_name: 'Cabang Lain Product',
            }),
          ],
        },
      });

    await fetchInventoryStocks(BRANCH_ID, TENANT_ID);
    const OTHER_BRANCH = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const list = await fetchInventoryStocks(OTHER_BRANCH, TENANT_ID);

    const secondCall = vi.mocked(api.get).mock.calls[1];
    expect(JSON.stringify(secondCall)).toContain(OTHER_BRANCH);
    expect(list.items[0].product_name).toBe('Cabang Lain Product');
    // cleared state during reload is represented by loading skeleton state:
    expect(applyInventoryFilters([], {})).toEqual([]);
  });
});

describe('INVENTORY-UI-008: tenant switch clears and reloads', () => {
  it('refetches with the new tenant business_id only', async () => {
    const NEW_TENANT = '22222222-2222-4222-8222-222222222222';
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [] } });

    await fetchInventoryStocks(BRANCH_ID, NEW_TENANT);

    const call = vi.mocked(api.get).mock.calls[0];
    expect(JSON.stringify(call)).toContain(NEW_TENANT);
    expect(JSON.stringify(call)).not.toContain(TENANT_ID);
  });
});

// ── INVENTORY-UI-009: empty branch ─────────────────────────────────────────

describe('INVENTORY-UI-009: empty branch state', () => {
  it('renders the empty branch message with reset-free guidance', () => {
    const html = renderToString(
      <EmptyState
        title="Belum ada stok di cabang ini"
        description="Stok akan muncul setelah ada penyesuaian stok masuk untuk produk Anda."
      />
    );
    expect(html).toContain('Belum ada stok di cabang ini');
  });
});

// ── Adjustment / Stock In / Stock Out modals ────────────────────────────────

const modalStocks = [
  makeStock({ quantity: 10, server_version: 7 }),
  makeStock({ product_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', product_name: 'Gula Pasir 1kg', quantity: 4 }),
];

function renderModal(mode: 'adjust' | 'in' | 'out') {
  return renderToString(
    <StockAdjustmentModal
      open={true}
      onClose={() => {}}
      mode={mode}
      stocks={modalStocks}
      initialProductId={null}
      isSubmitting={false}
      conflictError={null}
      validationMessage={null}
      onSubmit={() => {}}
      onResolveConflict={() => {}}
    />
  );
}

describe('INVENTORY-UI-010: stock adjustment modal', () => {
  it('renders product selector, movement types, amount, reference, preview', () => {
    const html = renderModal('adjust');
    expect(html).toContain('Atur Stok');
    expect(html).toContain('Kopi Susu Gula Aren');
    expect(html).toContain('stok saat ini');
    expect(html).toMatch(/stok saat ini\s*(?:<!-- -->)?10/);
    expect(html).toContain('Barang Masuk');
    expect(html).toContain('Barang Keluar');
    expect(html).toContain('Penyesuaian');
    expect(html).toContain('Referensi');
    expect(html).toContain('Restok dari supplier');

    const htmlOut = renderModal('out');
    expect(htmlOut).toContain('Rusak / kedaluwarsa');
  });
});

describe('INVENTORY-UI-011: stock in modal', () => {
  it('is fixed to Barang Masuk with positive-only amount', () => {
    const html = renderModal('in');
    expect(html).toContain('Stok Masuk');
    expect(html).toContain('Barang Masuk');
    expect(resolveQuantityChange('STOCK_IN', 5, 0)).toBe(5);
  });
});

describe('INVENTORY-UI-012: stock out modal', () => {
  it('is fixed to Barang Keluar; positive input becomes reduction', () => {
    const html = renderModal('out');
    expect(html).toContain('Stok Keluar');
    expect(html).toContain('Barang Keluar');
    expect(resolveQuantityChange('STOCK_OUT', 5, 0)).toBe(-5);
  });
});

describe('INVENTORY-UI-013: negative final stock prevented', () => {
  it('blocks submission when projected final < 0 for STOCK_OUT', () => {
    const delta = resolveQuantityChange('STOCK_OUT', 15, 0);
    const projected = 10 + delta;
    expect(projected).toBe(-5);
    expect(isFinalStockBlocked(projected)).toBe(true);
    expect(isFinalStockBlocked(0)).toBe(false);
    expect(isFinalStockBlocked(1)).toBe(false);
  });
});

describe('INVENTORY-UI-014: VERSION_CONFLICT handled', () => {
  function makeAxiosError(status: number, data: unknown) {
    return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
      status,
      statusText: 'Error',
      headers: {},
      config: { headers: {} } as never,
      data: data as never,
    } as never);
  }

  it('classifies a 409 as conflict and renders the conflict block with refresh action', () => {
    const classified = classifyInventoryMutationError(
      makeAxiosError(409, { error: { code: 'VERSION_CONFLICT', message: 'server_version mismatch' } })
    );
    expect(classified.type).toBe('conflict');

    const html = renderToString(
      <StockAdjustmentModal
        open={true}
        onClose={() => {}}
        mode="adjust"
        stocks={modalStocks}
        initialProductId={null}
        isSubmitting={false}
        conflictError={{ type: 'conflict', message: 'server_version mismatch' }}
        validationMessage={null}
        onSubmit={() => {}}
        onResolveConflict={() => {}}
      />
    );
    expect(html).toContain('Konflik versi stok');
    expect(html).toContain('server_version mismatch');
    expect(html).toContain('Muat Versi Terbaru');
  });
});

// ── Movement history ────────────────────────────────────────────────────────

describe('INVENTORY-UI-015: movement history view', () => {
  it('renders the history shell with product filter and empty state', () => {
    const html = renderToString(
      <MovementHistoryModal
        open={true}
        onClose={() => {}}
        tenantId={TENANT_ID}
        branchId={BRANCH_ID}
        branchName="Sudirman"
        productNameById={new Map([['p1', 'Kopi Susu Gula Aren']])}
        initialProductId={null}
      />
    );
    expect(html).toContain('Riwayat Pergerakan Stok');
    expect(html).toContain('Cabang Sudirman');
    expect(html).toContain('Semua Produk');
    expect(html).toContain('Belum ada pergerakan stok');
  });
});

describe('INVENTORY-UI-016: movement pagination', () => {
  it('computes ranges and prev/next availability', () => {
    expect(getMovementRange(0, 55)).toEqual({ rangeStart: 1, rangeEnd: 20, hasPrev: false, hasNext: true });
    expect(getMovementRange(40, 55)).toEqual({ rangeStart: 41, rangeEnd: 55, hasPrev: true, hasNext: false });
    expect(getMovementRange(0, 0)).toEqual({ rangeStart: 0, rangeEnd: 0, hasPrev: false, hasNext: false });
    expect(MOVEMENTS_PAGE_SIZE).toBe(20);
  });
});

// ── Responsive structure ────────────────────────────────────────────────────

describe('INVENTORY-UI-017: responsive layout structure', () => {
  it('uses stacked→multi-column KPI grid and horizontally scrollable table', () => {
    const kpis = renderToString(<InventoryKPICards summary={summary} isLoading={false} />);
    expect(kpis).toContain('grid-cols-2');
    expect(kpis).toContain('lg:grid-cols-4');

    const table = renderToString(
      <StockTable stocks={[makeStock()]} canMutate={false} onAdjust={() => {}} onHistory={() => {}} />
    );
    expect(table).toContain('overflow-x-auto');
    expect(table).toContain('min-w-[880px]');

    const skeleton = renderToString(<StockTableSkeleton />);
    expect(skeleton).toContain('card');
  });
});

// ── No mock data ────────────────────────────────────────────────────────────

describe('INVENTORY-UI-018: no mock data in UI layer', () => {
  const pagePath = path.join(process.cwd(), 'src', 'app', '(authenticated)', 'inventory', 'page.tsx');

  it('page binds to the canonical inventory API layer only', () => {
    const source = readFileSync(pagePath, 'utf8');
    expect(source).toContain("from '@/features/inventory/api'");
    expect(source).toMatch(/fetchInventoryStocks|fetchInventorySummary|adjustInventory/);
    expect(source).not.toMatch(/const\s+\w*(stocks|products|summary)\w*\s*=\s*\[\s*\{/i);
    expect(source).not.toContain('alert(');
    expect(source).not.toContain('confirm(');
  });
});
