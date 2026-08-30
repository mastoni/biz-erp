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
  FinanceProfitLossDto,
  FinanceBalanceSheetDto,
  FinanceCashflowReportDto,
  FinanceGeneralLedgerDto,
  FinanceAccountBalanceDto,
} from './types';

export type {
  SalesSummaryReport,
  ProductSalesReport,
  CustomerSalesReport,
  DailySalesResponse,
  RecentSalesResponse,
  FinanceProfitLossDto,
  FinanceBalanceSheetDto,
  FinanceCashflowReportDto,
  FinanceGeneralLedgerDto,
  FinanceAccountBalanceDto,
};

function dateOnly(iso: string): string {
  return iso.split('T')[0];
}

function queryParams(from: string, to: string, branchId?: string): Record<string, string> {
  const params: Record<string, string> = {
    from: dateOnly(from),
    to: dateOnly(to),
  };
  if (branchId) params.branch_id = branchId;
  return params;
}

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

export async function getFinanceProfitLoss(
  from: string,
  to: string,
  branchId?: string
): Promise<FinanceProfitLossDto> {
  const response = await api.get('/v1/finance/reports/profit-loss', {
    params: queryParams(from, to, branchId),
  });
  return response.data;
}

export async function getFinanceBalanceSheet(
  asOf: string,
  branchId?: string
): Promise<FinanceBalanceSheetDto> {
  const params: Record<string, string> = { as_of: dateOnly(asOf) };
  if (branchId) params.branch_id = branchId;
  const response = await api.get('/v1/finance/reports/balance-sheet', { params });
  return response.data;
}

export async function getFinanceCashflow(
  from: string,
  to: string,
  branchId?: string
): Promise<FinanceCashflowReportDto> {
  const response = await api.get('/v1/finance/reports/cashflow', {
    params: queryParams(from, to, branchId),
  });
  return response.data;
}

export async function getFinanceGeneralLedger(
  from: string,
  to: string,
  branchId?: string,
  accountId?: string
): Promise<FinanceGeneralLedgerDto> {
  const params: Record<string, string> = {
    from: dateOnly(from),
    to: dateOnly(to),
  };
  if (branchId) params.branch_id = branchId;
  if (accountId) params.account_id = accountId;
  const response = await api.get('/v1/finance/reports/general-ledger', { params });
  return response.data;
}

export async function getFinanceAccountBalances(
  from: string,
  to: string,
  branchId?: string
): Promise<FinanceAccountBalanceDto[]> {
  const response = await api.get('/v1/finance/reports/account-balances', {
    params: queryParams(from, to, branchId),
  });
  return response.data;
}
