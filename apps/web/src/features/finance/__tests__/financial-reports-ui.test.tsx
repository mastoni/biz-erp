/**
 * Phase 4.1.41 — Financial Statements & Reports UI Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import FinanceReportsPage from '@/app/(authenticated)/finance/reports/page';
import { FinanceReportHeader } from '../components/FinanceReportHeader';
import { ProfitLossView } from '../components/ProfitLossView';
import { BalanceSheetView } from '../components/BalanceSheetView';
import { CashflowReportView } from '../components/CashflowReportView';
import { GeneralLedgerView } from '../components/GeneralLedgerView';
import { TrialBalanceView } from '../components/TrialBalanceView';
import { FinanceOverviewPage } from '../components/FinanceOverviewPage';
import * as financeApi from '../api';
import * as authContext from '@/features/auth/AuthContext';
import * as inventoryApi from '@/features/inventory/api';

vi.mock('../api', () => ({
  getProfitLossReport: vi.fn(),
  getBalanceSheetReport: vi.fn(),
  getCashflowStatementReport: vi.fn(),
  getGeneralLedgerReport: vi.fn(),
  getTrialBalanceReport: vi.fn(),
  getAccounts: vi.fn(),
  getFinanceApiErrorMessage: vi.fn((err: any) => err?.message || 'Error occurred'),
}));

vi.mock('@/features/inventory/api', () => ({
  getBranches: vi.fn(),
}));

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockProfitLoss = {
  revenue_minor: 50000000,
  cogs_minor: 30000000,
  operating_expense_minor: 5000000,
  expense_minor: 35000000,
  net_income_minor: 15000000,
};

const mockBalanceSheet = {
  total_assets_minor: 100000000,
  total_liabilities_minor: 40000000,
  total_equity_minor: 60000000,
};

const mockCashflow = {
  entries: [
    {
      journal_entry_id: 'j-1',
      date: '2026-08-15',
      account_id: 'acc-1',
      account_code: '100',
      account_name: 'Kas Operasional',
      account_type: 'cash' as const,
      debit_minor: 10000000,
      credit_minor: 0,
      net_flow: 10000000,
      description: 'Penerimaan Tunai',
    },
  ],
  total_inflow: 10000000,
  total_outflow: 0,
  net_cash_flow: 10000000,
};

const mockGeneralLedger = {
  opening_balance: 5000000,
  period_movements: 2000000,
  closing_balance: 7000000,
  entries: [
    {
      account_id: 'acc-1',
      account_code: '100',
      account_name: 'Kas Operasional',
      account_type: 'cash' as const,
      opening_balance: 5000000,
      journal_entry_id: 'je-1',
      date: '2026-08-10',
      source_type: 'SALE' as const,
      description: 'Penjualan Kasir',
      debit_minor: 2000000,
      credit_minor: 0,
      running_balance: 7000000,
    },
  ],
};

const mockTrialBalance = [
  {
    account_id: 'acc-1',
    account_code: '100',
    account_name: 'Kas',
    account_type: 'cash' as const,
    debit_total: 10000000,
    credit_total: 0,
    balance: 10000000,
  },
  {
    account_id: 'acc-2',
    account_code: '500',
    account_name: 'Pendapatan',
    account_type: 'revenue' as const,
    debit_total: 0,
    credit_total: 10000000,
    balance: -10000000,
  },
];

describe('Financial Statements & Reports UI Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(authContext.useAuth).mockReturnValue({
      user: { id: 'user-1', email: 'owner@biz.com', name: 'Owner' } as any,
      business: { id: 'biz-1', name: 'Toko Sukses Makmur' } as any,
      role: 'OWNER',
      status: 'authenticated',
      scope: 'tenant',
    } as any);

    vi.mocked(inventoryApi.getBranches).mockResolvedValue([
      { id: 'branch-1', name: 'Cabang Utama' } as any,
    ]);

    vi.mocked(financeApi.getAccounts).mockResolvedValue({
      items: [
        { id: 'acc-1', code: '100', name: 'Kas', type: 'cash', currency: 'IDR', active: true, created_at: '2026-01-01' },
      ],
      total: 1,
    });

    vi.mocked(financeApi.getProfitLossReport).mockResolvedValue(mockProfitLoss);
    vi.mocked(financeApi.getBalanceSheetReport).mockResolvedValue(mockBalanceSheet);
    vi.mocked(financeApi.getCashflowStatementReport).mockResolvedValue(mockCashflow);
    vi.mocked(financeApi.getGeneralLedgerReport).mockResolvedValue(mockGeneralLedger);
    vi.mocked(financeApi.getTrialBalanceReport).mockResolvedValue(mockTrialBalance);
  });

  it('FIN-REP-001: Renders page header and all 5 report navigation tabs for OWNER', () => {
    const html = renderToString(<FinanceReportsPage />);

    expect(html).toContain('Laporan Keuangan');
    expect(html).toContain('Laba Rugi');
    expect(html).toContain('Neraca');
    expect(html).toContain('Arus Kas');
    expect(html).toContain('Buku Besar');
    expect(html).toContain('Neraca Saldo');
    expect(html).toContain('Ekspor CSV');
    expect(html).toContain('Cetak');
  });

  it('FIN-REP-002: Renders Profit & Loss view with correct amounts and margins', () => {
    const html = renderToString(
      <ProfitLossView
        data={mockProfitLoss}
        isLoading={false}
        error={null}
        fromDate="2026-08-01"
        toDate="2026-08-31"
      />
    );

    expect(html).toContain('Total Pendapatan');
    expect(html).toContain('Beban Pokok (HPP)');
    expect(html).toContain('Beban Operasional');
    expect(html).toContain('Laba Bersih');
    expect(html).toContain('30%'); // Margin 15m/50m = 30%
    expect(html).toContain('Laporan Laba Rugi Komprehensif');
  });

  it('FIN-REP-003: BalanceSheetView displays balanced badge when Assets = Liabilities + Equity', () => {
    const html = renderToString(
      <BalanceSheetView
        data={mockBalanceSheet}
        isLoading={false}
        error={null}
        asOfDate="2026-08-31"
      />
    );

    expect(html).toContain('Neraca Keuangan Seimbang');
    expect(html).toContain('Status: Balanced');
    expect(html).toContain('Total Aset (Aktiva)');
    expect(html).toContain('Total Kewajiban (Hutang)');
    expect(html).toContain('Total Ekuitas (Modal)');
    expect(html).toContain('Aktiva / Aset');
    expect(html).toContain('Pasiva (Kewajiban &amp; Ekuitas)');
  });

  it('FIN-REP-004: BalanceSheetView displays warning badge when unbalanced', () => {
    const unbalancedBS = {
      total_assets_minor: 100000000,
      total_liabilities_minor: 40000000,
      total_equity_minor: 50000000, // Sum = 90m != 100m
    };

    const html = renderToString(
      <BalanceSheetView
        data={unbalancedBS}
        isLoading={false}
        error={null}
        asOfDate="2026-08-31"
      />
    );

    expect(html).toContain('Peringatan: Neraca Tidak Seimbang');
    expect(html).toContain('Status: Unbalanced');
  });

  it('FIN-REP-005: CashflowReportView displays total inflow, outflow, net flow and detailed entries', () => {
    const html = renderToString(
      <CashflowReportView
        data={mockCashflow}
        isLoading={false}
        error={null}
        fromDate="2026-08-01"
        toDate="2026-08-31"
      />
    );

    expect(html).toContain('Total Kas Masuk (Inflow)');
    expect(html).toContain('Total Kas Keluar (Outflow)');
    expect(html).toContain('Arus Kas Bersih (Net Flow)');
    expect(html).toContain('Kas Operasional');
    expect(html).toContain('Penerimaan Tunai');
  });

  it('FIN-REP-006: GeneralLedgerView displays opening, movement, closing balances and transaction lines', () => {
    const html = renderToString(
      <GeneralLedgerView
        data={mockGeneralLedger}
        isLoading={false}
        error={null}
        fromDate="2026-08-01"
        toDate="2026-08-31"
      />
    );

    expect(html).toContain('Saldo Awal (Opening)');
    expect(html).toContain('Mutasi Periode');
    expect(html).toContain('Saldo Akhir (Closing)');
    expect(html).toContain('Penjualan Kasir');
  });

  it('FIN-REP-007: TrialBalanceView displays account rows and debit/credit equality check', () => {
    const html = renderToString(
      <TrialBalanceView
        data={mockTrialBalance}
        isLoading={false}
        error={null}
        fromDate="2026-08-01"
        toDate="2026-08-31"
      />
    );

    expect(html).toContain('Neraca Saldo Seimbang (Balanced)');
    expect(html).toContain('Status: Balanced');
    expect(html).toContain('Kas');
    expect(html).toContain('Pendapatan');
    expect(html).toContain('Total Keseimbangan');
  });

  it('FIN-REP-008: FinanceReportHeader renders period presets, date inputs, and branch selector', () => {
    const html = renderToString(
      <FinanceReportHeader
        activeTab="labarugi"
        onTabChange={vi.fn()}
        preset="bulan-ini"
        onPresetChange={vi.fn()}
        fromDate="2026-08-01"
        toDate="2026-08-31"
        asOfDate="2026-08-31"
        onFromDateChange={vi.fn()}
        onToDateChange={vi.fn()}
        onAsOfDateChange={vi.fn()}
        branches={[{ id: 'branch-1', name: 'Cabang Utama' } as any]}
        selectedBranchId="branch-1"
        onBranchChange={vi.fn()}
        onExportCsv={vi.fn()}
        onPrint={vi.fn()}
        onRefresh={vi.fn()}
        isLoading={false}
      />
    );

    expect(html).toContain('Bulan Ini');
    expect(html).toContain('Bulan Lalu');
    expect(html).toContain('Tahun Berjalan (YTD)');
    expect(html).toContain('Kustom');
    expect(html).toContain('Cabang Utama');
  });

  it('FIN-REP-009: Shows loading skeleton when data is fetching', () => {
    const html = renderToString(
      <ProfitLossView
        data={null}
        isLoading={true}
        error={null}
        fromDate="2026-08-01"
        toDate="2026-08-31"
      />
    );

    expect(html).toContain('animate-pulse');
  });

  it('FIN-REP-010: Shows error banner when API throws error', () => {
    const html = renderToString(
      <ProfitLossView
        data={null}
        isLoading={false}
        error="Koneksi jaringan terputus."
        fromDate="2026-08-01"
        toDate="2026-08-31"
      />
    );

    expect(html).toContain('Gagal Memuat Laporan Laba Rugi');
    expect(html).toContain('Koneksi jaringan terputus.');
  });

  it('FIN-REP-011: Shows empty state when no data exists', () => {
    const html = renderToString(
      <ProfitLossView
        data={null}
        isLoading={false}
        error={null}
        fromDate="2026-08-01"
        toDate="2026-08-31"
      />
    );

    expect(html).toContain('Tidak ada data untuk periode ini.');
  });

  it('FIN-REP-012: STAFF role has full access to financial reports', () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      user: { id: 'user-2', email: 'staff@biz.com', name: 'Staff' } as any,
      business: { id: 'biz-1', name: 'Toko Sukses Makmur' } as any,
      role: 'STAFF',
      status: 'authenticated',
      scope: 'tenant',
    } as any);

    const html = renderToString(<FinanceReportsPage />);

    expect(html).toContain('Laporan Keuangan');
    expect(html).toContain('Laba Rugi');
    expect(html).not.toContain('Akses Laporan Keuangan Dibatasi');
  });

  it('FIN-REP-013: CASHIER role is strictly blocked with Access Denied view and return link', () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      user: { id: 'user-3', email: 'cashier@biz.com', name: 'Cashier' } as any,
      business: { id: 'biz-1', name: 'Toko Sukses Makmur' } as any,
      role: 'CASHIER',
      status: 'authenticated',
      scope: 'tenant',
    } as any);

    const html = renderToString(<FinanceReportsPage />);

    expect(html).toContain('Akses Laporan Keuangan Dibatasi');
    expect(html).toContain('hanya dapat diakses oleh Pemilik Usaha');
    expect(html).toContain('Kembali ke Ringkasan Keuangan');
    expect(html).not.toContain('Ekspor CSV');
  });

  it('FIN-REP-014: FinanceOverviewPage header includes link to /finance/reports for OWNER and STAFF', () => {
    const ownerHtml = renderToString(
      <FinanceOverviewPage
        businessId="biz-1"
        role="OWNER"
      />
    );
    expect(ownerHtml).toContain('Laporan Keuangan');
    expect(ownerHtml).toContain('/finance/reports');

    const staffHtml = renderToString(
      <FinanceOverviewPage
        businessId="biz-1"
        role="STAFF"
      />
    );
    expect(staffHtml).toContain('Laporan Keuangan');
    expect(staffHtml).toContain('/finance/reports');

    const cashierHtml = renderToString(
      <FinanceOverviewPage
        businessId="biz-1"
        role="CASHIER"
      />
    );
    expect(cashierHtml).not.toContain('/finance/reports');
  });

  it('FIN-REP-015: GeneralLedgerView displays account selector when accounts are provided', () => {
    const accounts = [
      { id: 'acc-1', code: '100', name: 'Kas Operasional', type: 'cash' as const, currency: 'IDR', active: true, created_at: '2026-01-01' },
      { id: 'acc-2', code: '500', name: 'Pendapatan', type: 'revenue' as const, currency: 'IDR', active: true, created_at: '2026-01-01' },
    ];

    const html = renderToString(
      <GeneralLedgerView
        data={mockGeneralLedger}
        isLoading={false}
        error={null}
        fromDate="2026-08-01"
        toDate="2026-08-31"
        accounts={accounts}
        selectedAccountId="acc-1"
        onAccountSelect={vi.fn()}
      />
    );

    expect(html).toContain('Semua Akun Perkiraan');
    expect(html).toContain('100 — Kas Operasional');
    expect(html).toContain('500 — Pendapatan');
  });

  it('FIN-REP-016: TrialBalanceView displays difference calculation when unbalanced', () => {
    const unbalancedTB = [
      {
        account_id: 'acc-1',
        account_code: '100',
        account_name: 'Kas',
        account_type: 'cash' as const,
        debit_total: 10000000,
        credit_total: 0,
        balance: 10000000,
      },
      {
        account_id: 'acc-2',
        account_code: '500',
        account_name: 'Pendapatan',
        account_type: 'revenue' as const,
        debit_total: 0,
        credit_total: 8000000, // Sum = 8m != 10m
        balance: -8000000,
      },
    ];

    const html = renderToString(
      <TrialBalanceView
        data={unbalancedTB}
        isLoading={false}
        error={null}
        fromDate="2026-08-01"
        toDate="2026-08-31"
      />
    );

    expect(html).toContain('Peringatan: Neraca Saldo Tidak Seimbang');
    expect(html).toContain('Status: Unbalanced');
  });
});
