export interface Branch {
  id: string;
  business_id: string;
  name: string;
  status: boolean;
  created_at: string;
  updated_at: string;
}

export interface BranchListResponse {
  items: Branch[];
}

export interface Stock {
  id: string;
  business_id: string;
  branch_id: string;
  product_id: string;
  quantity: number;
  server_version: number;
  created_at: string;
  updated_at: string;
}

export interface StockWithProduct {
  id: string;
  business_id: string;
  branch_id: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  category: string | null;
  barcode: string | null;
  price_minor: number;
  cost_minor: number | null;
  quantity: number;
  server_version: number;
  created_at: string;
  updated_at: string;
}

export interface StockListResponse {
  items: StockWithProduct[];
}

export interface StockMovement {
  id: string;
  business_id: string;
  branch_id: string;
  product_id: string;
  quantity: number;
  movement_type: string;
  reference: string | null;
  actor: string;
  timestamp: string;
}

export interface MovementListResponse {
  items: StockMovement[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface StockAdjustmentPayload {
  business_id: string;
  branch_id: string;
  product_id: string;
  quantity_change: number;
  expected_server_version: number;
  reference?: string | null;
  movement_type?: 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT';
}

export interface StockAdjustmentResponse {
  stock: Stock;
  movement: StockMovement;
}

export interface StockSummary {
  total_stock_value_minor: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_skus: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4C — Inventory ViewModels, filters, and state types
// ─────────────────────────────────────────────────────────────────────────────

export type InventoryMovementType = 'ADJUSTMENT' | 'STOCK_IN' | 'STOCK_OUT';

export type InventoryStockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export type InventoryStockStatusFilter = InventoryStockStatus;

export interface InventoryStockViewModel {
  product_id: string;
  product_name: string;
  sku: string | null;
  category: string | null;
  barcode: string | null;
  price_minor: number;
  cost_minor: number | null;
  quantity: number;
  server_version: number;
  updated_at: string;
  stock_status: InventoryStockStatus;
}

export interface InventorySummaryViewModel {
  total_stock_value_minor: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_skus: number;
}

export interface InventoryMovementViewModel {
  id: string;
  branch_id: string;
  product_id: string;
  product_name: string | null;
  quantity: number;
  movement_type: InventoryMovementType;
  reference: string | null;
  actor: string;
  timestamp: string;
}

export interface InventoryListViewModel {
  items: InventoryStockViewModel[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface InventoryMovementListViewModel {
  items: InventoryMovementViewModel[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface InventoryFilterModel {
  search?: string;
  category?: string;
  status?: InventoryStockStatusFilter;
  product_id?: string;
  page?: number;
  limit?: number;
  offset?: number;
}

export interface InventoryMovementFilterModel {
  product_id?: string;
  limit?: number;
  offset?: number;
}

export interface InventoryAdjustmentFormModel {
  product_id: string;
  quantity_change: number;
  movement_type: InventoryMovementType;
  reference?: string | null;
  expected_server_version: number;
}

export type InventoryDataState = 'loading' | 'ready' | 'empty' | 'error';

export type InventoryMutationState = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

export type InventoryMutationErrorType =
  | 'conflict'
  | 'validation'
  | 'forbidden'
  | 'not_found'
  | 'network'
  | 'unknown';

export interface InventoryMutationError {
  type: InventoryMutationErrorType;
  message: string;
}
