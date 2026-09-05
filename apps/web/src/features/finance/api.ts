import { api } from '@/lib/api';
import type { AxiosError } from 'axios';
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
  AccountDto,
  AccountsListResponse,
  JournalEntryDto,
  JournalsListResponse,
  JournalQueryParams,
  JournalReversalResponse,
  ProfitLossReportDto,
  BalanceSheetReportDto,
  CashflowStatementReportDto,
  GeneralLedgerReportDto,
  TrialBalanceReportDto,
  FinanceReportFilterParams,
  CustomerPaymentItem,
  PurchaseDetailsDto,
  AgingBucket,
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
  const response = await api.get<{ entries: CashflowEntry[]; summary?: unknown } | CashflowEntry[]>('/v1/finance/cashflow', { params });
  if (Array.isArray(response.data)) {
    return response.data;
  }
  return response.data?.entries || [];
}

export async function getReceivables(branchId?: string): Promise<{ items: ReceivableItem[]; total: number }> {
  const params: Record<string, string | number> = { limit: 100 };
  if (branchId) params.branch_id = branchId;
  const response = await api.get<{ rows?: ReceivableItem[]; items?: ReceivableItem[]; total: number }>('/v1/receivables', { params });
  const items = response.data?.rows || response.data?.items || [];
  return {
    items,
    total: response.data?.total ?? items.length,
  };
}

export async function getPayables(businessId: string, branchId?: string): Promise<{ items: PayableItem[]; total: number }> {
  const params: Record<string, string | number> = {
    business_id: businessId,
    limit: 100,
  };
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
  const createRes = await api.post<{ id: string }>('/v1/incomes', input);
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
  const idempotencyKey = crypto.randomUUID();
  await api.post(`/v1/purchases/${purchaseId}/pay`, input, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
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

// ----------------------------------------------------
// Phase 4.1.41 — Canonical Finance & Accounting APIs
// ----------------------------------------------------

/**
 * Fetch Chart of Accounts for authenticated tenant
 * GET /v1/finance/accounts
 */
export async function getAccounts(params?: {
  limit?: number;
  offset?: number;
}): Promise<AccountsListResponse> {
  const response = await api.get<AccountsListResponse>('/v1/finance/accounts', { params });
  return response.data;
}

/**
 * Fetch Journal Entries with optional branch/status filters
 * GET /v1/finance/journals
 */
export async function getJournals(params?: JournalQueryParams): Promise<JournalsListResponse> {
  const response = await api.get<JournalsListResponse>('/v1/finance/journals', { params });
  return response.data;
}

/**
 * Fetch detailed Journal Entry with lines
 * GET /v1/finance/journals/:id
 */
export async function getJournalById(journalId: string): Promise<JournalEntryDto> {
  const response = await api.get<JournalEntryDto>(`/v1/finance/journals/${journalId}`);
  return response.data;
}

/**
 * Request reversal for a posted journal entry (OWNER only)
 * POST /v1/finance/reversals
 */
export async function createJournalReversal(journalId: string): Promise<JournalReversalResponse> {
  const response = await api.post<JournalReversalResponse>('/v1/finance/reversals', {
    journal_id: journalId,
  });
  return response.data;
}

/**
 * Fetch Profit & Loss statement
 * GET /v1/finance/reports/profit-loss
 */
export async function getProfitLossReport(
  params?: FinanceReportFilterParams
): Promise<ProfitLossReportDto> {
  const queryParams: Record<string, string> = {};
  if (params?.from) queryParams.from = params.from;
  if (params?.to) queryParams.to = params.to;
  if (params?.branch_id) queryParams.branch_id = params.branch_id;

  const response = await api.get<ProfitLossReportDto>('/v1/finance/reports/profit-loss', {
    params: queryParams,
  });
  return response.data;
}

/**
 * Fetch Balance Sheet statement
 * GET /v1/finance/reports/balance-sheet
 */
export async function getBalanceSheetReport(
  params?: FinanceReportFilterParams
): Promise<BalanceSheetReportDto> {
  const queryParams: Record<string, string> = {};
  if (params?.as_of) {
    queryParams.as_of = params.as_of;
  } else if (params?.to) {
    queryParams.as_of = params.to;
  }
  if (params?.branch_id) queryParams.branch_id = params.branch_id;

  const response = await api.get<BalanceSheetReportDto>('/v1/finance/reports/balance-sheet', {
    params: queryParams,
  });
  return response.data;
}

/**
 * Fetch Cash Flow statement
 * GET /v1/finance/reports/cashflow
 */
export async function getCashflowStatementReport(
  params?: FinanceReportFilterParams
): Promise<CashflowStatementReportDto> {
  const queryParams: Record<string, string> = {};
  if (params?.from) queryParams.from = params.from;
  if (params?.to) queryParams.to = params.to;
  if (params?.branch_id) queryParams.branch_id = params.branch_id;

  const response = await api.get<CashflowStatementReportDto>('/v1/finance/reports/cashflow', {
    params: queryParams,
  });
  return response.data;
}

/**
 * Fetch General Ledger report
 * GET /v1/finance/reports/general-ledger
 */
export async function getGeneralLedgerReport(params: {
  from: string;
  to: string;
  branch_id?: string;
  account_id?: string;
}): Promise<GeneralLedgerReportDto> {
  const queryParams: Record<string, string> = {
    from: params.from,
    to: params.to,
  };
  if (params.branch_id) queryParams.branch_id = params.branch_id;
  if (params.account_id) queryParams.account_id = params.account_id;

  const response = await api.get<GeneralLedgerReportDto>('/v1/finance/reports/general-ledger', {
    params: queryParams,
  });
  return response.data;
}

/**
 * Fetch Trial Balance / Account Balances report
 * GET /v1/finance/reports/account-balances
 */
export async function getTrialBalanceReport(
  params?: FinanceReportFilterParams
): Promise<TrialBalanceReportDto> {
  const queryParams: Record<string, string> = {};
  if (params?.from) queryParams.from = params.from;
  if (params?.to) queryParams.to = params.to;
  if (params?.branch_id) queryParams.branch_id = params.branch_id;

  const response = await api.get<TrialBalanceReportDto>('/v1/finance/reports/account-balances', {
    params: queryParams,
  });
  return response.data;
}

/**
 * Fetch customer payments for a receivable
 * GET /v1/receivables/:id/payments
 */
export async function getReceivablePayments(receivableId: string): Promise<CustomerPaymentItem[]> {
  const response = await api.get<CustomerPaymentItem[] | { items: CustomerPaymentItem[] }>(
    `/v1/receivables/${receivableId}/payments`
  );
  if (Array.isArray(response.data)) {
    return response.data;
  }
  return response.data?.items || [];
}

/**
 * Fetch detailed Purchase with payment history
 * GET /v1/purchases/:id
 */
export async function getPurchaseById(purchaseId: string): Promise<PurchaseDetailsDto> {
  const response = await api.get<PurchaseDetailsDto>(`/v1/purchases/${purchaseId}`);
  return response.data;
}

/**
 * Compute aging bucket based on due date or creation date relative to an as-of date (defaults to now).
 * Buckets:
 * - '0-30': Current / 0–30 Hari
 * - '31-60': 31–60 Hari
 * - '61-90': 61–90 Hari
 * - '>90': >90 Hari Terlambat
 */
export function getAgingBucket(dueDateOrDate?: string | null, asOf: Date = new Date()): AgingBucket {
  if (!dueDateOrDate) return '0-30';
  const targetDate = new Date(dueDateOrDate);
  if (isNaN(targetDate.getTime())) return '0-30';

  const diffMs = asOf.getTime() - targetDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 30) {
    return '0-30';
  }
  if (diffDays <= 60) {
    return '31-60';
  }
  if (diffDays <= 90) {
    return '61-90';
  }
  return '>90';
}

export function getAgingBucketLabel(bucket: AgingBucket): string {
  switch (bucket) {
    case '0-30':
      return 'Current / 0–30 Hari';
    case '31-60':
      return '31–60 Hari';
    case '61-90':
      return '61–90 Hari';
    case '>90':
      return '>90 Hari Terlambat';
    default:
      return bucket;
  }
}

/**
 * Translate backend finance errors into user-friendly Indonesian messages
 */
export function getFinanceApiErrorMessage(error: unknown): string {
  if (!error) return 'Terjadi kesalahan tidak terduga pada sistem keuangan.';

  const axiosError = error as AxiosError<{
    message?: string;
    error?: string | { code?: string; message?: string };
  }>;

  if (axiosError.response) {
    const status = axiosError.response.status;
    const errorData = axiosError.response.data;
    
    let serverMessage: string | undefined;
    let errorCode: string | undefined;

    if (errorData) {
      if (typeof errorData.error === 'string') {
        serverMessage = errorData.error;
      } else if (typeof errorData.error === 'object' && errorData.error !== null) {
        serverMessage = errorData.error.message;
        errorCode = errorData.error.code;
      }
      if (!serverMessage && typeof errorData.message === 'string') {
        serverMessage = errorData.message;
      }
    }

    const msgLower = (serverMessage || '').toLowerCase();
    const codeUpper = (errorCode || '').toUpperCase();

    switch (status) {
      case 400:
        if (
          codeUpper === 'ALREADY_REVERSED' ||
          (msgLower.includes('already') && msgLower.includes('reversed'))
        ) {
          return 'Jurnal ini sudah pernah dibalikkan sebelumnya.';
        }
        if (
          codeUpper === 'INVALID_STATE' ||
          msgLower.includes('only posted') ||
          (msgLower.includes('posted') && msgLower.includes('reversed'))
        ) {
          return 'Hanya jurnal berstatus posted yang dapat dibalikkan.';
        }
        if (msgLower.includes('balanced') || msgLower.includes('balance')) {
          return 'Jurnal tidak seimbang: total debit harus sama dengan total kredit.';
        }
        return serverMessage || 'Permintaan tidak valid atau parameter tanggal tidak sesuai.';
      case 403:
        return 'Akses ditolak: Hanya pemilik (OWNER) yang berhak melakukan pembalikan jurnal atau tindakan keuangan ini.';
      case 404:
        return 'Data akun atau jurnal tidak ditemukan dalam konteks bisnis Anda.';
      case 409:
        return 'Jurnal sudah dibalikkan atau terjadi konflik status transaksi.';
      case 500:
        return 'Terjadi kesalahan internal pada server keuangan. Silakan hubungi admin.';
      default:
        return serverMessage || `Terjadi kesalahan pada server (Kode: ${status}).`;
    }
  }

  if (axiosError.request) {
    return 'Koneksi jaringan terputus. Pastikan perangkat Anda terhubung ke server.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Terjadi kesalahan tidak terduga pada sistem keuangan.';
}
