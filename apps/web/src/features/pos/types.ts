/**
 * POS domain & ViewModel types.
 */

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
export type PaymentMethod = 'CASH' | 'QRIS' | 'DEBIT';
export type PaymentStep = 'pay' | 'done';

export type POSDataState = 'loading' | 'ready' | 'empty' | 'error';
export type POSCheckoutState = 'idle' | 'submitting' | 'success' | 'conflict' | 'error';

export interface POSProductViewModel {
  id: string;
  name: string;
  sku: string;
  category: string;
  price_minor: number;
  quantity_available: number;
  stock_status: StockStatus;
  min_stock: number;
  image_url?: string | null;
  image_enabled?: boolean;
}

export interface POSCustomerViewModel {
  id: string;
  name: string;
  phone: string | null;
  tier: string;
}

export interface POSCartLineViewModel {
  product_id: string;
  product_name: string;
  sku: string;
  category: string;
  quantity: number;
  unit_price_minor: number;
  line_subtotal_minor: number;
  quantity_available: number;
}

export interface POSCartViewModel {
  transaction_id: string;
  customer_id: string | null;
  customer_name: string;
  lines: POSCartLineViewModel[];
  subtotal_minor: number;
  discount_percent: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  item_count: number;
}

export interface POSParkedOrder {
  transaction_id: string;
  customer_id: string | null;
  customer_name: string;
  item_count: number;
  saved_at: string;
  cart: POSCartViewModel;
}

export interface POSPaymentState {
  method: PaymentMethod;
  paid_minor: number;
  change_minor: number;
  is_sufficient: boolean;
  step: PaymentStep;
}

export interface POSReceiptLine {
  name: string;
  qty: number;
  price_minor: number;
  subtotal_minor: number;
}

export interface POSReceiptViewModel {
  business_name: string;
  branch_name: string;
  address: string;
  receipt_number: string;
  timestamp: string;
  cashier: string;
  customer: string;
  lines: POSReceiptLine[];
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  method: PaymentMethod;
  paid_minor: number;
  change_minor: number;
  footer: string;
  tax_rate_percent?: number;
  phone?: string;
}

export interface POSDailyCounter {
  total_sales: number;
  total_revenue_minor: number;
}
