export type PurchaseStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';

export type SupplierTerm = 'Tunai' | 'Tempo 14' | 'Tempo 30';

export type PaymentMethod = 'cash' | 'bank_transfer' | 'debit' | 'credit';

export type PurchaseTone = 'fog' | 'tide' | 'pine' | 'clay';

export type PurchasePaymentState = 'paid' | 'partial' | 'unpaid' | 'not_applicable';

export type PurchaseErrorKind =
  | 'code_conflict'
  | 'version_conflict'
  | 'stock_version_conflict'
  | 'validation_error'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'network_error'
  | 'unknown';

export type PurchasesDataState = 'loading' | 'ready' | 'empty' | 'error';

export type PurchasesMutationState = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

// ---------------------------------------------------------------------------
// Canonical Data Models (matches API DTOs)
// ---------------------------------------------------------------------------

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string | null;
  product_name: string;
  ordered_qty: number;
  received_qty: number;
  unit_cost_minor: number;
  subtotal_minor: number;
}

export interface PurchasePayment {
  id: string;
  business_id: string;
  purchase_id: string;
  amount_minor: number;
  method: PaymentMethod;
  reference: string | null;
  idempotency_key: string;
  created_at: string;
}

export interface Purchase {
  id: string;
  business_id: string;
  branch_id: string;
  supplier_id: string;
  supplier_name?: string;
  supplier_code?: string;
  code: string;
  date: string;
  due_date: string;
  supplier_term: SupplierTerm;
  status: PurchaseStatus;
  total_minor: number;
  received_minor: number;
  paid_minor: number;
  outstanding_minor: number;
  note: string | null;
  server_version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  items?: PurchaseItem[];
  payments?: PurchasePayment[];
}

export interface PurchaseSummaryKPI {
  total_purchases: number;
  draft_count: number;
  sent_count: number;
  partial_count: number;
  received_count: number;
  cancelled_count: number;
  total_value_minor: number;
  outstanding_minor: number;
}

export interface PurchaseListResponse {
  items: Purchase[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  summary?: PurchaseSummaryKPI;
}

// ---------------------------------------------------------------------------
// Presentation ViewModels
// ---------------------------------------------------------------------------

export interface PurchaseLineViewModel {
  id: string;
  purchase_id: string;
  product_id: string | null;
  product_name: string;
  ordered_qty: number;
  received_qty: number;
  remaining_qty: number;
  unit_cost_minor: number;
  subtotal_minor: number;
  received_value_minor: number;
}

export interface PurchasePaymentViewModel {
  id: string;
  purchase_id: string;
  amount_minor: number;
  method: PaymentMethod;
  reference: string | null;
  idempotency_key: string;
  created_at: string;
}

export interface PurchaseViewModel {
  id: string;
  business_id: string;
  branch_id: string;
  supplier_id: string;
  supplier_name?: string;
  supplier_code?: string;
  code: string;
  date: string;
  due_date: string;
  supplier_term: SupplierTerm;
  status: PurchaseStatus;
  status_label: string;
  status_tone: PurchaseTone;
  payment_state: PurchasePaymentState;
  total_minor: number;
  received_minor: number;
  paid_minor: number;
  outstanding_minor: number;
  note: string | null;
  server_version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  items: PurchaseLineViewModel[];
  payments: PurchasePaymentViewModel[];
  received_total_qty: number;
  ordered_total_qty: number;
  remaining_total_qty: number;
  receive_percentage: number;
}

export interface PurchasesListViewModel {
  items: PurchaseViewModel[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  summary: PurchaseSummaryKPI;
}

// ---------------------------------------------------------------------------
// Filter & Mutation Models
// ---------------------------------------------------------------------------

export interface PurchaseFilterModel {
  search?: string;
  status?: string;
  supplierId?: string;
  term?: string;
}

export interface PurchaseCreateItemInput {
  product_id: string;
  ordered_qty: number;
  id?: string;
}

export interface PurchaseCreateInput {
  id: string;
  business_id: string;
  branch_id: string;
  supplier_id: string;
  items: PurchaseCreateItemInput[];
  date?: string;
  due_date?: string;
  note?: string | null;
  status?: 'draft' | 'sent';
}

export interface PurchaseUpdateDraftInput {
  business_id: string;
  expected_server_version: number;
  branch_id?: string;
  supplier_id?: string;
  items?: PurchaseCreateItemInput[];
  date?: string;
  due_date?: string;
  note?: string | null;
}

export interface PurchaseSendInput {
  business_id: string;
  expected_server_version: number;
}

export interface PurchaseReceiveItemInput {
  item_id: string;
  receive_qty: number;
}

export interface PurchaseReceiveInput {
  business_id: string;
  expected_server_version: number;
  items: PurchaseReceiveItemInput[];
}

export interface PurchasePayInput {
  business_id: string;
  expected_server_version: number;
  amount_minor: number;
  method: PaymentMethod;
  reference?: string | null;
}

export interface PurchaseCancelInput {
  business_id: string;
  expected_server_version: number;
}
