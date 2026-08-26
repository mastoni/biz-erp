import type { AxiosError } from 'axios';

export interface Product {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price_minor: number;
  cost_minor: number | null;
  category: string | null;
  barcode: string | null;
  image_url?: string | null;
  image_enabled?: boolean;
  is_active: boolean;
  server_version: number;
  created_at: string;
  updated_at: string;
}

export interface ProductSyncResponse {
  items: Product[];
  current_version: number;
  has_more: boolean;
}

export interface ProductCreatePayload {
  id: string;
  business_id: string;
  name: string;
  price_minor: number;
  description?: string | null;
  sku?: string | null;
  cost_minor?: number | null;
  category?: string | null;
  barcode?: string | null;
  image_url?: string | null;
  image_enabled?: boolean;
  is_active?: boolean;
}

export interface ProductUpdatePayload {
  business_id: string;
  expected_server_version: number;
  name?: string;
  price_minor?: number;
  description?: string | null;
  sku?: string | null;
  cost_minor?: number | null;
  category?: string | null;
  barcode?: string | null;
  image_url?: string | null;
  image_enabled?: boolean;
  is_active?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3C — Data-layer ViewModels and state types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductViewModel {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  category: string | null;
  barcode: string | null;
  image_url?: string | null;
  image_enabled?: boolean;
  price_minor: number;
  cost_minor: number | null;
  margin_minor: number | null;
  margin_percent: number | null;
  is_active: boolean;
  server_version: number;
  stock_quantity: number | null;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';
  created_at: string;
  updated_at: string;
}

export interface ProductListViewModel {
  items: ProductViewModel[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface ProductStockViewModel {
  product_id: string;
  branch_id: string;
  quantity: number;
}

export interface ProductFilterModel {
  search: string;
  category: string;
  barcode: string;
}

export interface ProductFormModel {
  name: string;
  description: string;
  sku: string;
  category: string;
  barcode: string;
  image_url?: string;
  image_enabled?: boolean;
  price_minor: number;
  cost_minor: number | null;
  is_active: boolean;
}

export interface ProductListParams {
  business_id: string;
  search?: string;
  category?: string;
  barcode?: string;
  limit?: number;
  offset?: number;
}

export type ProductDataState = 'loading' | 'ready' | 'empty' | 'error';
export type ProductSaveState = 'saving' | 'saved' | 'conflict' | 'error';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';

export type ProductOperationError =
  | { type: 'sku_conflict'; sku: string | null; message: string }
  | { type: 'barcode_conflict'; barcode: string | null; message: string }
  | { type: 'version_conflict'; expected: number; current: number; message: string }
  | { type: 'validation_error'; details: Record<string, string>; message: string }
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; message: string }
  | { type: 'network_error'; message: string }
  | { type: 'unknown'; message: string };

export interface ConflictDetails {
  code: string;
  message: string;
  details: {
    current_server_version?: number;
    current_product?: unknown;
    sku?: string | null;
    barcode?: string | null;
  };
}

export function isConflictError(error: unknown): error is AxiosError<ConflictDetails> {
  return error instanceof Error && 'response' in error &&
    (error as AxiosError).response?.status === 409;
}

export const LOW_STOCK_THRESHOLD = 5;
