import { api } from '@/lib/api';
import {
  Branch,
  BranchListResponse,
  StockWithProduct,
  StockListResponse,
  MovementListResponse,
  StockAdjustmentPayload,
  StockAdjustmentResponse,
  StockSummary,
  InventoryFilterModel,
  InventoryListViewModel,
  InventoryMovementFilterModel,
  InventoryMovementListViewModel,
} from './types';
import {
  applyInventoryFilters,
  mapMovementToInventoryMovementViewModel,
  mapStockRowToInventoryStockViewModel,
  mapSummaryToInventorySummaryViewModel,
  resolveInventoryOffset,
} from './inventory-helpers';

// Pure error-classification helpers (no dependency on the api instance)
export { isConflictError, isClientValidationError, getApiErrorMessage } from './error-helpers';

export async function getBranches(businessId: string): Promise<Branch[]> {
  const response = await api.get<BranchListResponse>('/v1/branches', {
    params: { business_id: businessId },
  });
  return response.data.items;
}

export async function createBranch(businessId: string, name: string): Promise<Branch> {
  const idempotencyKey = crypto.randomUUID();
  const response = await api.post<Branch>(
    '/v1/branches',
    {
      id: crypto.randomUUID(),
      business_id: businessId,
      name,
    },
    {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    }
  );
  return response.data;
}

export async function getStocks(businessId: string, branchId: string, productIds?: string[]): Promise<StockWithProduct[]> {
  const response = await api.get<StockListResponse>('/v1/inventory/stocks', {
    params: {
      business_id: businessId,
      branch_id: branchId,
      ...(productIds && productIds.length > 0 ? { product_ids: productIds.join(',') } : {}),
    },
  });
  return response.data.items;
}

export async function getStock(businessId: string, branchId: string, productId: string): Promise<{ product_id: string; branch_id: string; quantity: number; server_version: number }> {
  const response = await api.get('/v1/inventory/stock', {
    params: {
      business_id: businessId,
      branch_id: branchId,
      product_id: productId,
    },
  });
  return response.data;
}

export async function getStockSummary(businessId: string, branchId: string): Promise<StockSummary> {
  const response = await api.get<StockSummary>('/v1/inventory/summary', {
    params: { business_id: businessId, branch_id: branchId },
  });
  return response.data;
}

export async function getMovements(
  businessId: string,
  branchId: string,
  productId?: string,
  limit?: number,
  offset?: number
): Promise<MovementListResponse> {
  const response = await api.get<MovementListResponse>('/v1/inventory/movements', {
    params: {
      business_id: businessId,
      branch_id: branchId,
      ...(productId ? { product_id: productId } : {}),
      ...(limit ? { limit } : {}),
      ...(offset ? { offset } : {}),
    },
  });
  return response.data;
}

export async function postAdjustment(
  payload: StockAdjustmentPayload,
  idempotencyKey: string
): Promise<StockAdjustmentResponse> {
  const response = await api.post<StockAdjustmentResponse>('/v1/inventory/adjustment', payload, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
  return response.data;
}

// ─── Phase 4C — Inventory ViewModel data layer ───────────────────────────────
// business_id always comes from the authenticated tenant context and
// branch_id always comes from the active BranchContext. These functions never
// generate or substitute IDs.

export async function fetchInventorySummary(branchId: string, tenantId: string): Promise<StockSummary> {
  const response = await api.get<StockSummary>('/v1/inventory/summary', {
    params: { business_id: tenantId, branch_id: branchId },
  });
  return mapSummaryToInventorySummaryViewModel(response.data);
}

export async function fetchInventoryStocks(
  branchId: string,
  tenantId: string,
  filters: InventoryFilterModel = {}
): Promise<InventoryListViewModel> {
  const { limit, offset } = resolveInventoryOffset(filters);

  const response = await api.get<StockListResponse>('/v1/inventory/stocks', {
    params: {
      business_id: tenantId,
      branch_id: branchId,
      // product_id is server-supported via product_ids; search/category/status
      // are applied client-side below.
      ...(filters.product_id ? { product_ids: filters.product_id } : {}),
    },
  });

  const mapped = response.data.items.map(mapStockRowToInventoryStockViewModel);
  const filtered = applyInventoryFilters(mapped, filters);
  const page = filtered.slice(offset, offset + limit);

  return {
    items: page,
    total: filtered.length,
    limit,
    offset,
    has_more: offset + page.length < filtered.length,
  };
}

export async function fetchInventoryStock(
  productId: string,
  branchId: string,
  tenantId: string
): Promise<{ product_id: string; branch_id: string; quantity: number; server_version: number }> {
  const response = await api.get<{
    product_id: string;
    branch_id: string;
    quantity: number;
    server_version: number;
  }>('/v1/inventory/stock', {
    params: { business_id: tenantId, branch_id: branchId, product_id: productId },
  });
  return response.data;
}

export async function fetchInventoryMovements(
  branchId: string,
  tenantId: string,
  filters: InventoryMovementFilterModel = {}
): Promise<InventoryMovementListViewModel> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const response = await api.get<MovementListResponse>('/v1/inventory/movements', {
    params: {
      business_id: tenantId,
      branch_id: branchId,
      ...(filters.product_id ? { product_id: filters.product_id } : {}),
      limit,
      offset,
    },
  });

  return {
    items: response.data.items.map(mapMovementToInventoryMovementViewModel),
    total: response.data.total,
    limit: response.data.limit,
    offset: response.data.offset,
    has_more: response.data.has_more,
  };
}

export async function adjustInventory(
  payload: StockAdjustmentPayload,
  idempotencyKey?: string
): Promise<StockAdjustmentResponse> {
  return postAdjustment(payload, idempotencyKey ?? crypto.randomUUID());
}
