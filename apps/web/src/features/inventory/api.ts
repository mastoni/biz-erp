import { api } from '@/lib/api';
import {
  Branch,
  BranchListResponse,
  Stock,
  StockListResponse,
  MovementListResponse,
  StockAdjustmentPayload,
  StockAdjustmentResponse,
} from './types';

// Pure error-classification helpers (no dependency on the api instance)
export { isConflictError, isClientValidationError, getApiErrorMessage } from './error-helpers';

export async function getBranches(businessId: string): Promise<Branch[]> {
  const response = await api.get<BranchListResponse>('/v1/branches', {
    params: { business_id: businessId },
  });
  return response.data.items;
}

export async function getStocks(businessId: string, branchId: string): Promise<Stock[]> {
  const response = await api.get<StockListResponse>('/v1/inventory/stocks', {
    params: { business_id: businessId, branch_id: branchId },
  });
  return response.data.items;
}

export async function getMovements(
  businessId: string,
  branchId: string,
  productId?: string
): Promise<MovementListResponse> {
  const response = await api.get<MovementListResponse>('/v1/inventory/movements', {
    params: {
      business_id: businessId,
      branch_id: branchId,
      ...(productId ? { product_id: productId } : {}),
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
