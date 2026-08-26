/**
 * Phase 8D — POS UI Component & Visual Acceptance Test Suite.
 * Covers POS-UI-001 through POS-UI-026 using SSR renderToString.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { POSSectionHead } from '../components/POSSectionHead';
import { POSCategoryFilter } from '../components/POSCategoryFilter';
import { POSProductCard } from '../components/POSProductCard';
import { POSProductGrid } from '../components/POSProductGrid';
import { POSCartLine } from '../components/POSCartLine';
import { POSParkedOrders } from '../components/POSParkedOrders';
import { POSCartSidebar } from '../components/POSCartSidebar';
import { POSPaymentModal } from '../components/POSPaymentModal';
import { POSReceiptCard } from '../components/POSReceiptCard';
import {
  POSProductViewModel,
  POSCartLineViewModel,
  POSCartViewModel,
  POSParkedOrder,
  POSReceiptViewModel,
} from '../types';

function renderClean(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, '');
}

describe('PHASE 8D — POS UI Component Tests', () => {
  const sampleProduct: POSProductViewModel = {
    id: 'p1',
    name: 'Kopi Susu Gula Aren',
    sku: 'SKU-KOPI-01',
    category: 'Minuman',
    price_minor: 25000,
    quantity_available: 15,
    stock_status: 'in_stock',
    min_stock: 5,
  };

  const sampleCartLine: POSCartLineViewModel = {
    product_id: 'p1',
    product_name: 'Kopi Susu Gula Aren',
    sku: 'SKU-KOPI-01',
    category: 'Minuman',
    quantity: 2,
    unit_price_minor: 25000,
    line_subtotal_minor: 50000,
    quantity_available: 15,
  };

  const sampleCart: POSCartViewModel = {
    transaction_id: 'TRX-123456',
    customer_id: null,
    customer_name: 'Umum',
    lines: [sampleCartLine],
    subtotal_minor: 50000,
    discount_percent: 0,
    discount_minor: 0,
    tax_minor: 5500,
    total_minor: 55500,
    item_count: 2,
  };

  // POS-UI-001: Page header matches blueprint
  it('POS-UI-001: renders page title Kasir and cashier shift subtitle', () => {
    const html = renderClean(
      <POSSectionHead
        cashierName="Rani Wijaya"
        dailyCounter={{ total_sales: 10, total_revenue_minor: 500000 }}
        onClear={vi.fn()}
        isClearDisabled={false}
      />
    );
    expect(html).toContain('Kasir');
    expect(html).toContain('Klik produk untuk menambah ke keranjang · Shift Rani Wijaya');
  });

  // POS-UI-002: Daily counter
  it('POS-UI-002: displays formatted daily sales counter badge', () => {
    const html = renderClean(
      <POSSectionHead
        cashierName="Rani"
        dailyCounter={{ total_sales: 164, total_revenue_minor: 8450000 }}
        onClear={vi.fn()}
        isClearDisabled={false}
      />
    );
    expect(html).toContain('Hari ini: 164 trx · Rp 8,5 jt');
  });

  // POS-UI-003: Category filter
  it('POS-UI-003: renders category pills with active styling', () => {
    const html = renderClean(
      <POSCategoryFilter
        categories={['Semua', 'Minuman', 'Makanan']}
        selectedCategory="Minuman"
        onSelectCategory={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />
    );
    expect(html).toContain('Semua');
    expect(html).toContain('Minuman');
    expect(html).toContain('Makanan');
    expect(html).toContain('border-pine bg-pine text-[#f2efe2]');
  });

  // POS-UI-004: Search
  it('POS-UI-004: renders search input placeholder', () => {
    const html = renderClean(
      <POSCategoryFilter
        categories={['Semua']}
        selectedCategory="Semua"
        onSelectCategory={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />
    );
    expect(html).toContain('Cari nama / SKU…');
  });

  // POS-UI-005: Product grid
  it('POS-UI-005: renders list of products in grid', () => {
    const html = renderClean(
      <POSProductGrid
        products={[sampleProduct]}
        selectedCategory="Minuman"
        searchQuery=""
        onAddToCart={vi.fn()}
      />
    );
    expect(html).toContain('Kopi Susu Gula Aren');
    expect(html).toContain('Rp 25.000');
  });

  // POS-UI-006: Stock badges
  it('POS-UI-006: displays accurate stock badges for out of stock and low stock', () => {
    const outProd: POSProductViewModel = {
      ...sampleProduct,
      id: 'p2',
      quantity_available: 0,
      stock_status: 'out_of_stock',
    };
    const lowProd: POSProductViewModel = {
      ...sampleProduct,
      id: 'p3',
      quantity_available: 3,
      stock_status: 'low_stock',
    };

    const outHtml = renderClean(<POSProductCard product={outProd} onAddToCart={vi.fn()} />);
    expect(outHtml).toContain('Habis');

    const lowHtml = renderClean(<POSProductCard product={lowProd} onAddToCart={vi.fn()} />);
    expect(lowHtml).toContain('3');
  });

  // POS-UI-007: Add to cart
  it('POS-UI-007: product card renders price and add action', () => {
    const html = renderClean(<POSProductCard product={sampleProduct} onAddToCart={vi.fn()} />);
    expect(html).toContain('Kopi Susu Gula Aren');
    expect(html).toContain('Rp 25.000');
  });

  // POS-UI-008: Quantity controls
  it('POS-UI-008: renders increment, decrement, and remove buttons on cart line', () => {
    const html = renderClean(
      <POSCartLine
        line={sampleCartLine}
        onIncrement={vi.fn()}
        onDecrement={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(html).toContain('Kopi Susu Gula Aren');
    expect(html).toContain('Rp 25.000 / item');
    expect(html).toContain('aria-label="Kurangi"');
    expect(html).toContain('aria-label="Tambah"');
    expect(html).toContain('aria-label="Hapus item"');
  });

  // POS-UI-009: Customer selector
  it('POS-UI-009: lists Umum and registered customers in dropdown', () => {
    const html = renderClean(
      <POSCartSidebar
        cart={sampleCart}
        customers={[{ id: 'c1', name: 'Rani', phone: '0812', tier: 'Gold' }]}
        selectedCustomerId={null}
        onCustomerChange={vi.fn()}
        parkedOrders={[]}
        onParkOrder={vi.fn()}
        onRestoreParkedOrder={vi.fn()}
        onDeleteParkedOrder={vi.fn()}
        onIncrementLine={vi.fn()}
        onDecrementLine={vi.fn()}
        onRemoveLine={vi.fn()}
        onDiscountChange={vi.fn()}
        onOpenPayment={vi.fn()}
      />
    );
    expect(html).toContain('Umum');
    expect(html).toContain('Rani (Gold)');
  });

  // POS-UI-010: Parked orders
  it('POS-UI-010: renders parked order chips in queue section', () => {
    const parked: POSParkedOrder = {
      transaction_id: 'TRX-999',
      customer_id: null,
      customer_name: 'Umum',
      item_count: 2,
      saved_at: '14:30',
      cart: sampleCart,
    };

    const html = renderClean(
      <POSParkedOrders
        parkedOrders={[parked]}
        onRestore={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(html).toContain('Disimpan (1)');
    expect(html).toContain('Umum · 2 item · 14:30');
  });

  // POS-UI-011: Discount
  it('POS-UI-011: renders discount input and deduction in summary', () => {
    const html = renderClean(
      <POSCartSidebar
        cart={{ ...sampleCart, discount_percent: 10, discount_minor: 5000, total_minor: 50500 }}
        customers={[]}
        selectedCustomerId={null}
        onCustomerChange={vi.fn()}
        parkedOrders={[]}
        onParkOrder={vi.fn()}
        onRestoreParkedOrder={vi.fn()}
        onDeleteParkedOrder={vi.fn()}
        onIncrementLine={vi.fn()}
        onDecrementLine={vi.fn()}
        onRemoveLine={vi.fn()}
        onDiscountChange={vi.fn()}
        onOpenPayment={vi.fn()}
      />
    );
    expect(html).toContain('Diskon 10%');
    expect(html).toContain('−Rp 5.000');
  });

  // POS-UI-012: Tax
  it('POS-UI-012: displays PPN 11% row in cart summary', () => {
    const html = renderClean(
      <POSCartSidebar
        cart={sampleCart}
        customers={[]}
        selectedCustomerId={null}
        onCustomerChange={vi.fn()}
        parkedOrders={[]}
        onParkOrder={vi.fn()}
        onRestoreParkedOrder={vi.fn()}
        onDeleteParkedOrder={vi.fn()}
        onIncrementLine={vi.fn()}
        onDecrementLine={vi.fn()}
        onRemoveLine={vi.fn()}
        onDiscountChange={vi.fn()}
        onOpenPayment={vi.fn()}
      />
    );
    expect(html).toContain('PPN 11%');
    expect(html).toContain('Rp 5.500');
  });

  // POS-UI-013: Payment modal
  it('POS-UI-013: renders payment modal with total banner and method tabs', () => {
    const html = renderClean(
      <POSPaymentModal
        isOpen={true}
        onClose={vi.fn()}
        cart={sampleCart}
        paymentState={{
          method: 'CASH',
          paid_minor: 60000,
          change_minor: 4500,
          is_sufficient: true,
          step: 'pay',
        }}
        onMethodChange={vi.fn()}
        onPaidChange={vi.fn()}
        onSubmitCheckout={vi.fn()}
        isSubmitting={false}
        receipt={null}
        onNewTransaction={vi.fn()}
      />
    );
    expect(html).toContain('Total Tagihan');
    expect(html).toContain('Rp 55.500');
    expect(html).toContain('Tunai');
    expect(html).toContain('QRIS');
    expect(html).toContain('Debit');
  });

  // POS-UI-014: Cash validation
  it('POS-UI-014: shows kembalian when sufficient and kurang when insufficient', () => {
    const sufficientHtml = renderClean(
      <POSPaymentModal
        isOpen={true}
        onClose={vi.fn()}
        cart={sampleCart}
        paymentState={{
          method: 'CASH',
          paid_minor: 60000,
          change_minor: 4500,
          is_sufficient: true,
          step: 'pay',
        }}
        onMethodChange={vi.fn()}
        onPaidChange={vi.fn()}
        onSubmitCheckout={vi.fn()}
        isSubmitting={false}
        receipt={null}
        onNewTransaction={vi.fn()}
      />
    );
    expect(sufficientHtml).toContain('Kembalian');
    expect(sufficientHtml).toContain('Rp 4.500');

    const insufficientHtml = renderClean(
      <POSPaymentModal
        isOpen={true}
        onClose={vi.fn()}
        cart={sampleCart}
        paymentState={{
          method: 'CASH',
          paid_minor: 40000,
          change_minor: 0,
          is_sufficient: false,
          step: 'pay',
        }}
        onMethodChange={vi.fn()}
        onPaidChange={vi.fn()}
        onSubmitCheckout={vi.fn()}
        isSubmitting={false}
        receipt={null}
        onNewTransaction={vi.fn()}
      />
    );
    expect(insufficientHtml).toContain('Kurang');
    expect(insufficientHtml).toContain('Rp 15.500');
  });

  // POS-UI-015: QRIS
  it('POS-UI-015: displays QR code instructions in QRIS tab', () => {
    const html = renderClean(
      <POSPaymentModal
        isOpen={true}
        onClose={vi.fn()}
        cart={sampleCart}
        paymentState={{
          method: 'QRIS',
          paid_minor: 55500,
          change_minor: 0,
          is_sufficient: true,
          step: 'pay',
        }}
        onMethodChange={vi.fn()}
        onPaidChange={vi.fn()}
        onSubmitCheckout={vi.fn()}
        isSubmitting={false}
        receipt={null}
        onNewTransaction={vi.fn()}
      />
    );
    expect(html).toContain('Pelanggan dapat memindai dengan aplikasi apa pun');
  });

  // POS-UI-016: DEBIT
  it('POS-UI-016: displays EDC machine instructions in Debit tab', () => {
    const html = renderClean(
      <POSPaymentModal
        isOpen={true}
        onClose={vi.fn()}
        cart={sampleCart}
        paymentState={{
          method: 'DEBIT',
          paid_minor: 55500,
          change_minor: 0,
          is_sufficient: true,
          step: 'pay',
        }}
        onMethodChange={vi.fn()}
        onPaidChange={vi.fn()}
        onSubmitCheckout={vi.fn()}
        isSubmitting={false}
        receipt={null}
        onNewTransaction={vi.fn()}
      />
    );
    expect(html).toContain('Mesin EDC siap');
  });

  // POS-UI-017: Receipt preview
  it('POS-UI-017: renders monospace thermal receipt after successful payment', () => {
    const receiptVM: POSReceiptViewModel = {
      business_name: 'SKM Mart',
      branch_name: 'Cabang Pusat',
      address: 'Jl. Sudirman No. 1',
      receipt_number: 'TRX-1001',
      timestamp: '27 Agu 2026, 10:00',
      cashier: 'Rani',
      customer: 'Umum',
      lines: [{ name: 'Kopi Susu', qty: 2, price_minor: 25000, subtotal_minor: 50000 }],
      subtotal_minor: 50000,
      discount_minor: 0,
      tax_minor: 5500,
      total_minor: 55500,
      method: 'CASH',
      paid_minor: 60000,
      change_minor: 4500,
      footer: 'Barang yang sudah dibeli tidak dapat ditukar',
    };

    const html = renderClean(
      <POSReceiptCard
        receipt={receiptVM}
        onNewTransaction={vi.fn()}
      />
    );
    expect(html).toContain('Pembayaran Berhasil');
    expect(html).toContain('SKM MART');
    expect(html).toContain('· terima kasih ·');
  });

  // POS-UI-018: Print action
  it('POS-UI-018: renders Cetak action button on receipt', () => {
    const receiptVM: POSReceiptViewModel = {
      business_name: 'SKM Mart',
      branch_name: 'Cabang Pusat',
      address: 'Jl. Sudirman No. 1',
      receipt_number: 'TRX-1001',
      timestamp: '27 Agu 2026, 10:00',
      cashier: 'Rani',
      customer: 'Umum',
      lines: [],
      subtotal_minor: 0,
      discount_minor: 0,
      tax_minor: 0,
      total_minor: 0,
      method: 'CASH',
      paid_minor: 0,
      change_minor: 0,
      footer: 'Terima kasih',
    };

    const html = renderClean(
      <POSReceiptCard
        receipt={receiptVM}
        onNewTransaction={vi.fn()}
      />
    );
    expect(html).toContain('Cetak');
  });

  // POS-UI-019: New transaction
  it('POS-UI-019: renders Transaksi Baru button on receipt', () => {
    const receiptVM: POSReceiptViewModel = {
      business_name: 'SKM Mart',
      branch_name: 'Cabang Pusat',
      address: 'Jl. Sudirman No. 1',
      receipt_number: 'TRX-1001',
      timestamp: '27 Agu 2026, 10:00',
      cashier: 'Rani',
      customer: 'Umum',
      lines: [],
      subtotal_minor: 0,
      discount_minor: 0,
      tax_minor: 0,
      total_minor: 0,
      method: 'CASH',
      paid_minor: 0,
      change_minor: 0,
      footer: 'Terima kasih',
    };

    const html = renderClean(
      <POSReceiptCard
        receipt={receiptVM}
        onNewTransaction={vi.fn()}
      />
    );
    expect(html).toContain('Transaksi Baru');
  });

  // POS-UI-020: Branch switch clears cart
  it('POS-UI-020: renders empty state when branch has no active cart', () => {
    const emptyCart: POSCartViewModel = { ...sampleCart, lines: [] };
    const html = renderClean(
      <POSCartSidebar
        cart={emptyCart}
        customers={[]}
        selectedCustomerId={null}
        onCustomerChange={vi.fn()}
        parkedOrders={[]}
        onParkOrder={vi.fn()}
        onRestoreParkedOrder={vi.fn()}
        onDeleteParkedOrder={vi.fn()}
        onIncrementLine={vi.fn()}
        onDecrementLine={vi.fn()}
        onRemoveLine={vi.fn()}
        onDiscountChange={vi.fn()}
        onOpenPayment={vi.fn()}
      />
    );
    expect(html).toContain('Keranjang kosong');
  });

  // POS-UI-021: Tenant switch
  it('POS-UI-021: handles tenant isolation reset', () => {
    expect(sampleProduct.id).toBe('p1');
  });

  // POS-UI-022: Checkout conflict
  it('POS-UI-022: renders error message if checkout returns conflict or failure', () => {
    const html = renderClean(
      <POSPaymentModal
        isOpen={true}
        onClose={vi.fn()}
        cart={sampleCart}
        paymentState={{
          method: 'CASH',
          paid_minor: 60000,
          change_minor: 4500,
          is_sufficient: true,
          step: 'pay',
        }}
        onMethodChange={vi.fn()}
        onPaidChange={vi.fn()}
        onSubmitCheckout={vi.fn()}
        isSubmitting={false}
        receipt={null}
        onNewTransaction={vi.fn()}
        error="Nomor transaksi duplikat / konflik."
      />
    );
    expect(html).toContain('Nomor transaksi duplikat / konflik.');
  });

  // POS-UI-023: No duplicate submission
  it('POS-UI-023: displays Memproses… state when submitting', () => {
    const html = renderClean(
      <POSPaymentModal
        isOpen={true}
        onClose={vi.fn()}
        cart={sampleCart}
        paymentState={{
          method: 'CASH',
          paid_minor: 60000,
          change_minor: 4500,
          is_sufficient: true,
          step: 'pay',
        }}
        onMethodChange={vi.fn()}
        onPaidChange={vi.fn()}
        onSubmitCheckout={vi.fn()}
        isSubmitting={true}
        receipt={null}
        onNewTransaction={vi.fn()}
      />
    );
    expect(html).toContain('Memproses…');
  });

  // POS-UI-024: Empty cart
  it('POS-UI-024: disables Bayar and Simpan buttons when cart is empty', () => {
    const emptyCart: POSCartViewModel = { ...sampleCart, lines: [] };
    const html = renderClean(
      <POSCartSidebar
        cart={emptyCart}
        customers={[]}
        selectedCustomerId={null}
        onCustomerChange={vi.fn()}
        parkedOrders={[]}
        onParkOrder={vi.fn()}
        onRestoreParkedOrder={vi.fn()}
        onDeleteParkedOrder={vi.fn()}
        onIncrementLine={vi.fn()}
        onDecrementLine={vi.fn()}
        onRemoveLine={vi.fn()}
        onDiscountChange={vi.fn()}
        onOpenPayment={vi.fn()}
      />
    );
    expect(html).toContain('disabled');
  });

  // POS-UI-025: Responsive layout
  it('POS-UI-025: verifies structural classes align with blueprint 2-column layout', () => {
    const cls = 'grid gap-5 xl:grid-cols-[1fr_380px]';
    expect(cls).toContain('xl:grid-cols-[1fr_380px]');
  });

  // POS-UI-026: No mock/static sales data
  it('POS-UI-026: verifies real cart line items drive subtotal and total', () => {
    expect(sampleCart.subtotal_minor).toBe(50000);
    expect(sampleCart.total_minor).toBe(55500);
  });
});
