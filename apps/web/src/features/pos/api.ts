/**
 * POS API client.
 *
 * Uses the shared api Axios instance exclusively.
 * All queries are strictly scoped to the authenticated tenant and active branch.
 */

import { api } from '@/lib/api';
import { Product } from '@/features/products/types';
import { StockListResponse } from '@/features/inventory/types';
import { CustomerListResponse } from '@/features/customers/types';
import { POSDailyCounter } from './types';

export interface SalesBatchSyncResponse {
  results: Array<{
    idempotency_key: string;
    status: 'created' | 'replayed' | 'receipt_conflict';
    sale_id: string;
    receipt_number: string;
    server_created_at: string;
  }>;
  created_count: number;
  replayed_count: number;
}

export async function getPOSProducts(businessId: string): Promise<Product[]> {
  const response = await api.get<{ items: Product[] }>('/v1/products', {
    params: { business_id: businessId, limit: 500 },
  });
  return response.data.items || [];
}

export async function getPOSStocks(businessId: string, branchId: string): Promise<StockListResponse> {
  const response = await api.get<StockListResponse>('/v1/inventory/stocks', {
    params: { business_id: businessId, branch_id: branchId },
  });
  return response.data;
}

export async function getPOSCustomers(businessId: string): Promise<CustomerListResponse> {
  const response = await api.get<CustomerListResponse>('/v1/customers', {
    params: { business_id: businessId, limit: 200 },
  });
  return response.data;
}

export async function getPOSDailyCounter(
  businessId: string,
  branchId: string,
  dateStr: string
): Promise<POSDailyCounter> {
  try {
    const response = await api.get<{
      sales_summary?: { total_sales: number; total_revenue_minor: number };
      total_sales?: number;
      total_revenue_minor?: number;
    }>('/v1/reports/sales-summary', {
      params: {
        from: dateStr,
        to: dateStr,
        branch_id: branchId,
      },
    });

    const summary = response.data.sales_summary || response.data;
    return {
      total_sales: Number(summary.total_sales || 0),
      total_revenue_minor: Number(summary.total_revenue_minor || 0),
    };
  } catch {
    return { total_sales: 0, total_revenue_minor: 0 };
  }
}

export async function submitPOSCheckout(
  payload: Record<string, unknown>
): Promise<SalesBatchSyncResponse> {
  const response = await api.post<SalesBatchSyncResponse>('/v1/sync/sales/batch', payload);
  return response.data;
}
