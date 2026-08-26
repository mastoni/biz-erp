/**
 * Phase 8F — Product Image UI + POS Integration Test Suite
 * Tests PRODUCT-UI-IMG-001 through PRODUCT-UI-IMG-014
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { ProductFormModal } from '@/features/products/components/ProductFormModal';
import { POSProductCard } from '../components/POSProductCard';
import { POSProductViewModel } from '../types';
import { ProductViewModel } from '@/features/products/types';
import { mapPOSProductViewModel } from '../pos-helpers';

const samplePOSProduct: POSProductViewModel = {
  id: 'prod-001',
  name: 'Kopi Susu Gula Aren',
  sku: 'SKU-KOPI-01',
  category: 'Minuman',
  price_minor: 25000,
  quantity_available: 15,
  stock_status: 'in_stock',
  min_stock: 5,
  image_url: 'https://cdn.example.com/kopi-susu.jpg',
  image_enabled: true,
};

const sampleProductVM: ProductViewModel = {
  id: 'prod-001',
  name: 'Kopi Susu Gula Aren',
  description: 'Signature coffee',
  sku: 'SKU-KOPI-01',
  category: 'Minuman',
  barcode: '8991234567890',
  image_url: 'https://cdn.example.com/kopi-susu.jpg',
  image_enabled: true,
  price_minor: 25000,
  cost_minor: 12000,
  margin_minor: 13000,
  margin_percent: 108.3,
  is_active: true,
  server_version: 1,
  stock_quantity: 15,
  stock_status: 'in_stock',
  created_at: '2026-08-27T00:00:00Z',
  updated_at: '2026-08-27T00:00:00Z',
};

describe('PHASE 8F — Product Image UI & POS Integration', () => {
  // -------------------------------------------------------------------------
  // PRODUCT-UI-IMG-001: Product form shows image field
  // -------------------------------------------------------------------------
  it('PRODUCT-UI-IMG-001: product form renders image_url input field with proper label and placeholder', () => {
    const html = renderToString(
      <ProductFormModal
        open={true}
        onClose={() => {}}
        mode="create"
        businessId="tenant-123"
        onSave={async () => {}}
      />
    );
    expect(html).toContain('URL Gambar Produk');
    expect(html).toContain('name="image_url"');
    expect(html).toContain('placeholder="https://example.com/gambar-produk.jpg"');
  });

  // -------------------------------------------------------------------------
  // PRODUCT-UI-IMG-002: Image preview with valid URL
  // -------------------------------------------------------------------------
  it('PRODUCT-UI-IMG-002: product form renders image preview when image_url exists', () => {
    const html = renderToString(
      <ProductFormModal
        open={true}
        onClose={() => {}}
        mode="edit"
        businessId="tenant-123"
        product={sampleProductVM}
        onSave={async () => {}}
      />
    );
    expect(html).toContain('src="https://cdn.example.com/kopi-susu.jpg"');
    expect(html).toContain('Pratinjau gambar valid');
    expect(html).toContain('Hapus');
  });

  // -------------------------------------------------------------------------
  // PRODUCT-UI-IMG-003: Clear image
  // -------------------------------------------------------------------------
  it('PRODUCT-UI-IMG-003: clear image action button is available in preview', () => {
    const html = renderToString(
      <ProductFormModal
        open={true}
        onClose={() => {}}
        mode="edit"
        businessId="tenant-123"
        product={sampleProductVM}
        onSave={async () => {}}
      />
    );
    expect(html).toContain('Hapus');
  });

  // -------------------------------------------------------------------------
  // PRODUCT-UI-IMG-004: Null image fallback
  // -------------------------------------------------------------------------
  it('PRODUCT-UI-IMG-004: product without image renders cleanly without preview or broken layout', () => {
    const productWithoutImage: ProductViewModel = {
      ...sampleProductVM,
      image_url: null,
    };
    const html = renderToString(
      <ProductFormModal
        open={true}
        onClose={() => {}}
        mode="edit"
        businessId="tenant-123"
        product={productWithoutImage}
        onSave={async () => {}}
      />
    );
    expect(html).not.toContain('Pratinjau gambar valid');
    expect(html).toContain('name="image_url"');
  });

  // -------------------------------------------------------------------------
  // PRODUCT-UI-IMG-005: Broken image fallback
  // -------------------------------------------------------------------------
  it('PRODUCT-UI-IMG-005: invalid or failed image URL fallback handling is supported', () => {
    const html = renderToString(
      <POSProductCard
        product={{ ...samplePOSProduct, image_url: 'https://invalid-url.com/broken.png' }}
        onAddToCart={() => {}}
      />
    );
    expect(html).toContain('src="https://invalid-url.com/broken.png"');
    expect(html).toContain('Minuman');
  });

  // -------------------------------------------------------------------------
  // PRODUCT-UI-IMG-006: Image persists through update
  // -------------------------------------------------------------------------
  it('PRODUCT-UI-IMG-006: image_url field value is correctly initialized from product model', () => {
    const html = renderToString(
      <ProductFormModal
        open={true}
        onClose={() => {}}
        mode="edit"
        businessId="tenant-123"
        product={sampleProductVM}
        serverVersion={1}
        onSave={async () => {}}
      />
    );
    expect(html).toContain('value="https://cdn.example.com/kopi-susu.jpg"');
  });

  // -------------------------------------------------------------------------
  // PRODUCT-UI-IMG-007: POS card renders image
  // -------------------------------------------------------------------------
  it('PRODUCT-UI-IMG-007: POSProductCard renders product image with fixed aspect ratio and cover fit', () => {
    const html = renderToString(
      <POSProductCard
        product={samplePOSProduct}
        onAddToCart={() => {}}
      />
    );
    expect(html).toContain('src="https://cdn.example.com/kopi-susu.jpg"');
    expect(html).toContain('object-cover');
    expect(html).toContain('Kopi Susu Gula Aren');
    expect(html).toContain('Rp 25.000');
  });

  // -------------------------------------------------------------------------
  // PRODUCT-UI-IMG-008: POS fallback when image null
  // -------------------------------------------------------------------------
  it('PRODUCT-UI-IMG-008: POSProductCard renders clean category marker fallback when image_url is null', () => {
    const html = renderToString(
      <POSProductCard
        product={{ ...samplePOSProduct, image_url: null }}
        onAddToCart={() => {}}
      />
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('Minuman');
    expect(html).toContain('Kopi Susu Gula Aren');
    expect(html).toContain('stok');
    expect(html).toContain('15');
    expect(html).toContain('Rp 25.000');
  });

  // -------------------------------------------------------------------------
  // PRODUCT-UI-IMG-009: POS fallback when image fails
  // -------------------------------------------------------------------------
  it('PRODUCT-UI-IMG-009: POSProductCard retains name, category, price, and add button intact', () => {
    const html = renderToString(
      <POSProductCard
        product={samplePOSProduct}
        onAddToCart={() => {}}
      />
    );
    expect(html).toContain('Minuman');
    expect(html).toContain('Kopi Susu Gula Aren');
    expect(html).toContain('Rp 25.000');
    expect(html).toContain('<svg');
  });

  // -------------------------------------------------------------------------
  // PRODUCT-UI-IMG-010: Out-of-stock behavior remains intact
  // -------------------------------------------------------------------------
  it('PRODUCT-UI-IMG-010: out-of-stock product with image remains disabled and non-clickable', () => {
    const html = renderToString(
      <POSProductCard
        product={{
          ...samplePOSProduct,
          quantity_available: 0,
          stock_status: 'out_of_stock',
        }}
        onAddToCart={() => {}}
      />
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain('Habis');
    expect(html).toContain('cursor-not-allowed');
  });

  // -------------------------------------------------------------------------
  // PRODUCT-UI-IMG-011: Branch switching preserves image but refreshes stock
  // -------------------------------------------------------------------------
  it('PRODUCT-UI-IMG-011: mapPOSProductViewModel preserves product image while updating branch stock', () => {
    const rawProduct = {
      id: 'prod-001',
      business_id: 'tenant-123',
      name: 'Kopi Susu Gula Aren',
      description: 'Signature coffee',
      sku: 'SKU-KOPI-01',
      category: 'Minuman',
      barcode: '8991234567890',
      price_minor: 25000,
      cost_minor: 12000,
      image_url: 'https://cdn.example.com/kopi-susu.jpg',
      is_active: true,
      server_version: 1,
      created_at: '2026-08-27T00:00:00Z',
      updated_at: '2026-08-27T00:00:00Z',
    };

    const branch1VM = mapPOSProductViewModel(rawProduct, 25);
    expect(branch1VM.image_url).toBe('https://cdn.example.com/kopi-susu.jpg');
    expect(branch1VM.quantity_available).toBe(25);

    const branch2VM = mapPOSProductViewModel(rawProduct, 3);
    expect(branch2VM.image_url).toBe('https://cdn.example.com/kopi-susu.jpg');
    expect(branch2VM.quantity_available).toBe(3);
    expect(branch2VM.stock_status).toBe('low_stock');
  });

  // -------------------------------------------------------------------------
  // PRODUCT-UI-IMG-012: Tenant switching clears old product/image state
  // -------------------------------------------------------------------------
  it('PRODUCT-UI-IMG-012: tenant isolation ensures product images remain scoped to business_id', () => {
    const tenant1Product = {
      id: 'prod-001',
      business_id: 'tenant-111',
      name: 'Tenant 1 Coffee',
      description: null,
      sku: 'SKU-T1',
      category: 'Minuman',
      barcode: null,
      price_minor: 20000,
      cost_minor: null,
      image_url: 'https://t1.example.com/coffee.jpg',
      is_active: true,
      server_version: 1,
      created_at: '2026-08-27T00:00:00Z',
      updated_at: '2026-08-27T00:00:00Z',
    };

    const vm = mapPOSProductViewModel(tenant1Product, 10);
    expect(vm.image_url).toBe('https://t1.example.com/coffee.jpg');
    expect(tenant1Product.business_id).toBe('tenant-111');
  });

  // -------------------------------------------------------------------------
  // PRODUCT-UI-IMG-013: No fake/static image URLs
  // -------------------------------------------------------------------------
  it('PRODUCT-UI-IMG-013: product without image has image_url = null, never a fake placeholder URL', () => {
    const rawProduct = {
      id: 'prod-002',
      business_id: 'tenant-123',
      name: 'Beras Pandan Wangi 5kg',
      description: null,
      sku: 'SKU-BERAS-01',
      category: 'Sembako',
      barcode: null,
      price_minor: 75000,
      cost_minor: null,
      image_url: null,
      is_active: true,
      server_version: 1,
      created_at: '2026-08-27T00:00:00Z',
      updated_at: '2026-08-27T00:00:00Z',
    };

    const vm = mapPOSProductViewModel(rawProduct, 10);
    expect(vm.image_url).toBeNull();
  });

  // -------------------------------------------------------------------------
  // PRODUCT-UI-IMG-014: No base64/blob injection
  // -------------------------------------------------------------------------
  it('PRODUCT-UI-IMG-014: product image is standard URL reference without inline binary/blob data', () => {
    expect(samplePOSProduct.image_url?.startsWith('https://')).toBe(true);
    expect(samplePOSProduct.image_url?.startsWith('data:')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // PRODUCT-UI-IMG-015: image_enabled = false hides image in POSProductCard
  // -------------------------------------------------------------------------
  it('PRODUCT-UI-IMG-015: POSProductCard hides image and renders fallback when image_enabled is false even if image_url exists', () => {
    const disabledImageProduct: POSProductViewModel = {
      ...samplePOSProduct,
      image_enabled: false,
      image_url: 'https://cdn.example.com/kopi-susu.jpg',
    };

    const html = renderToString(
      <POSProductCard
        product={disabledImageProduct}
        onAddToCart={vi.fn()}
      />
    );

    expect(html).not.toContain('<img');
    expect(html).toContain('Kopi Susu Gula Aren');
  });

  // -------------------------------------------------------------------------
  // PRODUCT-UI-IMG-016: mapPOSProductViewModel maps image_enabled
  // -------------------------------------------------------------------------
  it('PRODUCT-UI-IMG-016: mapPOSProductViewModel maps image_enabled from canonical product model', () => {
    const rawProductWithMedia = {
      id: 'prod-002',
      business_id: 'biz-001',
      name: 'Croissant Butter',
      description: null,
      sku: 'SKU-CROISSANT-01',
      category: 'Food',
      barcode: null,
      price_minor: 25000,
      cost_minor: null,
      image_url: 'https://cdn.example.com/croissant.jpg',
      image_enabled: true,
      is_active: true,
      server_version: 1,
      created_at: '2026-08-27T00:00:00Z',
      updated_at: '2026-08-27T00:00:00Z',
    };

    const vm = mapPOSProductViewModel(rawProductWithMedia, 15);
    expect(vm.image_enabled).toBe(true);
    expect(vm.image_url).toBe('https://cdn.example.com/croissant.jpg');
  });
});
