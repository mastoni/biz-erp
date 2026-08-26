/**
 * Pure helper functions for Web POS calculations, mappings, and validation.
 * All financial arithmetic uses integer minor units (never floating points).
 */

import { Product } from '@/features/products/types';
import {
  POSCartLineViewModel,
  POSCartViewModel,
  POSCustomerViewModel,
  POSProductViewModel,
  POSReceiptViewModel,
  PaymentMethod,
  StockStatus,
} from './types';
import { Customer } from '@/features/customers/types';

/**
 * Standard Indonesian VAT (PPN) rate.
 * Marked as canonical standard default; dynamic tenant settings is a future P1.
 */
export const DEFAULT_TAX_RATE = 11;
export const DEFAULT_MIN_STOCK_THRESHOLD = 5;

/**
 * Formats minor units to IDR display string.
 */
export function idr(minor: number): string {
  return 'Rp ' + Math.round(minor).toLocaleString('id-ID');
}

/**
 * Formats minor units to compact IDR display (e.g. Rp 8,45 jt or Rp 386 rb).
 */
export function idrShort(minor: number): string {
  const v = minor / 1000;
  if (v >= 1_000_000) {
    const jt = v / 1_000_000;
    return `Rp ${jt >= 100 ? Math.round(jt) : jt.toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  }
  if (v >= 1_000) {
    const jt = v / 1_000;
    return `Rp ${jt >= 100 ? Math.round(jt) : jt.toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  }
  return `Rp ${Math.round(v).toLocaleString('id-ID')} rb`;
}

/**
 * Generates deterministic transaction ID matching blueprint format.
 */
export function createTransactionId(): string {
  return `TRX-${String(Date.now()).slice(-6)}`;
}

/**
 * Calculates discount minor units from subtotal and percentage.
 * Clamps discount percentage between 0 and 100.
 */
export function calculateDiscount(subtotalMinor: number, discountPercent: number): number {
  if (subtotalMinor <= 0) return 0;
  const clampedPct = Math.max(0, Math.min(100, discountPercent || 0));
  return Math.round((subtotalMinor * clampedPct) / 100);
}

/**
 * Calculates PPN tax minor units from taxable base.
 */
export function calculateTax(taxableBaseMinor: number, taxRate: number = DEFAULT_TAX_RATE): number {
  if (taxableBaseMinor <= 0) return 0;
  const rate = Math.max(0, taxRate || 0);
  return Math.round((taxableBaseMinor * rate) / 100);
}

/**
 * Calculates all cart totals deterministically with minor unit integer arithmetic.
 */
export function calculateCartTotals(
  lines: POSCartLineViewModel[],
  discountPercent: number = 0,
  taxRate: number = DEFAULT_TAX_RATE
): {
  subtotal_minor: number;
  discount_percent: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  item_count: number;
} {
  const subtotal_minor = lines.reduce((acc, l) => acc + l.line_subtotal_minor, 0);
  const clampedDiscountPct = Math.max(0, Math.min(100, discountPercent || 0));
  const discount_minor = calculateDiscount(subtotal_minor, clampedDiscountPct);
  const taxable_base = Math.max(0, subtotal_minor - discount_minor);
  const tax_minor = calculateTax(taxable_base, taxRate);
  const total_minor = taxable_base + tax_minor;
  const item_count = lines.reduce((acc, l) => acc + l.quantity, 0);

  return {
    subtotal_minor,
    discount_percent: clampedDiscountPct,
    discount_minor,
    tax_minor,
    total_minor,
    item_count,
  };
}

/**
 * Validates whether a product can be added to the cart given its current quantity.
 */
export function canAddToCart(product: POSProductViewModel, currentQtyInCart: number = 0): boolean {
  if (product.quantity_available <= 0) return false;
  return currentQtyInCart + 1 <= product.quantity_available;
}

/**
 * Calculates cash change amount (paid - total).
 */
export function calculateChange(paidMinor: number, totalMinor: number): number {
  return paidMinor - totalMinor;
}

/**
 * Maps raw Product + branch stock into POSProductViewModel.
 */
export function mapPOSProductViewModel(
  product: Product,
  stockQuantity: number,
  minStock: number = DEFAULT_MIN_STOCK_THRESHOLD
): POSProductViewModel {
  const qty = Math.max(0, stockQuantity || 0);
  let status: StockStatus = 'in_stock';
  if (qty <= 0) {
    status = 'out_of_stock';
  } else if (qty <= minStock) {
    status = 'low_stock';
  }

  return {
    id: product.id,
    name: product.name,
    sku: product.sku || 'SKU-NONE',
    category: product.category || 'Umum',
    price_minor: product.price_minor,
    quantity_available: qty,
    stock_status: status,
    min_stock: minStock,
  };
}

/**
 * Maps raw Customer into POSCustomerViewModel.
 */
export function mapPOSCustomerViewModel(customer: Customer): POSCustomerViewModel {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    tier: customer.tier || 'Reguler',
  };
}

/**
 * Builds canonical checkout batch payload for POST /v1/sync/sales/batch.
 */
export function buildCheckoutPayload(params: {
  businessId: string;
  branchId: string;
  cart: POSCartViewModel;
  paymentMethod: PaymentMethod;
  paidMinor: number;
  changeMinor: number;
  cashierId?: string | null;
  idempotencyKey?: string;
}): {
  business_id: string;
  items: Array<{
    idempotency_key: string;
    request_hash: string;
    sale: {
      id: string;
      receipt_number: string;
      subtotal_minor: number;
      discount_minor: number;
      tax_minor: number;
      total_minor: number;
      payment_method: string;
      paid_minor: number;
      change_minor: number;
      cashier_id: string | null;
      customer_id: string | null;
      branch_id: string;
      created_at: string;
      client_created_at: string;
    };
    sale_items: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      unit_price_minor: number;
      subtotal_minor: number;
    }>;
  }>;
} {
  const now = new Date().toISOString();
  const saleId = (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) || `sale-${Date.now()}`;
  const idempotencyKey = params.idempotencyKey || ((globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) || `idem-${Date.now()}`);

  const rawHashStr = `${params.businessId}|${params.branchId}|${params.cart.transaction_id}|${params.cart.total_minor}|${params.paymentMethod}`;
  // Simple deterministic client hash fallback
  let hashVal = 0;
  for (let i = 0; i < rawHashStr.length; i++) {
    hashVal = ((hashVal << 5) - hashVal + rawHashStr.charCodeAt(i)) | 0;
  }
  const requestHash = Math.abs(hashVal).toString(16).padStart(32, '0');

  return {
    business_id: params.businessId,
    items: [
      {
        idempotency_key: idempotencyKey,
        request_hash: requestHash,
        sale: {
          id: saleId,
          receipt_number: params.cart.transaction_id,
          subtotal_minor: params.cart.subtotal_minor,
          discount_minor: params.cart.discount_minor,
          tax_minor: params.cart.tax_minor,
          total_minor: params.cart.total_minor,
          payment_method: params.paymentMethod,
          paid_minor: params.paidMinor,
          change_minor: params.changeMinor,
          cashier_id: params.cashierId ?? null,
          customer_id: params.cart.customer_id,
          branch_id: params.branchId,
          created_at: now,
          client_created_at: now,
        },
        sale_items: params.cart.lines.map((line) => ({
          product_id: line.product_id,
          product_name: line.product_name,
          quantity: line.quantity,
          unit_price_minor: line.unit_price_minor,
          subtotal_minor: line.line_subtotal_minor,
        })),
      },
    ],
  };
}

/**
 * Builds printable POSReceiptViewModel matching thermal blueprint.
 */
export function buildPOSReceiptViewModel(params: {
  businessName: string;
  branchName: string;
  address?: string;
  cart: POSCartViewModel;
  paymentMethod: PaymentMethod;
  paidMinor: number;
  changeMinor: number;
  cashierName: string;
  footer?: string;
}): POSReceiptViewModel {
  const dateStr = new Date().toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    business_name: params.businessName || 'SKM MART',
    branch_name: params.branchName || 'Cabang Utama',
    address: params.address || 'Jl. Jend. Sudirman Kav. 52-53, Jakarta Selatan',
    receipt_number: params.cart.transaction_id,
    timestamp: dateStr,
    cashier: params.cashierName || 'Kasir',
    customer: params.cart.customer_name || 'Umum',
    lines: params.cart.lines.map((l) => ({
      name: l.product_name,
      qty: l.quantity,
      price_minor: l.unit_price_minor,
      subtotal_minor: l.line_subtotal_minor,
    })),
    subtotal_minor: params.cart.subtotal_minor,
    discount_minor: params.cart.discount_minor,
    tax_minor: params.cart.tax_minor,
    total_minor: params.cart.total_minor,
    method: params.paymentMethod,
    paid_minor: params.paidMinor,
    change_minor: params.changeMinor,
    footer: params.footer || 'Barang yang sudah dibeli tidak dapat ditukar',
  };
}
