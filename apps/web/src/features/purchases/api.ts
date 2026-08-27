import { AxiosError } from 'axios';
import { api } from '@/lib/api';
import type {
  Purchase,
  PurchaseListResponse,
  PurchaseSummaryKPI,
  PurchaseCreateInput,
  PurchaseUpdateDraftInput,
  PurchaseSendInput,
  PurchaseReceiveInput,
  PurchasePayInput,
  PurchaseCancelInput,
  PurchaseErrorKind,
} from './types';

export async function getPurchases(
  businessId: string,
  branchId?: string,
  limit: number = 20,
  offset: number = 0,
  status?: string,
  supplierId?: string
): Promise<PurchaseListResponse> {
  const params: Record<string, any> = {
    business_id: businessId,
    limit,
    offset,
  };
  if (branchId) params.branch_id = branchId;
  if (status && status !== 'Semua') params.status = status;
  if (supplierId) params.supplier_id = supplierId;

  const response = await api.get<PurchaseListResponse>('/v1/purchases', { params });
  return response.data;
}

export async function getPurchase(businessId: string, id: string): Promise<Purchase> {
  const response = await api.get<Purchase>(`/v1/purchases/${id}`, {
    params: { business_id: businessId },
  });
  return response.data;
}

export async function getPurchasesSummary(
  businessId: string,
  branchId?: string
): Promise<PurchaseSummaryKPI> {
  const params: Record<string, any> = { business_id: businessId };
  if (branchId) params.branch_id = branchId;

  const response = await api.get<PurchaseSummaryKPI>('/v1/purchases/summary', { params });
  return response.data;
}

export async function createPurchase(input: PurchaseCreateInput): Promise<Purchase> {
  const idempotencyKey = crypto.randomUUID();
  const response = await api.post<Purchase>('/v1/purchases', input, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
  return response.data;
}

export async function updateDraftPurchase(
  id: string,
  input: PurchaseUpdateDraftInput
): Promise<Purchase> {
  const response = await api.put<Purchase>(`/v1/purchases/${id}`, input);
  return response.data;
}

export async function sendPurchase(
  id: string,
  input: PurchaseSendInput
): Promise<Purchase> {
  const idempotencyKey = crypto.randomUUID();
  const response = await api.post<Purchase>(`/v1/purchases/${id}/send`, input, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
  return response.data;
}

export async function receivePurchase(
  id: string,
  input: PurchaseReceiveInput
): Promise<Purchase> {
  const idempotencyKey = crypto.randomUUID();
  const response = await api.post<Purchase>(`/v1/purchases/${id}/receive`, input, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
  return response.data;
}

export async function payPurchase(
  id: string,
  input: PurchasePayInput
): Promise<Purchase> {
  const idempotencyKey = crypto.randomUUID();
  const response = await api.post<Purchase>(`/v1/purchases/${id}/pay`, input, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
  return response.data;
}

export async function cancelPurchase(
  id: string,
  input: PurchaseCancelInput
): Promise<Purchase> {
  const idempotencyKey = crypto.randomUUID();
  const response = await api.post<Purchase>(`/v1/purchases/${id}/cancel`, input, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
  return response.data;
}

export async function deleteDraftPurchase(
  businessId: string,
  id: string
): Promise<void> {
  await api.delete(`/v1/purchases/${id}`, {
    params: { business_id: businessId },
  });
}

export function classifyPurchaseError(err: unknown): PurchaseErrorKind {
  if (err instanceof AxiosError) {
    const errorCode = err.response?.data?.error?.code;
    const status = err.response?.status;

    if (errorCode === 'PURCHASE_CODE_CONFLICT') return 'code_conflict';
    if (errorCode === 'PURCHASE_VERSION_CONFLICT') return 'version_conflict';
    if (errorCode === 'STOCK_VERSION_CONFLICT') return 'stock_version_conflict';
    if (errorCode === 'IDEMPOTENCY_KEY_REUSE') return 'code_conflict';
    if (errorCode === 'VALIDATION_ERROR' || status === 400) return 'validation_error';
    if (errorCode === 'BUSINESS_ACCESS_DENIED' || status === 403) return 'forbidden';
    if (errorCode === 'NOT_FOUND' || status === 404) return 'not_found';
    if (status === 409) return 'conflict';
  }

  if (err instanceof Error) {
    if (
      err.message.toLowerCase().includes('network') ||
      err.message.includes('ECONN')
    ) {
      return 'network_error';
    }
  }

  return 'unknown';
}
