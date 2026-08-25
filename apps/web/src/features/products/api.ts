import { api } from '@/lib/api';
import { AxiosError } from 'axios';
import {
  Product,
  ProductCreatePayload,
  ProductSyncResponse,
  ProductUpdatePayload,
  ProductListParams,
  ProductListViewModel,
  ProductViewModel,
  ProductStockViewModel,
} from './types';
import { mapProductToViewModel, mapProductListToViewModel, mapStockToViewModel } from './viewmodel';

// ─── Phase 3B.1 sync endpoints (preserved) ──────────────────────────────────

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

export function getConflictDetails(error: unknown) {
  if (error instanceof AxiosError && error.response?.status === 409) {
    return error.response.data;
  }
  return null;
}

// ─── Phase 3B.2 operational read endpoints ────────────────────────────────────

export async function fetchProducts(params: ProductListParams): Promise<ProductListViewModel> {
  const { business_id, search, category, barcode, limit, offset } = params;

  const queryParams: Record<string, unknown> = {
    business_id,
  };

  if (search) queryParams.search = search;
  if (category) queryParams.category = category;
  if (barcode) queryParams.barcode = barcode;
  if (limit !== undefined) queryParams.limit = limit;
  if (offset !== undefined) queryParams.offset = offset;

  const response = await api.get<{
    items: Product[];
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  }>('/v1/products', { params: queryParams });

  return mapProductListToViewModel(
    response.data.items,
    response.data.total,
    response.data.limit,
    response.data.offset,
    response.data.has_more,
  );
}

export async function fetchProduct(id: string, tenantId: string): Promise<ProductViewModel> {
  const response = await api.get<Product>(`/v1/products/${id}`, {
    params: { business_id: tenantId },
  });

  return mapProductToViewModel(response.data);
}

export async function fetchProductStock(productId: string, branchId: string, tenantId: string): Promise<ProductStockViewModel> {
  const response = await api.get<{
    product_id: string;
    branch_id: string;
    quantity: number;
  }>('/v1/inventory/stock', {
    params: {
      business_id: tenantId,
      branch_id: branchId,
      product_id: productId,
    },
  });

  return mapStockToViewModel(response.data);
}
