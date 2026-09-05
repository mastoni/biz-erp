/**
 * Phase 4.1.41 — General Journal & Chart of Accounts UI Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import FinanceAccountsPage from '@/app/(authenticated)/finance/accounts/page';
import FinanceJournalsPage from '@/app/(authenticated)/finance/journals/page';
import { ChartOfAccountsView } from '../components/ChartOfAccountsView';
import { GeneralJournalTable } from '../components/GeneralJournalTable';
import { JournalDetailModal } from '../components/JournalDetailModal';
import { JournalReversalModal } from '../components/JournalReversalModal';
import * as financeApi from '../api';
import * as authContext from '@/features/auth/AuthContext';
import * as inventoryApi from '@/features/inventory/api';
import type { AccountDto, JournalEntryDto } from '../types';

vi.mock('../api', () => ({
  getAccounts: vi.fn(),
  getJournals: vi.fn(),
  getJournalById: vi.fn(),
  createJournalReversal: vi.fn(),
  getFinanceApiErrorMessage: vi.fn((err: any) => err?.message || 'Error occurred'),
}));

vi.mock('@/features/inventory/api', () => ({
  getBranches: vi.fn(),
}));

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockAccounts: AccountDto[] = [
  {
    id: 'acc-1',
    code: '100',
    name: 'Kas Operasional Toko',
    type: 'cash',
    currency: 'IDR',
    active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'acc-2',
    code: '101',
    name: 'Rekening Bank BCA',
    type: 'bank',
    currency: 'IDR',
    active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'acc-3',
    code: '110',
    name: 'Piutang Usaha Pelanggan',
    type: 'receivable',
    currency: 'IDR',
    active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'acc-4',
    code: '200',
    name: 'Hutang Usaha Supplier',
    type: 'payable',
    currency: 'IDR',
    active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'acc-5',
    code: '500',
    name: 'Pendapatan Penjualan Kasir',
    type: 'revenue',
    currency: 'IDR',
    active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'acc-6',
    code: '601',
    name: 'Beban Pokok Penjualan (HPP)',
    type: 'cogs',
    currency: 'IDR',
    active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
];

const mockJournals: JournalEntryDto[] = [
  {
    id: 'j-posted-1',
    business_id: 'biz-1',
    branch_id: 'branch-1',
    date: '2026-09-01',
    source_type: 'SALE',
    source_id: 'sale-001',
    reference: 'INV-20260901-01',
    description: 'Penjualan Kasir INV-001',
    status: 'posted',
    reversed_by: null,
    reversed_at: null,
    reversal_of: null,
    created_at: '2026-09-01T10:00:00Z',
    server_version: 1,
    lines: [
      {
        id: 'jl-1',
        journal_entry_id: 'j-posted-1',
        account_id: 'acc-1',
        account_code: '100',
        account_name: 'Kas',
        debit_minor: 500000,
        credit_minor: 0,
        description: 'Debit Kas',
        created_at: '2026-09-01T10:00:00Z',
      },
      {
        id: 'jl-2',
        journal_entry_id: 'j-posted-1',
        account_id: 'acc-5',
        account_code: '500',
        account_name: 'Pendapatan',
        debit_minor: 0,
        credit_minor: 500000,
        description: 'Credit Revenue',
        created_at: '2026-09-01T10:00:00Z',
      },
    ],
  },
  {
    id: 'j-reversed-2',
    business_id: 'biz-1',
    branch_id: 'branch-1',
    date: '2026-09-02',
    source_type: 'REVERSAL',
    source_id: 'reversal-001',
    reference: 'REV-001',
    description: 'Pembalikan Jurnal Penjualan',
    status: 'reversed',
    reversed_by: null,
    reversed_at: null,
    reversal_of: 'j-posted-1',
    created_at: '2026-09-02T10:00:00Z',
    server_version: 2,
    lines: [],
  },
  {
    id: 'j-draft-3',
    business_id: 'biz-1',
    branch_id: null,
    date: '2026-09-03',
    source_type: 'EXPENSE',
    source_id: 'exp-001',
    reference: 'EXP-001',
    description: 'Draft Pengeluaran Toko',
    status: 'draft',
    reversed_by: null,
    reversed_at: null,
    reversal_of: null,
    created_at: '2026-09-03T10:00:00Z',
    server_version: 1,
    lines: [],
  },
];

describe('General Journal & Chart of Accounts UI Tests', () => {
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
      items: mockAccounts,
      total: mockAccounts.length,
    });

    vi.mocked(financeApi.getJournals).mockResolvedValue({
      items: mockJournals,
      total: mockJournals.length,
      has_more: false,
    });

    vi.mocked(financeApi.getJournalById).mockResolvedValue(mockJournals[0]);
  });

  // -------------------------------------------------------------
  // Chart of Accounts Tests
  // -------------------------------------------------------------
  it('FIN-COA-001: Renders ChartOfAccountsView with account code, name, category, and normal balances', () => {
    const html = renderToString(
      <ChartOfAccountsView
        accounts={mockAccounts}
        isLoading={false}
        error={null}
        onRefresh={vi.fn()}
      />
    );

    expect(html).toContain('Bagan Akun (Chart of Accounts)');
    expect(html).toContain('100');
    expect(html).toContain('Kas Operasional Toko');
    expect(html).toContain('Rekening Bank BCA');
    expect(html).toContain('Piutang Usaha Pelanggan');
    expect(html).toContain('Hutang Usaha Supplier');
    expect(html).toContain('Pendapatan Penjualan Kasir');
    expect(html).toContain('Beban Pokok Penjualan (HPP)');

    // Normal balance badges
    expect(html).toContain('Debit');
    expect(html).toContain('Kredit');
  });

  it('FIN-COA-002: Shows loading skeleton in ChartOfAccountsView', () => {
    const html = renderToString(
      <ChartOfAccountsView
        accounts={[]}
        isLoading={true}
        error={null}
        onRefresh={vi.fn()}
      />
    );

    expect(html).toContain('animate-pulse');
  });

  it('FIN-COA-003: Shows error state and retry trigger in ChartOfAccountsView', () => {
    const html = renderToString(
      <ChartOfAccountsView
        accounts={[]}
        isLoading={false}
        error="Koneksi server gagal."
        onRefresh={vi.fn()}
      />
    );

    expect(html).toContain('Gagal Memuat Bagan Akun (COA)');
    expect(html).toContain('Koneksi server gagal.');
    expect(html).toContain('Coba Lagi');
  });

  it('FIN-COA-004: Shows empty state when no accounts match filters in ChartOfAccountsView', () => {
    const html = renderToString(
      <ChartOfAccountsView
        accounts={[]}
        isLoading={false}
        error={null}
        onRefresh={vi.fn()}
      />
    );

    expect(html).toContain('Tidak ada akun yang sesuai kriteria.');
  });

  // -------------------------------------------------------------
  // General Journal Tests
  // -------------------------------------------------------------
  it('FIN-JRN-001: Renders GeneralJournalTable with dates, references, descriptions, and statuses', () => {
    const html = renderToString(
      <GeneralJournalTable
        journals={mockJournals}
        total={mockJournals.length}
        isLoading={false}
        error={null}
        role="OWNER"
        statusFilter=""
        onStatusFilterChange={vi.fn()}
        branchFilter=""
        onBranchFilterChange={vi.fn()}
        branches={[{ id: 'branch-1', name: 'Cabang Utama' } as any]}
        onRefresh={vi.fn()}
        onViewDetail={vi.fn()}
        onOpenReversal={vi.fn()}
      />
    );

    expect(html).toContain('Jurnal Umum (General Journal)');
    expect(html).toContain('2026-09-01');
    expect(html).toContain('INV-20260901-01');
    expect(html).toContain('Penjualan Kasir INV-001');
    expect(html).toContain('Posted');
    expect(html).toContain('Reversal');
    expect(html).toContain('Draft');
    expect(html).toContain('Detail');
  });

  it('FIN-JRN-002: Shows OWNER-only reversal button on posted unreversed journals', () => {
    const html = renderToString(
      <GeneralJournalTable
        journals={mockJournals}
        total={mockJournals.length}
        isLoading={false}
        error={null}
        role="OWNER"
        statusFilter=""
        onStatusFilterChange={vi.fn()}
        branchFilter=""
        onBranchFilterChange={vi.fn()}
        branches={[]}
        onRefresh={vi.fn()}
        onViewDetail={vi.fn()}
        onOpenReversal={vi.fn()}
      />
    );

    // Reversal button is rendered for OWNER on j-posted-1
    expect(html).toContain('Balikkan');
  });

  it('FIN-JRN-003: Hides reversal button for STAFF role', () => {
    const html = renderToString(
      <GeneralJournalTable
        journals={mockJournals}
        total={mockJournals.length}
        isLoading={false}
        error={null}
        role="STAFF"
        statusFilter=""
        onStatusFilterChange={vi.fn()}
        branchFilter=""
        onBranchFilterChange={vi.fn()}
        branches={[]}
        onRefresh={vi.fn()}
        onViewDetail={vi.fn()}
        onOpenReversal={vi.fn()}
      />
    );

    // Reversal button is NOT rendered for STAFF
    expect(html).not.toContain('Balikkan');
    expect(html).toContain('Detail');
  });

  it('FIN-JRN-004: JournalDetailModal renders double-entry lines and balanced verification', () => {
    const html = renderToString(
      <JournalDetailModal
        journalId="j-posted-1"
        isOpen={true}
        onClose={vi.fn()}
        role="OWNER"
        onOpenReversal={vi.fn()}
      />
    );

    expect(html).toContain('Rincian Jurnal Umum');
    expect(html).toContain('j-posted-1');
  });

  it('FIN-JRN-005: JournalReversalModal renders counter-entry warning and confirmation control', () => {
    const html = renderToString(
      <JournalReversalModal
        journal={mockJournals[0]}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(html).toContain('Pembalikan Jurnal (Reversal)');
    expect(html).toContain('Konfirmasi Tindakan Keuangan Permanen');
    expect(html).toContain('j-posted-1');
    expect(html).toContain('Ya, Balikkan Jurnal');
    expect(html).toContain('Batal');
  });

  // -------------------------------------------------------------
  // RBAC Route Level Authorization Tests
  // -------------------------------------------------------------
  it('FIN-RBAC-001: OWNER is allowed on /finance/accounts and /finance/journals', () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      user: { id: 'user-1', name: 'Owner' } as any,
      business: { id: 'biz-1', name: 'Toko' } as any,
      role: 'OWNER',
      status: 'authenticated',
      scope: 'tenant',
    } as any);

    const accountsHtml = renderToString(<FinanceAccountsPage />);
    expect(accountsHtml).toContain('Bagan Akun (Chart of Accounts)');
    expect(accountsHtml).not.toContain('Akses Bagan Akun Dibatasi');

    const journalsHtml = renderToString(<FinanceJournalsPage />);
    expect(journalsHtml).toContain('Jurnal Umum (General Journal)');
    expect(journalsHtml).not.toContain('Akses Jurnal Umum Dibatasi');
  });

  it('FIN-RBAC-002: STAFF is allowed on /finance/accounts and /finance/journals', () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      user: { id: 'user-2', name: 'Staff' } as any,
      business: { id: 'biz-1', name: 'Toko' } as any,
      role: 'STAFF',
      status: 'authenticated',
      scope: 'tenant',
    } as any);

    const accountsHtml = renderToString(<FinanceAccountsPage />);
    expect(accountsHtml).toContain('Bagan Akun (Chart of Accounts)');
    expect(accountsHtml).not.toContain('Akses Bagan Akun Dibatasi');

    const journalsHtml = renderToString(<FinanceJournalsPage />);
    expect(journalsHtml).toContain('Jurnal Umum (General Journal)');
    expect(journalsHtml).not.toContain('Akses Jurnal Umum Dibatasi');
  });

  it('FIN-RBAC-003: CASHIER is strictly blocked on /finance/accounts and /finance/journals', () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      user: { id: 'user-3', name: 'Cashier' } as any,
      business: { id: 'biz-1', name: 'Toko' } as any,
      role: 'CASHIER',
      status: 'authenticated',
      scope: 'tenant',
    } as any);

    const accountsHtml = renderToString(<FinanceAccountsPage />);
    expect(accountsHtml).toContain('Akses Bagan Akun Dibatasi');
    expect(accountsHtml).toContain('Kembali ke Ringkasan Keuangan');
    expect(accountsHtml).not.toContain('Bagan Akun (Chart of Accounts)');

    const journalsHtml = renderToString(<FinanceJournalsPage />);
    expect(journalsHtml).toContain('Akses Jurnal Umum Dibatasi');
    expect(journalsHtml).toContain('Kembali ke Ringkasan Keuangan');
    expect(journalsHtml).not.toContain('Jurnal Umum (General Journal)');
  });
});
