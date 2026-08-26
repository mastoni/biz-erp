import { AxiosError } from 'axios';
import {
  InventoryAdjustmentFormModel,
  InventoryDataState,
  InventoryFilterModel,
  InventoryMovementType,
  InventoryMovementViewModel,
  InventoryMutationError,
  InventoryStockStatus,
  InventoryStockViewModel,
  InventoryStockStatusFilter,
  InventorySummaryViewModel,
  StockMovement,
  StockSummary,
  StockWithProduct,
} from './types';
import { isConflictError, isClientValidationError } from './error-helpers';
import { LOW_STOCK_THRESHOLD } from '../products/types';

// Canonical low-stock threshold. Single source of truth on web:
// products/types.ts (mirrors the canonical backend LOW_STOCK_THRESHOLD = 5).
// Do not redeclare the numeric value anywhere else.
export { LOW_STOCK_THRESHOLD };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Stock status ──────────────────────────────────────────────────────────────

export function getStockStatus(quantity: number): InventoryStockStatus {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= LOW_STOCK_THRESHOLD) return 'low_stock';
  return 'in_stock';
}

export function formatInventoryStatus(status: InventoryStockStatus): string {
  switch (status) {
    case 'in_stock':
      return 'In stock';
    case 'low_stock':
      return 'Low stock';
    case 'out_of_stock':
      return 'Out of stock';
  }
}

// ── Stock value ───────────────────────────────────────────────────────────────

export function calculateStockValue(priceMinor: number, quantity: number): number {
  return priceMinor * quantity;
}

// ── ViewModel mapping ─────────────────────────────────────────────────────────

export function mapSummaryToInventorySummaryViewModel(summary: StockSummary): InventorySummaryViewModel {
  return {
    total_stock_value_minor: summary.total_stock_value_minor,
    low_stock_count: summary.low_stock_count,
    out_of_stock_count: summary.out_of_stock_count,
    total_skus: summary.total_skus,
  };
}

export function mapStockRowToInventoryStockViewModel(stock: StockWithProduct): InventoryStockViewModel {
  return {
    product_id: stock.product_id,
    product_name: stock.product_name,
    sku: stock.sku,
    category: stock.category,
    barcode: stock.barcode,
    price_minor: stock.price_minor,
    cost_minor: stock.cost_minor,
    quantity: stock.quantity,
    server_version: stock.server_version,
    updated_at: stock.updated_at,
    stock_status: getStockStatus(stock.quantity),
  };
}

const VALID_MOVEMENT_TYPES: readonly InventoryMovementType[] = ['ADJUSTMENT', 'STOCK_IN', 'STOCK_OUT'];

export function mapMovementToInventoryMovementViewModel(movement: StockMovement): InventoryMovementViewModel {
  return {
    id: movement.id,
    branch_id: movement.branch_id,
    product_id: movement.product_id,
    // The movements endpoint does not join products; product_name is only
    // available when a caller enriches it separately.
    product_name: null,
    quantity: movement.quantity,
    movement_type: (VALID_MOVEMENT_TYPES as readonly string[]).includes(movement.movement_type)
      ? (movement.movement_type as InventoryMovementType)
      : 'ADJUSTMENT',
    reference: movement.reference,
    actor: movement.actor,
    timestamp: movement.timestamp,
  };
}

// ── Client-side filtering (search / category / status) ───────────────────────

function matchesSearch(stock: InventoryStockViewModel, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (needle === '') return true;
  return (
    stock.product_name.toLowerCase().includes(needle) ||
    (stock.sku ?? '').toLowerCase().includes(needle) ||
    (stock.barcode ?? '').toLowerCase().includes(needle)
  );
}

function matchesCategory(stock: InventoryStockViewModel, category: string): boolean {
  return (stock.category ?? '').toLowerCase() === category.trim().toLowerCase();
}

function matchesStatus(stock: InventoryStockViewModel, status: InventoryStockStatusFilter): boolean {
  return stock.stock_status === status;
}

export function applyInventoryFilters(
  stocks: InventoryStockViewModel[],
  filters: Pick<InventoryFilterModel, 'search' | 'category' | 'status'>
): InventoryStockViewModel[] {
  return stocks.filter((stock) => {
    if (filters.search && !matchesSearch(stock, filters.search)) return false;
    if (filters.category && !matchesCategory(stock, filters.category)) return false;
    if (filters.status && !matchesStatus(stock, filters.status)) return false;
    return true;
  });
}

export function resolveInventoryOffset(filters: Pick<InventoryFilterModel, 'page' | 'limit' | 'offset'>): { limit: number; offset: number } {
  const limit = filters.limit ?? 50;
  if (filters.offset !== undefined) {
    return { limit, offset: filters.offset };
  }
  const page = Math.max(filters.page ?? 1, 1);
  return { limit, offset: (page - 1) * limit };
}

// ── Adjustment payload composition ────────────────────────────────────────────

function requireUuid(value: string | undefined, field: string): string {
  if (!value || value.trim() === '' || !UUID_PATTERN.test(value)) {
    throw new Error(`${field} must be a valid UUID provided by tenant/branch/product context`);
  }
  return value;
}

export function buildInventoryAdjustmentPayload(
  form: InventoryAdjustmentFormModel,
  businessId: string,
  branchId: string
): {
  business_id: string;
  branch_id: string;
  product_id: string;
  quantity_change: number;
  expected_server_version: number;
  reference: string | null;
  movement_type: InventoryMovementType;
} {
  const reference = form.reference?.trim();
  return {
    business_id: requireUuid(businessId, 'business_id'),
    branch_id: requireUuid(branchId, 'branch_id'),
    product_id: requireUuid(form.product_id, 'product_id'),
    quantity_change: form.quantity_change,
    expected_server_version: form.expected_server_version,
    reference: reference ? reference : null,
    movement_type: form.movement_type,
  };
}

// ── Error classification & state derivation ──────────────────────────────────

export function classifyInventoryMutationError(error: unknown, fallbackMessage = 'Adjustment failed'): InventoryMutationError {
  if (isConflictError(error)) {
    const axiosError = error as AxiosError<{ error?: { message?: string }; message?: string }>;
    return {
      type: 'conflict',
      message: axiosError.response?.data?.error?.message ?? axiosError.response?.data?.message ?? fallbackMessage,
    };
  }
  if (isClientValidationError(error)) {
    const axiosError = error as AxiosError<{ error?: { message?: string }; message?: string }>;
    return {
      type: 'validation',
      message: axiosError.response?.data?.error?.message ?? axiosError.response?.data?.message ?? fallbackMessage,
    };
  }

  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const bodyMessage =
      (error.response?.data as { error?: { message?: string }; message?: string } | undefined)?.error?.message ??
      (error.response?.data as { message?: string } | undefined)?.message ??
      error.message;
    if (status === 403) return { type: 'forbidden', message: bodyMessage };
    if (status === 404) return { type: 'not_found', message: bodyMessage };
    if (status === undefined) return { type: 'network', message: error.message };
    return { type: 'unknown', message: bodyMessage };
  }

  if (error instanceof Error) {
    return { type: 'network', message: error.message };
  }

  return { type: 'unknown', message: fallbackMessage };
}

export function deriveInventoryDataState(
  loading: boolean,
  error: unknown,
  itemCount: number
): InventoryDataState {
  if (error) return 'error';
  if (loading) return 'loading';
  if (itemCount === 0) return 'empty';
  return 'ready';
}
