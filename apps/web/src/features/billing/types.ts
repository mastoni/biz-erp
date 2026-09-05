/**
 * Customer Recurring Billing Types & Contracts for Web ERP
 */

export type CustomerSubscriptionBillingCycle =
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMI_ANNUAL'
  | 'ANNUAL';

export type CustomerSubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

export type CustomerInvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED';

export type CustomerPaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'debit'
  | 'credit';

export const BILLING_CYCLE_LABELS: Record<CustomerSubscriptionBillingCycle, string> = {
  MONTHLY: 'Bulanan',
  QUARTERLY: 'Triwulan (3 Bln)',
  SEMI_ANNUAL: 'Semester (6 Bln)',
  ANNUAL: 'Tahunan (12 Bln)',
};

export const SUBSCRIPTION_STATUS_LABELS: Record<CustomerSubscriptionStatus, string> = {
  ACTIVE: 'Aktif',
  PAUSED: 'Ditunda',
  CANCELLED: 'Dibatalkan',
};

export const INVOICE_STATUS_LABELS: Record<CustomerInvoiceStatus, string> = {
  DRAFT: 'Draf',
  ISSUED: 'Diterbitkan',
  PAID: 'Lunas',
  OVERDUE: 'Jatuh Tempo',
  CANCELLED: 'Dibatalkan',
};

export const PAYMENT_METHOD_LABELS: Record<CustomerPaymentMethod, string> = {
  cash: 'Tunai (Cash)',
  bank_transfer: 'Transfer Bank',
  debit: 'Kartu Debit',
  credit: 'Kartu Kredit',
};

// =========================================================================
// SUBSCRIPTION DTOs & PAYLOADS
// =========================================================================

export interface CustomerSubscriptionDto {
  id: string;
  business_id: string;
  customer_id: string;
  customer_name?: string;
  plan_code: string | null;
  product_id: string | null;
  name: string;
  unit_price_minor: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  currency: string;
  billing_cycle: CustomerSubscriptionBillingCycle;
  status: CustomerSubscriptionStatus;
  starts_at: string;
  ends_at: string | null;
  next_billing_date: string;
  anchor_day: number;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CustomerSubscriptionDetailDto extends CustomerSubscriptionDto {
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  invoices_count?: number;
  total_billed_minor?: number;
  total_paid_minor?: number;
  invoices?: CustomerInvoiceDto[];
}

export interface CustomerSubscriptionListResponse {
  items: CustomerSubscriptionDto[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface CreateCustomerSubscriptionPayload {
  customer_id: string;
  name: string;
  plan_code?: string | null;
  product_id?: string | null;
  unit_price_minor: number;
  discount_minor?: number;
  tax_minor?: number;
  total_minor?: number;
  currency?: string;
  billing_cycle: CustomerSubscriptionBillingCycle;
  starts_at?: string;
  ends_at?: string | null;
  next_billing_date?: string;
  anchor_day?: number;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateCustomerSubscriptionPayload {
  name?: string;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  ends_at?: string | null;
  // Financial fields (OWNER only)
  unit_price_minor?: number;
  discount_minor?: number;
  tax_minor?: number;
  total_minor?: number;
  billing_cycle?: CustomerSubscriptionBillingCycle;
}

export interface SubscriptionActionPayload {
  reason?: string;
  effective_date?: string;
}

export interface GenerateInvoicePayload {
  billing_period_start?: string;
  billing_period_end?: string;
  due_date?: string;
  notes?: string | null;
}

export interface CustomerSubscriptionFilterModel {
  customer_id?: string;
  status?: CustomerSubscriptionStatus | '';
  billing_cycle?: CustomerSubscriptionBillingCycle | '';
  search?: string;
  limit?: number;
  offset?: number;
}

// =========================================================================
// INVOICE DTOs & PAYLOADS
// =========================================================================

export interface CustomerInvoiceDto {
  id: string;
  invoice_number: string;
  business_id: string;
  customer_subscription_id: string;
  customer_id: string;
  customer_name?: string;
  receivable_id: string;
  billing_period_start: string;
  billing_period_end: string;
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  outstanding_minor?: number;
  paid_minor?: number;
  currency: string;
  status: CustomerInvoiceStatus;
  issue_date: string;
  due_date: string;
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CustomerInvoiceDetailDto extends CustomerInvoiceDto {
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  subscription_name?: string;
  subscription_billing_cycle?: CustomerSubscriptionBillingCycle;
  receivable_status?: string;
  journal_entry_id?: string | null;
  journal_status?: string | null;
  payments?: CustomerPaymentRecord[];
}

export interface CustomerPaymentRecord {
  id: string;
  amount_minor: number;
  method: CustomerPaymentMethod;
  reference: string | null;
  created_at: string;
}

export interface CustomerInvoiceListResponse {
  items: CustomerInvoiceDto[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface RecordInvoicePaymentPayload {
  amount_minor: number;
  method: CustomerPaymentMethod;
  reference?: string | null;
  idempotency_key: string;
}

export interface CancelInvoicePayload {
  reason?: string;
}

export interface CustomerInvoiceFilterModel {
  customer_id?: string;
  customer_subscription_id?: string;
  status?: CustomerInvoiceStatus | '';
  date_from?: string;
  date_to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// =========================================================================
// DASHBOARD & SUMMARY KPI MODEL
// =========================================================================

export interface BillingDashboardKPI {
  activeSubscriptionsCount: number;
  pausedSubscriptionsCount: number;
  totalSubscriptionsCount: number;
  monthlyRecurringRevenueMinor: number;
  upcomingBillingCount: number;
  upcomingBillingAmountMinor: number;
  overdueInvoicesCount: number;
  overdueInvoicesAmountMinor: number;
  totalOutstandingReceivablesMinor: number;
  totalPaidThisMonthMinor: number;
}
