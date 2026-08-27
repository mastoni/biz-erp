import { AxiosError } from 'axios';
import { api } from '@/lib/api';
import type { Supplier, SupplierListResponse, SupplierSummaryKPI, SupplierCreateInput, SupplierUpdateInput } from './types';
import type { SupplierErrorType } from './types';

export async function getSuppliers(
  businessId: string,
  limit: number = 20,
  offset: number = 0
): Promise<SupplierListResponse> {
  const response = await api.get<SupplierListResponse>('/v1/suppliers', {
    params: { business_id: businessId, limit, offset },
  });
  return response.data;
}

export async function getSupplier(businessId: string, id: string): Promise<Supplier> {
  const response = await api.get<Supplier>(`/v1/suppliers/${id}`, {
    params: { business_id: businessId },
  });
  return response.data;
}

export async function getSuppliersSummary(businessId: string): Promise<SupplierSummaryKPI> {
  const response = await api.get<SupplierSummaryKPI>('/v1/suppliers/summary', {
    params: { business_id: businessId },
  });
  return response.data;
}

export async function createSupplier(input: SupplierCreateInput): Promise<Supplier> {
  const idempotencyKey = crypto.randomUUID();
  const response = await api.post<Supplier>('/v1/suppliers', input, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
  return response.data;
}

export async function updateSupplier(id: string, input: SupplierUpdateInput): Promise<Supplier> {
  const response = await api.put<Supplier>(`/v1/suppliers/${id}`, input);
  return response.data;
}

export async function deleteSupplier(id: string): Promise<void> {
  await api.delete(`/v1/suppliers/${id}`);
}

export function classifySupplierError(err: unknown): SupplierErrorType {
  if (err instanceof AxiosError) {
    const errorCode = err.response?.data?.error?.code;
    const status = err.response?.status;

    if (errorCode === 'SUPPLIER_CODE_CONFLICT') return 'code_conflict';
    if (errorCode === 'SUPPLIER_VERSION_CONFLICT') return 'version_conflict';
    if (errorCode === 'IDEMPOTENCY_KEY_REUSE') return 'code_conflict';
    if (status === 400) return 'validation_error';
    if (status === 403) return 'forbidden';
    if (status === 404) return 'not_found';
    if (status === 409) return 'version_conflict';
  }

  if (err instanceof Error) {
    if (err.message.includes('network') || err.message.includes('ECONN')) {
      return 'network_error';
    }
  }

  return 'unknown';
}
