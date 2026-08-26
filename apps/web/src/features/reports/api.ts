/**
 * Phase 7C — Reports API Client
 */
import { api } from '@/lib/api';
import type {
  SalesSummaryReport,
  ProductSalesReport,
  CustomerSalesReport,
  DailySalesResponse,
  RecentSalesResponse,
} from './types';

export type {
  SalesSummaryReport,
  ProductSalesReport,
  CustomerSalesReport,
  DailySalesResponse,
  RecentSalesResponse,
};

export async function getSalesSummary(
  from: string,
  to: string,
  branchId?: string
): Promise<{ sales_summary: SalesSummaryReport }> {
  const params: Record<string, string> = { from, to };
  if (branchId) params.branch_id = branchId;
  const response = await api.get('/v1/reports/sales-summary', { params });
  return response.data;
}

export async function getProductSales(
  from: string,
  to: string,
  branchId?: string
): Promise<{ product_sales: ProductSalesReport[] }> {
  const params: Record<string, string> = { from, to };
  if (branchId) params.branch_id = branchId;
  const response = await api.get('/v1/reports/product-sales', { params });
  return response.data;
}

export async function getCustomerSales(
  from: string,
  to: string,
  branchId?: string
): Promise<{ customer_sales: CustomerSalesReport[] }> {
  const params: Record<string, string> = { from, to };
  if (branchId) params.branch_id = branchId;
  const response = await api.get('/v1/reports/customer-sales', { params });
  return response.data;
}

export async function getDailySales(
  from: string,
  to: string,
  branchId?: string
): Promise<DailySalesResponse> {
  const params: Record<string, string> = { from, to };
  if (branchId) params.branch_id = branchId;
  const response = await api.get('/v1/reports/sales-daily', { params });
  return response.data;
}

export async function getRecentSales(
  branchId?: string,
  limit: number = 10
): Promise<RecentSalesResponse> {
  const params: Record<string, string | number> = { limit };
  if (branchId) params.branch_id = branchId;
  const response = await api.get('/v1/reports/recent-sales', { params });
  return response.data;
}
