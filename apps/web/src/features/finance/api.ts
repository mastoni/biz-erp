import { api } from '@/lib/api';
import type {
  FinanceSummaryKPI,
  CashflowEntry,
  ReceivableItem,
  PayableItem,
  RecentExpenseItem,
  CreateExpenseInput,
  CreateIncomeInput,
  SettleReceivableInput,
  SettlePayableInput,
} from './types';

export async function getFinanceSummary(): Promise<FinanceSummaryKPI> {
  const response = await api.get<FinanceSummaryKPI>('/v1/finance/summary');
  return response.data;
}

export async function getFinanceCashflow(params?: {
  from?: string;
  to?: string;
  branch_id?: string;
}): Promise<CashflowEntry[]> {
  const response = await api.get<CashflowEntry[]>('/v1/finance/cashflow', { params });
  return response.data;
}

export async function getReceivables(branchId?: string): Promise<{ items: ReceivableItem[]; total: number }> {
  const params: Record<string, string | number> = { limit: 100 };
  if (branchId) params.branch_id = branchId;
  const response = await api.get<{ items: ReceivableItem[]; total: number }>('/v1/receivables', { params });
  return response.data;
}

export async function getPayables(branchId?: string): Promise<{ items: PayableItem[]; total: number }> {
  const params: Record<string, string | number> = { limit: 100 };
  if (branchId) params.branch_id = branchId;
  const response = await api.get<{ items: PayableItem[]; total: number }>('/v1/purchases', { params });
  return response.data;
}

export async function createAndPostExpense(input: CreateExpenseInput): Promise<void> {
  const createRes = await api.post<{ id: string }>('/v1/expenses', input);
  const expenseId = createRes.data.id;
  await api.post('/v1/finance/postings/expense', { expense_id: expenseId });
}

export async function createAndPostIncome(input: CreateIncomeInput): Promise<void> {
  const createRes = await api.post<{ id: string }>('/v1/finance/incomes', input);
  const incomeId = createRes.data.id;
  await api.post('/v1/finance/postings/income', { income_id: incomeId });
}

export async function collectReceivablePayment(
  receivableId: string,
  input: SettleReceivableInput
): Promise<void> {
  await api.post(`/v1/receivables/${receivableId}/collections`, input);
}

export async function payPurchaseOrder(
  purchaseId: string,
  input: SettlePayableInput
): Promise<void> {
  await api.post(`/v1/purchases/${purchaseId}/pay`, input);
}

// ----------------------------------------------------
// Phase 9C.9E — Executive Overview APIs
// ----------------------------------------------------

export async function getRecentExpenses(
  branchId?: string,
  limit: number = 10
): Promise<RecentExpenseItem[]> {
  const params: Record<string, string | number> = { limit };
  if (branchId) params.branch_id = branchId;
  const response = await api.get<{ items: RecentExpenseItem[] } | RecentExpenseItem[]>('/v1/expenses', { params });
  if (Array.isArray(response.data)) {
    return response.data;
  }
  return (response.data as { items: RecentExpenseItem[] }).items || [];
}

export async function getMonthlyCashflowReport(params?: {
  from?: string;
  to?: string;
  branch_id?: string;
}): Promise<{
  entries: CashflowEntry[];
  total_inflow: number;
  total_outflow: number;
  net_cash_flow: number;
}> {
  const response = await api.get<{
    entries: CashflowEntry[];
    total_inflow: number;
    total_outflow: number;
    net_cash_flow: number;
  }>('/v1/finance/reports/cashflow', { params });
  return response.data;
}
