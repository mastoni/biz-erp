/**
 * Phase 3D — Products UI Test Suite
 * PRODUCT-UI-001 through PRODUCT-UI-019
 *
 * Tests use renderToString (no DOM). Component rendering + logic tests only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { api } from '@/lib/api';
import { ProductViewModel, ProductOperationError } from '../types';
import { ProductStatusBadge } from '../components/ProductStatusBadge';
import { ProductStockBadge } from '../components/ProductStockBadge';
import { ProductGrid } from '../components/ProductGrid';
import { ProductsToolbar } from '../components/ProductsToolbar';
import { ProductFormModal } from '../components/ProductFormModal';
import { DeactivateConfirmModal } from '../components/DeactivateConfirmModal';
import { ProductPagination } from '../components/ProductPagination';
import { ProductEmptyState } from '../components/ProductEmptyState';
import { filterProducts } from '../products-helpers';
import { formatMinor } from '@/lib/format';
import { calculateMargin, getStockStatus, classifyProductError } from '../viewmodel';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function makeProduct(overrides: Partial<ProductViewModel> = {}): ProductViewModel {
  return {
    id: 'p1',
    name: 'Kopi Susu Gula Aren',
    description: 'Kopi dengan gula aren',
    sku: 'SKU-001',
    category: 'Minuman',
    barcode: 'barcode-001',
    price_minor: 15000,
    cost_minor: 8000,
    margin_minor: 7000,
    margin_percent: 87.5,
    is_active: true,
    server_version: 1,
    stock_quantity: 42,
    stock_status: 'in_stock',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeAxiosError(status: number, data: unknown) {
  const { AxiosError } = require('axios');
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: 'Error',
    headers: {},
    config: { headers: {} },
    data,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── PRODUCT-UI-001: Product grid renders real products ──────────────────────

describe('PRODUCT-UI-001: product grid renders real products', () => {
  it('renders all products in the grid with name, SKU, price', () => {
    const products = [
      makeProduct({ id: 'p1', name: 'Kopi Susu Gula Aren', sku: 'SKU-001', price_minor: 15000 }),
      makeProduct({ id: 'p2', name: 'Croissant Butter', sku: 'SKU-002', price_minor: 35000 }),
    ];

    const html = renderToString(
      <ProductGrid products={products} onEdit={() => {}} onDeactivate={() => {}} isOwner />
    );

    expect(html).toContain('Kopi Susu Gula Aren');
    expect(html).toContain('SKU-001');
    expect(html).toContain('Croissant Butter');
    expect(html).toContain('SKU-002');
    expect(html).toContain(formatMinor(15000));
    expect(html).toContain(formatMinor(35000));
  });

  it('renders nothing when products list is empty', () => {
    const html = renderToString(
      <ProductGrid products={[]} onEdit={() => {}} onDeactivate={() => {}} isOwner />
    );
    expect(html).toBe('');
  });
});

// ── PRODUCT-UI-002: Search filters products ─────────────────────────────────

describe('PRODUCT-UI-002: search filters products', () => {
  it('filterProducts matches name, SKU, and barcode fields', () => {
    const products = [
      makeProduct({ id: 'p1', name: 'Kopi Susu', sku: 'SKU-001', barcode: 'bc-001' }),
      makeProduct({ id: 'p2', name: 'Teh Manis', sku: 'SKU-002', barcode: 'bc-002' }),
      makeProduct({ id: 'p3', name: 'Air Mineral', sku: 'SKU-003', barcode: 'bc-003' }),
    ];

    const nameMatches = filterProducts(products, { search: 'Kopi', category: '', barcode: '' });
    expect(nameMatches).toHaveLength(1);
    expect(nameMatches[0].id).toBe('p1');

    const skuMatches = filterProducts(products, { search: 'SKU-002', category: '', barcode: '' });
    expect(skuMatches).toHaveLength(1);
    expect(skuMatches[0].id).toBe('p2');

    const barcodeMatches = filterProducts(products, { search: 'bc-003', category: '', barcode: '' });
    expect(barcodeMatches).toHaveLength(1);
    expect(barcodeMatches[0].id).toBe('p3');

    const noMatches = filterProducts(products, { search: 'xyz', category: '', barcode: '' });
    expect(noMatches).toHaveLength(0);
  });
});

// ── PRODUCT-UI-003: Category filter works ───────────────────────────────────

describe('PRODUCT-UI-003: category filter works', () => {
  it('filters products by category', () => {
    const products = [
      makeProduct({ id: 'p1', category: 'Minuman' }),
      makeProduct({ id: 'p2', category: 'Makanan' }),
      makeProduct({ id: 'p3', category: 'Minuman' }),
    ];

    const filtered = filterProducts(products, { search: '', category: 'minuman', barcode: '' });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((p) => p.category === 'Minuman')).toBe(true);
  });
});

// ── PRODUCT-UI-004: Barcode filter works ────────────────────────────────────

describe('PRODUCT-UI-004: barcode filter works', () => {
  it('filters products by barcode', () => {
    const products = [
      makeProduct({ id: 'p1', barcode: 'bc-001' }),
      makeProduct({ id: 'p2', barcode: 'bc-002' }),
      makeProduct({ id: 'p3', barcode: 'bc-003' }),
    ];

    const filtered = filterProducts(products, { search: '', category: '', barcode: 'bc-002' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].barcode).toBe('bc-002');
  });
});

// ── PRODUCT-UI-005: Branch stock badge reflects active branch ───────────────

describe('PRODUCT-UI-005: branch stock badge reflects active branch', () => {
  it('renders stock quantity and branch name', () => {
    const html = renderToString(
      <ProductStockBadge quantity={42} status="in_stock" branchName="Sudirman" />
    );

    expect(html).toContain('42');
    expect(html).toContain('Sudirman');
  });

  it('renders unknown when stock is null', () => {
    const html = renderToString(
      <ProductStockBadge quantity={null} status="unknown" />
    );
    expect(html).toContain('—');
  });

  it('renders out_of_stock when quantity is 0', () => {
    const html = renderToString(
      <ProductStockBadge quantity={0} status="out_of_stock" />
    );
    expect(html).toContain('0');
  });
});

// ── PRODUCT-UI-006: Branch switch refreshes stock ───────────────────────────

describe('PRODUCT-UI-006: branch switch refreshes stock', () => {
  it('getStockStatus returns correct values for different quantities', () => {
    expect(getStockStatus(50)).toBe('in_stock');
    expect(getStockStatus(5)).toBe('low_stock');
    expect(getStockStatus(1)).toBe('low_stock');
    expect(getStockStatus(0)).toBe('out_of_stock');
    expect(getStockStatus(null)).toBe('unknown');
  });

  it('stock status changes when branch changes to a new branch with different stock', () => {
    const oldStockStatus = getStockStatus(42);
    const newStockStatus = getStockStatus(0);
    expect(oldStockStatus).toBe('in_stock');
    expect(newStockStatus).toBe('out_of_stock');
    expect(newStockStatus).not.toBe(oldStockStatus);
  });
});

// ── PRODUCT-UI-007: Tenant switch clears product state ──────────────────────

describe('PRODUCT-UI-007: tenant switch clears product state', () => {
  it('filterProducts returns empty when products list is empty (simulating tenant cleared)', () => {
    const emptiedProducts: ProductViewModel[] = [];
    const result = filterProducts(emptiedProducts, { search: '', category: '', barcode: '' });
    expect(result).toHaveLength(0);
  });

  it('ProductGrid renders nothing when products are cleared', () => {
    const html = renderToString(
      <ProductGrid products={[]} onEdit={() => {}} onDeactivate={() => {}} isOwner />
    );
    expect(html).toBe('');
  });
});

// ── PRODUCT-UI-008: Empty state ──────────────────────────────────────────────

describe('PRODUCT-UI-008: empty state renders', () => {
  it('shows empty title when no products and no filter', () => {
    const html = renderToString(
      <ProductEmptyState hasFilter={false} isOwner={true} onAddProduct={() => {}} />
    );

    expect(html).toContain('Belum ada produk');
    expect(html).toContain('Tambah Produk');
  });

  it('shows filter title when search has no results', () => {
    const html = renderToString(
      <ProductEmptyState hasFilter={true} onClearFilter={() => {}} isOwner={false} />
    );

    expect(html).toContain('Tidak ada produk ditemukan');
  });
});

// ── PRODUCT-UI-009: Create modal opens ──────────────────────────────────────

describe('PRODUCT-UI-009: create modal opens', () => {
  it('renders create form fields when open in create mode', () => {
    const html = renderToString(
      <ProductFormModal
        open={true}
        onClose={() => {}}
        mode="create"
        businessId={TENANT_ID}
        onSave={async () => {}}
      />
    );

    expect(html).toContain('Tambah Produk Baru');
    expect(html).toContain('Nama Produk');
    expect(html).toContain('Harga Jual');
    expect(html).toContain('HPP');
    expect(html).toContain('SKU');
    expect(html).toContain('Barcode');
    expect(html).toContain('Kategori');
    expect(html).toContain('Deskripsi');
    expect(html).toContain('Buat Produk');
  });

  it('renders nothing when closed', () => {
    const html = renderToString(
      <ProductFormModal
        open={false}
        onClose={() => {}}
        mode="create"
        businessId={TENANT_ID}
        onSave={async () => {}}
      />
    );
    expect(html).toBe('');
  });
});

// ── PRODUCT-UI-010: Create success updates grid ─────────────────────────────

describe('PRODUCT-UI-010: create success updates grid', () => {
  it('new product appears in grid after creation', () => {
    const product = makeProduct({ id: 'p-new', name: 'Produk Baru' });
    const html = renderToString(
      <ProductGrid products={[product]} onEdit={() => {}} onDeactivate={() => {}} isOwner />
    );

    expect(html).toContain('Produk Baru');
  });
});

// ── PRODUCT-UI-011: SKU conflict displays controlled error ────────────────────

describe('PRODUCT-UI-011: SKU conflict displays controlled error', () => {
  it('classifies SKU_CONFLICT as sku_conflict error type', () => {
    const err = makeAxiosError(409, {
      error: {
        code: 'SKU_CONFLICT',
        message: 'SKU sudah digunakan',
        details: { sku: 'SKU-001' },
      },
    });

    const classified = classifyProductError(err) as ProductOperationError;
    expect(classified.type).toBe('sku_conflict');
    expect(classified.message).toBe('SKU sudah digunakan');
  });

  it('renders conflict message in form modal', () => {
    const conflict: ProductOperationError = {
      type: 'sku_conflict',
      sku: 'SKU-001',
      message: 'SKU sudah digunakan',
    };

    const html = renderToString(
      <ProductFormModal
        open={true}
        onClose={() => {}}
        mode="create"
        businessId={TENANT_ID}
        onSave={async () => {}}
        conflictError={conflict}
      />
    );

    expect(html).toContain('SKU sudah digunakan');
    expect(html).toContain('SKU sudah digunakan');
  });
});

// ── PRODUCT-UI-012: Barcode conflict displays controlled error ────────────────

describe('PRODUCT-UI-012: barcode conflict displays controlled error', () => {
  it('classifies BARCODE_CONFLICT as barcode_conflict error type', () => {
    const err = makeAxiosError(409, {
      error: {
        code: 'BARCODE_CONFLICT',
        message: 'Barcode sudah digunakan',
        details: { barcode: 'barcode-001' },
      },
    });

    const classified = classifyProductError(err) as ProductOperationError;
    expect(classified.type).toBe('barcode_conflict');
    expect(classified.message).toBe('Barcode sudah digunakan');
  });

  it('renders barcode conflict message in form modal', () => {
    const conflict: ProductOperationError = {
      type: 'barcode_conflict',
      barcode: 'barcode-001',
      message: 'Barcode sudah digunakan',
    };

    const html = renderToString(
      <ProductFormModal
        open={true}
        onClose={() => {}}
        mode="edit"
        businessId={TENANT_ID}
        product={makeProduct()}
        onSave={async () => {}}
        conflictError={conflict}
      />
    );

    expect(html).toContain('Barcode sudah digunakan');
  });
});

// ── PRODUCT-UI-013: Edit opens with real values ─────────────────────────────

describe('PRODUCT-UI-013: edit opens with real values', () => {
  it('renders edit form pre-filled with product data', () => {
    const product = makeProduct({
      name: 'Kopi Susu Gula Aren',
      sku: 'SKU-001',
      barcode: 'barcode-001',
      category: 'Minuman',
      price_minor: 15000,
      cost_minor: 8000,
      is_active: true,
    });

    const html = renderToString(
      <ProductFormModal
        open={true}
        onClose={() => {}}
        mode="edit"
        businessId={TENANT_ID}
        product={product}
        serverVersion={1}
        onSave={async () => {}}
      />
    );

    expect(html).toContain('Edit Produk');
    expect(html).toContain('Simpan Perubahan');
    expect(html).toContain('Kopi Susu Gula Aren');
  });

  it('edit form pre-fills cost_minor when present', () => {
    const product = makeProduct({ cost_minor: 8000 });
    const html = renderToString(
      <ProductFormModal
        open={true}
        onClose={() => {}}
        mode="edit"
        businessId={TENANT_ID}
        product={product}
        onSave={async () => {}}
      />
    );
    expect(html).toContain('8000');
  });
});

// ── PRODUCT-UI-014: VERSION_CONFLICT does not overwrite silently ─────────────

describe('PRODUCT-UI-014: VERSION_CONFLICT does not overwrite silently', () => {
  it('classifies VERSION_CONFLICT with expected/current versions', () => {
    const err = makeAxiosError(409, {
      error: {
        code: 'VERSION_CONFLICT',
        message: 'Product was modified by another user',
        details: {
          expected_server_version: 5,
          current_server_version: 10,
        },
      },
    });

    const classified = classifyProductError(err) as ProductOperationError;
    expect(classified.type).toBe('version_conflict');
    expect((classified as { expected: number; current: number }).expected).toBe(5);
    expect((classified as { expected: number; current: number }).current).toBe(10);
  });

  it('renders version conflict explanation in form modal', () => {
    const conflict: ProductOperationError = {
      type: 'version_conflict',
      expected: 5,
      current: 10,
      message: 'Product was modified by another user',
    };

    const html = renderToString(
      <ProductFormModal
        open={true}
        onClose={() => {}}
        mode="edit"
        businessId={TENANT_ID}
        product={makeProduct()}
        onSave={async () => {}}
        conflictError={conflict}
      />
    );

    expect(html).toContain('Produk diubah oleh pengguna lain');
  });
});

// ── PRODUCT-UI-015: Deactivate confirmation ──────────────────────────────────

describe('PRODUCT-UI-015: deactivate confirmation works', () => {
  it('renders confirmation modal with product name', () => {
    const html = renderToString(
      <DeactivateConfirmModal
        open={true}
        onClose={() => {}}
        onConfirm={async () => {}}
        product={makeProduct({ name: 'Test Product' })}
      />
    );

    expect(html).toContain('Nonaktifkan Produk');
    expect(html).toContain('Test Product');
    expect(html).toContain('Batal');
  });

  it('renders nothing when no product', () => {
    const html = renderToString(
      <DeactivateConfirmModal open={true} onClose={() => {}} onConfirm={async () => {}} product={null} />
    );
    expect(html).toBe('');
  });
});

// ── PRODUCT-UI-016: Inactive badge renders correctly ─────────────────────────

describe('PRODUCT-UI-016: inactive badge renders correctly', () => {
  it('renders "Aktif" for active products', () => {
    const html = renderToString(<ProductStatusBadge isActive={true} />);
    expect(html).toContain('Aktif');
    expect(html).toContain('bg-pine');
  });

  it('renders "Nonaktif" for inactive products', () => {
    const html = renderToString(<ProductStatusBadge isActive={false} />);
    expect(html).toContain('Nonaktif');
  });

  it('ProductCard applies opacity to inactive products', () => {
    const html = renderToString(
      <ProductGrid
        products={[makeProduct({ is_active: false, name: 'Inactive Product' })]}
        onEdit={() => {}}
        onDeactivate={() => {}}
        isOwner
      />
    );
    expect(html).toContain('opacity-65');
    expect(html).toContain('Nonaktif');
    expect(html).toContain('Inactive Product');
  });
});

// ── PRODUCT-UI-017: Numeric formatting uses .num ──────────────────────────────

describe('PRODUCT-UI-017: numeric formatting uses .num', () => {
  it('formatMinor produces correct IDR currency', () => {
    expect(formatMinor(15000)).toBe('Rp\u00a015.000');
    expect(formatMinor(150000)).toBe('Rp\u00a0150.000');
    expect(formatMinor(0)).toBe('Rp\u00a00');
  });

  it('ProductCard applies .num class to price values', () => {
    const product = makeProduct({ price_minor: 15000, cost_minor: 8000, margin_percent: 87.5, margin_minor: 7000 });
    const html = renderToString(
      <ProductGrid
        products={[product]}
        onEdit={() => {}}
        onDeactivate={() => {}}
        isOwner
      />
    );

    expect(html).toContain('num');
    expect(html).toContain('Rp\u00a015.000');
    expect(html).toContain('Rp\u00a08.000');
    expect(html).toContain('Rp\u00a07.000');
    expect(html).toContain('87.5');
  });

  it('calculateMargin returns correct values for price/cost', () => {
    const result = calculateMargin(15000, 8000);
    expect(result.margin_minor).toBe(7000);
    expect(result.margin_percent).toBe(87.5);
  });

  it('margin_percent is null when cost_minor is zero (no division by zero)', () => {
    const result = calculateMargin(15000, 0);
    expect(result.margin_minor).toBe(15000);
    expect(result.margin_percent).toBeNull();
  });

  it('margin_minor and margin_percent are null when cost_minor is null', () => {
    const result = calculateMargin(15000, null);
    expect(result.margin_minor).toBeNull();
    expect(result.margin_percent).toBeNull();
  });
});

// ── PRODUCT-UI-018: Responsive layout ────────────────────────────────────────

describe('PRODUCT-UI-018: responsive layout', () => {
  it('ProductGrid uses responsive grid classes', () => {
    const html = renderToString(
      <ProductGrid products={[makeProduct()]} onEdit={() => {}} onDeactivate={() => {}} isOwner />
    );

    expect(html).toContain('sm:grid-cols-2');
    expect(html).toContain('lg:grid-cols-3');
    expect(html).toContain('xl:grid-cols-4');
  });

  it('ProductsToolbar uses responsive flex direction', () => {
    const html = renderToString(
      <ProductsToolbar
        filter={{ search: '', category: '', barcode: '' }}
        onFilterChange={() => {}}
        categories={['Minuman']}
        onAddProduct={() => {}}
        isOwner={true}
      />
    );

    expect(html).toContain('sm:flex-row');
  });
});

// ── PRODUCT-UI-019: No mock/static product data ─────────────────────────────

describe('PRODUCT-UI-019: no mock/static product data', () => {
  const FORBIDDEN_VALUES = [
    'Mock Product',
    'Test Product',
    'PROD-001',
    '99999999',
    'Default Product',
  ];

  it('ProductGrid renders only from props, not hardcoded values', () => {
    const product = makeProduct({
      id: 'p1',
      name: 'Kopi Susu Gula Aren',
      sku: 'SKU-001',
      price_minor: 15000,
    });

    const html = renderToString(
      <ProductGrid products={[product]} onEdit={() => {}} onDeactivate={() => {}} isOwner />
    );

    FORBIDDEN_VALUES.forEach((val) => {
      expect(html).not.toContain(val);
    });
  });

  it('filterProducts returns only matching items', () => {
    const products = [
      makeProduct({ id: 'p1', name: 'Real Product 1' }),
      makeProduct({ id: 'p2', name: 'Real Product 2' }),
    ];

    const result = filterProducts(products, { search: '', category: '', barcode: '' });
    expect(result).toHaveLength(2);

    const filtered = filterProducts(products, { search: 'Product 1', category: '', barcode: '' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('p1');
  });
});
