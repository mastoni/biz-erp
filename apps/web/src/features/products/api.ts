import { api } from '@/lib/api';
import { Product, ProductCreatePayload, ProductSyncResponse, ProductUpdatePayload } from './types';
import { AxiosError } from 'axios';

export async function getProducts(businessId: string, afterVersion: number = 0, limit: number = 100): Promise<ProductSyncResponse> {
  const response = await api.get<ProductSyncResponse>('/v1/sync/products', {
    params: {
      business_id: businessId,
      after_version: afterVersion,
      limit,
    },
  });
  return response.data;
}

export async function createProduct(payload: ProductCreatePayload, idempotencyKey: string): Promise<Product> {
  const response = await api.post<Product>('/v1/sync/products', payload, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
  return response.data;
}

export async function updateProduct(id: string, payload: ProductUpdatePayload): Promise<Product> {
  const response = await api.put<Product>(`/v1/sync/products/${id}`, payload);
  return response.data;
}

export async function deactivateProduct(id: string, businessId: string, expectedServerVersion: number): Promise<Product> {
  return updateProduct(id, {
    business_id: businessId,
    expected_server_version: expectedServerVersion,
    is_active: false,
  });
}

// Helper to extract conflict error
export function getConflictDetails(error: unknown) {
  if (error instanceof AxiosError && error.response?.status === 409) {
    return error.response.data; // { code: 'VERSION_CONFLICT', message: '...', details: { current_server_version: N, current_product: {} } }
  }
  return null;
}
