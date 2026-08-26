/**
 * Sales API client.
 *
 * Uses the shared `api` Axios instance exclusively.
 * JWT auth, token refresh, 401 handling, X-Request-Id forwarding
 * are all managed by the shared client — not duplicated here.
 *
 * Web Sales is READ-ONLY.
 */
import { api } from '@/lib/api';
import {
  SalesListResponse,
  SalesSummaryDto,
  DailySalesResponseDto,
  RecentSalesResponseDto,
} from './types';

export async function getSales(
  businessId: string,
  since: number = 0,
  limit: number = 500,
  branchId?: string
): Promise<SalesListResponse> {
  const params: Record<string, unknown> = {
    business_id: businessId,
    since,
    limit,
  };
  if (branchId) {
    params.branch_id = branchId;
  }
  const response = await api.get<SalesListResponse>('/v1/sync/sales', { params });
  return response.data;
}

export async function getSalesSummary(
  businessId: string,
  options?: { from?: string; to?: string; branchId?: string }
): Promise<{ sales_summary: SalesSummaryDto }> {
  const params: Record<string, unknown> = {};
  if (options?.from) params.from = options.from;
  if (options?.to) params.to = options.to;
  if (options?.branchId) params.branch_id = options.branchId;

  const response = await api.get<{ sales_summary: SalesSummaryDto }>('/v1/reports/sales-summary', {
    params,
  });
  return response.data;
}

export async function getDailySales(
  businessId: string,
  options: { from: string; to: string; branchId?: string }
): Promise<DailySalesResponseDto> {
  const params: Record<string, unknown> = {
    from: options.from,
    to: options.to,
  };
  if (options.branchId) params.branch_id = options.branchId;

  const response = await api.get<DailySalesResponseDto>('/v1/reports/sales-daily', {
    params,
  });
  return response.data;
}

export async function getRecentSales(
  businessId: string,
  options?: { branchId?: string; limit?: number }
): Promise<RecentSalesResponseDto> {
  const params: Record<string, unknown> = {};
  if (options?.branchId) params.branch_id = options.branchId;
  if (options?.limit) params.limit = options.limit;

  const response = await api.get<RecentSalesResponseDto>('/v1/reports/recent-sales', {
    params,
  });
  return response.data;
}
