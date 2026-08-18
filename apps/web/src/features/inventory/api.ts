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
import { AxiosError } from 'axios';

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

export function isConflictError(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 409;
}

export function isNegativeStockError(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 400;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    return error.response?.data?.message || error.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
