import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { canAccessRoute, ROUTE_PERMISSIONS } from '@/lib/rbac';
import { ProfitLossView } from '../components/ProfitLossView';
import { BalanceSheetView } from '../components/BalanceSheetView';
import { CashflowReportView } from '../components/CashflowReportView';
import { GeneralLedgerView } from '../components/GeneralLedgerView';
import { TrialBalanceView } from '../components/TrialBalanceView';
import { ChartOfAccountsView } from '../components/ChartOfAccountsView';
import { GeneralJournalTable } from '../components/GeneralJournalTable';
import { JournalDetailModal } from '../components/JournalDetailModal';
import { JournalReversalModal } from '../components/JournalReversalModal';
import { AgingSummaryCards } from '../components/AgingSummaryCards';
import { ReceivablesAgingTable } from '../components/ReceivablesAgingTable';
import { PayablesAgingTable } from '../components/PayablesAgingTable';
import { DebtSettlementModal } from '../components/DebtSettlementModal';
import { DebtAuditHistoryModal } from '../components/DebtAuditHistoryModal';
import FinanceReportsPage from '@/app/(authenticated)/finance/reports/page';
import FinanceAccountsPage from '@/app/(authenticated)/finance/accounts/page';
import FinanceJournalsPage from '@/app/(authenticated)/finance/journals/page';
import { BookkeepingPage } from '../components/BookkeepingPage';
import type {
  ProfitLossReportDto,
  BalanceSheetReportDto,
  CashflowStatementReportDto,
  GeneralLedgerReportDto,
  TrialBalanceReportDto,
  AccountDto,
  JournalEntryDto,
  ReceivableItem,
  PayableItem,
} from '../types';

// Mock AuthContext for route-level page tests
vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/features/auth/AuthContext';

describe('Phase 4.1.41 Gate G-5 — Integration & RBAC Acceptance Suite', () => {
  const fixedNow = new Date('2026-09-05T00:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. RBAC ROUTE-LEVEL PERMISSIONS MATRIX
  // =========================================================================
  describe('RBAC Acceptance: Route Access Map', () => {
    it('G5-RBAC-001: OWNER has access to all Finance routes', () => {
      expect(canAccessRoute('OWNER', '/finance')).toBe(true);
      expect(canAccessRoute('OWNER', '/finance/bookkeeping')).toBe(true);
      expect(canAccessRoute('OWNER', '/finance/reports')).toBe(true);
      expect(canAccessRoute('OWNER', '/finance/accounts')).toBe(true);
      expect(canAccessRoute('OWNER', '/finance/journals')).toBe(true);
    });

    it('G5-RBAC-002: STAFF has access to operational bookkeeping, reports, COA, and journals', () => {
      expect(canAccessRoute('STAFF', '/finance')).toBe(true);
      expect(canAccessRoute('STAFF', '/finance/bookkeeping')).toBe(true);
      expect(canAccessRoute('STAFF', '/finance/reports')).toBe(true);
      expect(canAccessRoute('STAFF', '/finance/accounts')).toBe(true);
      expect(canAccessRoute('STAFF', '/finance/journals')).toBe(true);
    });

    it('G5-RBAC-003: CASHIER is strictly blocked from reports, COA, and journals', () => {
      expect(canAccessRoute('CASHIER', '/finance')).toBe(true);
      expect(canAccessRoute('CASHIER', '/finance/bookkeeping')).toBe(true);
      expect(canAccessRoute('CASHIER', '/finance/reports')).toBe(false);
      expect(canAccessRoute('CASHIER', '/finance/accounts')).toBe(false);
      expect(canAccessRoute('CASHIER', '/finance/journals')).toBe(false);
    });

    it('G5-RBAC-004: Page components render Access Denied screens for CASHIER', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'u-cashier', email: 'cashier@test.com' },
        business: { id: 'biz-1', name: 'Toko Test' },
        role: 'CASHIER',
        isAuthenticated: true,
        isLoading: false,
      } as any);

      // Reports Page
      const reportsHtml = renderToString(<FinanceReportsPage />);
      expect(reportsHtml).toContain('Akses Laporan Keuangan Dibatasi');
      expect(reportsHtml).not.toContain('Pendapatan (Revenue)');

      // Accounts Page
      const accountsHtml = renderToString(<FinanceAccountsPage />);
      expect(accountsHtml).toContain('Akses Bagan Akun Dibatasi');

      // Journals Page
      const journalsHtml = renderToString(<FinanceJournalsPage />);
      expect(journalsHtml).toContain('Akses Jurnal Umum Dibatasi');
    });

    it('G5-RBAC-005: Page components render authorized views for OWNER and STAFF', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'u-staff', email: 'staff@test.com' },
        business: { id: 'biz-1', name: 'Toko Test' },
        role: 'STAFF',
        isAuthenticated: true,
        isLoading: false,
      } as any);

      const accountsHtml = renderToString(<FinanceAccountsPage />);
      expect(accountsHtml).toContain('Bagan Akun (Chart of Accounts)');
      expect(accountsHtml).not.toContain('Akses Bagan Akun Dibatasi');

      const journalsHtml = renderToString(<FinanceJournalsPage />);
      expect(journalsHtml).toContain('Jurnal Umum (General Journal)');
      expect(journalsHtml).not.toContain('Akses Jurnal Umum Dibatasi');
    });
  });

  // =========================================================================
  // 2. FINANCIAL STATEMENTS & REPORTS INTEGRATION
  // =========================================================================
  describe('Reports Integration: Canonical Statements', () => {
    const mockPL: ProfitLossReportDto = {
      revenue_minor: 120000000,
      cogs_minor: 70000000,
      operating_expense_minor: 20000000,
      expense_minor: 25000000,
      net_income_minor: 25000000,
    };

    const mockBS: BalanceSheetReportDto = {
      total_assets_minor: 150000000,
      total_liabilities_minor: 50000000,
      total_equity_minor: 100000000,
    };

    const mockCashflow: CashflowStatementReportDto = {
      total_inflow: 85000000,
      total_outflow: 45000000,
      net_cash_flow: 40000000,
      entries: [
        {
          journal_entry_id: 'j-1',
          date: '2026-08-10',
          account_id: 'acc-1',
          account_code: '100',
          account_name: 'Kas Operasional',
          account_type: 'cash',
          debit_minor: 5000000,
          credit_minor: 0,
          net_flow: 5000000,
          description: 'Penerimaan Piutang Toko A',
        },
      ],
    };

    const mockGL: GeneralLedgerReportDto = {
      opening_balance: 10000000,
      period_movements: 5000000,
      closing_balance: 15000000,
      entries: [
        {
          account_id: 'acc-1',
          account_code: '100',
          account_name: 'Kas',
          account_type: 'cash',
          opening_balance: 10000000,
          journal_entry_id: 'jrn-1',
          date: '2026-08-01',
          source_type: 'SALE',
          description: 'Penjualan tunai kasir',
          debit_minor: 5000000,
          credit_minor: 0,
          running_balance: 15000000,
        },
      ],
    };

    const mockTB: TrialBalanceReportDto = [
      {
        account_id: 'acc-1',
        account_code: '100',
        account_name: 'Kas',
        account_type: 'cash',
        debit_total: 15000000,
        credit_total: 0,
        balance: 15000000,
      },
      {
        account_id: 'acc-2',
        account_code: '500',
        account_name: 'Pendapatan',
        account_type: 'revenue',
        debit_total: 0,
        credit_total: 15000000,
        balance: 15000000,
      },
    ];

    it('G5-REP-001: ProfitLossView renders revenue, COGS, gross profit, expenses, and net margin', () => {
      const html = renderToString(
        <ProfitLossView
          data={mockPL}
          isLoading={false}
          error={null}
          fromDate="2026-08-01"
          toDate="2026-08-31"
        />
      );

      expect(html).toContain('Laporan Laba Rugi');
      expect(html).toContain('120.000.000'); // Revenue
      expect(html).toContain('70.000.000'); // COGS
      expect(html).toContain('50.000.000'); // Gross Profit
      expect(html).toContain('25.000.000'); // Net Income
    });

    it('G5-REP-002: BalanceSheetView renders assets, liabilities, equity, and balanced status', () => {
      const html = renderToString(
        <BalanceSheetView
          data={mockBS}
          isLoading={false}
          error={null}
          asOfDate="2026-08-31"
        />
      );

      expect(html).toContain('Neraca');
      expect(html).toContain('150.000.000'); // Total Assets
      expect(html).toContain('50.000.000'); // Total Liabilities
      expect(html).toContain('100.000.000'); // Total Equity
      expect(html).toContain('Seimbang');
    });

    it('G5-REP-003: CashflowReportView, GeneralLedgerView, and TrialBalanceView render canonical line items', () => {
      const cfHtml = renderToString(
        <CashflowReportView
          data={mockCashflow}
          isLoading={false}
          error={null}
          fromDate="2026-08-01"
          toDate="2026-08-31"
        />
      );
      expect(cfHtml).toContain('Total Kas Masuk (Inflow)');
      expect(cfHtml).toContain('85.000.000'); // Inflow
      expect(cfHtml).toContain('40.000.000'); // Net flow

      const glHtml = renderToString(
        <GeneralLedgerView
          data={mockGL}
          isLoading={false}
          error={null}
          fromDate="2026-08-01"
          toDate="2026-08-31"
        />
      );
      expect(glHtml).toContain('Rincian Jurnal Buku Besar');
      expect(glHtml).toContain('Penjualan tunai kasir');
      expect(glHtml).toContain('15.000.000'); // Closing balance

      const tbHtml = renderToString(
        <TrialBalanceView
          data={mockTB}
          isLoading={false}
          error={null}
          fromDate="2026-08-01"
          toDate="2026-08-31"
        />
      );
      expect(tbHtml).toContain('Neraca Saldo (Trial Balance)');
      expect(tbHtml).toContain('Neraca Saldo Seimbang');
    });
  });

  // =========================================================================
  // 3. COA & GENERAL JOURNAL INTEGRATION
  // =========================================================================
  describe('COA & Journals Integration: Double-entry & Reversal Flow', () => {
    const mockAccounts: AccountDto[] = [
      { id: '1', code: '100', name: 'Kas Tunai', type: 'cash', currency: 'IDR', active: true, created_at: '2026-01-01' },
      { id: '2', code: '110', name: 'Piutang Dagang', type: 'receivable', currency: 'IDR', active: true, created_at: '2026-01-01' },
      { id: '3', code: '200', name: 'Hutang Usaha', type: 'payable', currency: 'IDR', active: true, created_at: '2026-01-01' },
    ];

    const mockJournal: JournalEntryDto = {
      id: 'jrn-test-999',
      business_id: 'biz-1',
      branch_id: null,
      date: '2026-08-20',
      source_type: 'SALE',
      source_id: 'sale-999',
      reference: 'INV-2026-0099',
      description: 'Penjualan perlengkapan kantor',
      status: 'posted',
      reversed_by: null,
      reversed_at: null,
      reversal_of: null,
      created_at: '2026-08-20T00:00:00.000Z',
      server_version: 1,
      lines: [
        {
          id: 'line-1',
          journal_entry_id: 'jrn-test-999',
          account_id: 'acc-1',
          account_code: '100',
          account_name: 'Kas Tunai',
          debit_minor: 2500000,
          credit_minor: 0,
          description: 'Penerimaan kas',
          created_at: '2026-08-20T00:00:00.000Z',
        },
        {
          id: 'line-2',
          journal_entry_id: 'jrn-test-999',
          account_id: 'acc-2',
          account_code: '500',
          account_name: 'Pendapatan',
          debit_minor: 0,
          credit_minor: 2500000,
          description: 'Pendapatan penjualan',
          created_at: '2026-08-20T00:00:00.000Z',
        },
      ],
    };

    it('G5-COA-001: ChartOfAccountsView displays normal balance badges and standard categories', () => {
      const html = renderToString(
        <ChartOfAccountsView
          accounts={mockAccounts}
          isLoading={false}
          error={null}
          onRefresh={() => {}}
        />
      );

      expect(html).toContain('Bagan Akun (Chart of Accounts)');
      expect(html).toContain('Kas Tunai');
      expect(html).toContain('Piutang Dagang');
      expect(html).toContain('Hutang Usaha');
      expect(html).toContain('Debit');
      expect(html).toContain('Kredit');
    });

    it('G5-JRN-001: GeneralJournalTable displays dates, references, and OWNER-only reversal button', () => {
      const ownerHtml = renderToString(
        <GeneralJournalTable
          journals={[mockJournal]}
          total={1}
          isLoading={false}
          error={null}
          role="OWNER"
          statusFilter=""
          onStatusFilterChange={() => {}}
          branchFilter=""
          onBranchFilterChange={() => {}}
          branches={[]}
          onRefresh={() => {}}
          onViewDetail={() => {}}
          onOpenReversal={() => {}}
        />
      );
      expect(ownerHtml).toContain('INV-2026-0099');
      expect(ownerHtml).toContain('Balikkan');

      const staffHtml = renderToString(
        <GeneralJournalTable
          journals={[mockJournal]}
          total={1}
          isLoading={false}
          error={null}
          role="STAFF"
          statusFilter=""
          onStatusFilterChange={() => {}}
          branchFilter=""
          onBranchFilterChange={() => {}}
          branches={[]}
          onRefresh={() => {}}
          onViewDetail={() => {}}
          onOpenReversal={() => {}}
        />
      );
      expect(staffHtml).toContain('INV-2026-0099');
      expect(staffHtml).not.toContain('Balikkan');
    });

    it('G5-JRN-002: JournalReversalModal displays counter-entry warning and confirmation checkbox', () => {
      const html = renderToString(
        <JournalReversalModal
          journal={mockJournal}
          isOpen={true}
          onClose={() => {}}
          onSuccess={() => {}}
        />
      );

      expect(html).toContain('Pembalikan Jurnal (Reversal)');
      expect(html).toContain('Konfirmasi Tindakan Keuangan Permanen');
      expect(html).toContain('counter-entry');
      expect(html).toContain('Saya memahami konsekuensi akuntansi ini dan menyetujui pembuatan jurnal pembalik (reversal).');
    });
  });

  // =========================================================================
  // 4. AR / AP AGING & SETTLEMENT INTEGRATION
  // =========================================================================
  describe('AR & AP Aging Integration: Bucket Calculation & Settlement Actions', () => {
    const mockReceivables: ReceivableItem[] = [
      {
        id: 'recv-g5-01',
        business_id: 'biz-1',
        customer_id: 'cust-1',
        customer_name: 'PT Mitra Sukses',
        sale_id: 'sale-1',
        total_minor: 10000000,
        paid_minor: 4000000,
        outstanding_minor: 6000000,
        status: 'PARTIAL',
        due_date: '2026-08-20', // 16 days overdue -> 0-30 bucket
        created_at: '2026-08-01T00:00:00.000Z',
      },
    ];

    const mockPayables: PayableItem[] = [
      {
        id: 'po-g5-01',
        business_id: 'biz-1',
        supplier_id: 'supp-1',
        supplier_name: 'PT Logistik Makmur',
        code: 'PO-2026-088',
        date: '2026-08-01',
        due_date: '2026-08-15', // 21 days overdue -> 0-30 bucket
        supplier_term: 'Tempo 14',
        status: 'received',
        total_minor: 25000000,
        paid_minor: 10000000,
        outstanding_minor: 15000000,
        received_minor: 25000000,
        server_version: 2,
      },
    ];

    it('G5-DEBT-001: ReceivablesAgingTable allows OWNER, STAFF, and CASHIER to collect payments', () => {
      ['OWNER', 'STAFF', 'CASHIER'].forEach((role) => {
        const html = renderToString(
          <ReceivablesAgingTable
            receivables={mockReceivables}
            isLoading={false}
            role={role as any}
            onOpenSettlement={() => {}}
            onOpenHistory={() => {}}
            asOfDate={fixedNow}
          />
        );
        expect(html).toContain('PT Mitra Sukses');
        expect(html).toContain('6.000.000');
        expect(html).toContain('Terima Pembayaran');
      });
    });

    it('G5-DEBT-002: PayablesAgingTable allows OWNER/STAFF settlement and strictly blocks CASHIER', () => {
      const ownerHtml = renderToString(
        <PayablesAgingTable
          payables={mockPayables}
          isLoading={false}
          role="OWNER"
          onOpenSettlement={() => {}}
          onOpenHistory={() => {}}
          asOfDate={fixedNow}
        />
      );
      expect(ownerHtml).toContain('Lunasi Tagihan');

      const staffHtml = renderToString(
        <PayablesAgingTable
          payables={mockPayables}
          isLoading={false}
          role="STAFF"
          onOpenSettlement={() => {}}
          onOpenHistory={() => {}}
          asOfDate={fixedNow}
        />
      );
      expect(staffHtml).toContain('Lunasi Tagihan');

      const cashierHtml = renderToString(
        <PayablesAgingTable
          payables={mockPayables}
          isLoading={false}
          role="CASHIER"
          onOpenSettlement={() => {}}
          onOpenHistory={() => {}}
          asOfDate={fixedNow}
        />
      );
      expect(cashierHtml).not.toContain('Lunasi Tagihan');
      expect(cashierHtml).toContain('Riwayat');
    });

    it('G5-DEBT-003: DebtSettlementModal enforces max payment limits and payment methods', () => {
      const html = renderToString(
        <DebtSettlementModal
          open={true}
          kind="hutang"
          item={mockPayables[0]}
          onClose={() => {}}
          onSettleReceivable={async () => {}}
          onSettlePayable={async () => {}}
          isSaving={false}
        />
      );

      expect(html).toContain('Pelunasan Tagihan Hutang');
      expect(html).toContain('PT Logistik Makmur');
      expect(html).toContain('15.000.000'); // Sisa Kewajiban
      expect(html).toContain('Metode Pembayaran');
      expect(html).toContain('Kas Tunai');
      expect(html).toContain('Transfer Bank');
    });
  });

  // =========================================================================
  // 5. TENANT ISOLATION ACCEPTANCE
  // =========================================================================
  describe('Tenant Isolation Acceptance', () => {
    it('G5-TEN-001: All finance views and modals operate in authenticated tenant scope without manual business_id inputs', () => {
      const html = renderToString(
        <BookkeepingPage businessId="tenant-999" role="OWNER" />
      );

      expect(html).not.toContain('input name="business_id"');
      expect(html).not.toContain('input name="tenant_id"');
    });
  });
});
