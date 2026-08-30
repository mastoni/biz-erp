/**
 * Phase 9C.9D & 9C.9E — Finance & Bookkeeping Domain Types
 */

export type BookkeepingTab = 'jurnal' | 'piutang' | 'hutang';

export type PaymentMethod = 'cash' | 'bank_transfer' | 'debit' | 'credit';

export interface FinanceSummaryKPI {
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  total_revenue: number;
  total_expense: number;
  net_income: number;
  cash_inflow: number;
  cash_outflow: number;
  net_cash_flow: number;
}

export interface CashflowEntry {
  journal_line_id?: string;
  journal_entry_id: string;
  date: string;
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: 'cash' | 'bank' | 'mobile';
  debit_minor: number;
  credit_minor: number;
  net_flow: number;
  description: string | null;
}

export interface ReceivableItem {
  id: string;
  business_id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  sale_id?: string | null;
  total_minor: number;
  paid_minor: number;
  outstanding_minor: number;
  status: 'OPEN' | 'PARTIAL' | 'PAID' | 'REVERSED';
  due_date?: string | null;
  created_at: string;
}

export interface PayableItem {
  id: string;
  business_id: string;
  supplier_id?: string | null;
  supplier_name?: string | null;
  code: string;
  date: string;
  due_date: string;
  supplier_term: string;
  status: string;
  total_minor: number;
  paid_minor: number;
  outstanding_minor: number;
  received_minor: number;
  server_version: number;
}

export interface CreateExpenseInput {
  business_id?: string;
  branch_id?: string | null;
  date: string;
  amount_minor: number;
  method: PaymentMethod;
  category?: string | null;
  reference?: string | null;
  description: string;
}

export interface CreateIncomeInput {
  business_id?: string;
  branch_id?: string | null;
  date: string;
  amount_minor: number;
  method: PaymentMethod;
  category?: string | null;
  reference?: string | null;
  description: string;
}

export interface SettleReceivableInput {
  amount_minor: number;
  method: PaymentMethod;
  reference?: string | null;
  date?: string;
}

export interface SettlePayableInput {
  business_id: string;
  expected_server_version: number;
  amount_minor: number;
  method: PaymentMethod;
  reference?: string | null;
}

// ----------------------------------------------------
// Phase 9C.9E — Executive Financial Overview Types
// ----------------------------------------------------

export interface MonthlyCashflowPoint {
  month: string;
  label: string;
  inflow_minor: number;
  outflow_minor: number;
  net_flow_minor: number;
}

export interface RecentExpenseItem {
  id: string;
  business_id: string;
  branch_id?: string | null;
  date: string;
  amount_minor: number;
  method: PaymentMethod;
  category?: string | null;
  reference?: string | null;
  description: string;
  status: 'draft' | 'posted' | 'reversed';
  server_version: number;
}

export interface FinanceOverviewKPIs {
  kas_bank_minor: number;
  piutang_minor: number;
  hutang_minor: number;
  laba_bersih_minor: number;
  margin_percent: number;
}

export interface FinanceOverviewViewModel {
  kpis: FinanceOverviewKPIs;
  monthly_cashflow: MonthlyCashflowPoint[];
  recent_expenses: RecentExpenseItem[];
}
