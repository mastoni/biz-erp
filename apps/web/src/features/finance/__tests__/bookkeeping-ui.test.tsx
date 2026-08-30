/**
 * Phase 9C.9D — Bookkeeping UI Component Acceptance Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { BookkeepingPage } from '../components/BookkeepingPage';
import { CashTransactionModal } from '../components/CashTransactionModal';
import { DebtSettlementModal } from '../components/DebtSettlementModal';
import * as viewmodel from '../use-bookkeeping-viewmodel';

vi.mock('../use-bookkeeping-viewmodel');

describe('PHASE 9C.9D — Bookkeeping UI Acceptance Tests', () => {
  const sampleSummary = {
    total_assets: 46200000,
    total_liabilities: 12700000,
    total_equity: 33500000,
    total_revenue: 28000000,
    total_expense: 6100000,
    net_income: 21900000,
    cash_inflow: 28000000,
    cash_outflow: 6100000,
    net_cash_flow: 21900000,
  };

  const sampleCashflow = [
    {
      journal_entry_id: 'je-1',
      date: '2026-08-30',
      account_id: 'acc-1',
      account_code: '1010',
      account_name: 'Kas Operasional',
      account_type: 'cash' as const,
      debit_minor: 6840000,
      credit_minor: 0,
      net_flow: 6840000,
      description: 'Penjualan tunai harian',
    },
    {
      journal_entry_id: 'je-2',
      date: '2026-08-30',
      account_id: 'acc-1',
      account_code: '1010',
      account_name: 'Kas Operasional',
      account_type: 'cash' as const,
      debit_minor: 0,
      credit_minor: 1240000,
      net_flow: -1240000,
      description: 'Listrik & air toko',
    },
  ];

  const sampleReceivables = [
    {
      id: 'recv-001',
      business_id: 'biz-1',
      customer_id: 'cust-1',
      customer_name: 'Warung Bu Siti',
      total_minor: 2500000,
      paid_minor: 500000,
      outstanding_minor: 2000000,
      status: 'PARTIAL' as const,
      due_date: '2026-09-05',
      created_at: '2026-08-25',
    },
  ];

  const samplePayables = [
    {
      id: 'po-2201',
      business_id: 'biz-1',
      code: 'PO-2201',
      supplier_name: 'UD Makmur Sembako',
      date: '2026-08-28',
      due_date: '2026-09-11',
      supplier_term: 'Tempo 14',
      status: 'received',
      total_minor: 6120000,
      paid_minor: 0,
      outstanding_minor: 6120000,
      received_minor: 6120000,
      server_version: 2,
    },
  ];

  const defaultViewModelState = {
    tab: 'jurnal' as const,
    setTab: vi.fn(),
    search: '',
    setSearch: vi.fn(),
    summary: sampleSummary,
    cashflow: sampleCashflow,
    receivables: sampleReceivables,
    payables: samplePayables,
    filteredCashflow: sampleCashflow,
    filteredReceivables: sampleReceivables,
    filteredPayables: samplePayables,
    isLoading: false,
    isSaving: false,
    error: null,
    cashModalOpen: false,
    setCashModalOpen: vi.fn(),
    settlementModalData: { open: false, kind: 'piutang' as const, item: null },
    setSettlementModalData: vi.fn(),
    loadData: vi.fn(),
    recordCashTransaction: vi.fn(),
    settleReceivable: vi.fn(),
    settlePayable: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(viewmodel.useBookkeepingViewModel).mockReturnValue(defaultViewModelState);
  });

  it('BOOK-UI-001: renders 4 KPI cards correctly with formatted currency', () => {
    const html = renderToString(
      <BookkeepingPage businessId="biz-1" role="OWNER" />
    );

    expect(html).toContain('Saldo Kas Berjalan');
    expect(html).toContain('Total Kas Masuk');
    expect(html).toContain('Total Kas Keluar');
    expect(html).toContain('Arus Kas Bersih');
    expect(html).toContain('Pembukuan Keuangan');
  });

  it('BOOK-UI-002: renders Jurnal Kas table with correct lines and totals', () => {
    const html = renderToString(
      <BookkeepingPage businessId="biz-1" role="OWNER" />
    );

    expect(html).toContain('Penjualan tunai harian');
    expect(html).toContain('Listrik &amp; air toko');
    expect(html).toContain('1010');
    expect(html).toContain('Kas Operasional');
    expect(html).toContain('Total Periode');
  });

  it('BOOK-UI-003: renders Piutang tab with customer and action buttons', () => {
    vi.mocked(viewmodel.useBookkeepingViewModel).mockReturnValue({
      ...defaultViewModelState,
      tab: 'piutang',
    });

    const html = renderToString(
      <BookkeepingPage businessId="biz-1" role="OWNER" />
    );

    expect(html).toContain('Warung Bu Siti');
    expect(html).toContain('Terima Pembayaran');
    expect(html).toContain('Total Piutang Berjalan');
  });

  it('BOOK-UI-004: renders Hutang tab with supplier and settlement action buttons', () => {
    vi.mocked(viewmodel.useBookkeepingViewModel).mockReturnValue({
      ...defaultViewModelState,
      tab: 'hutang',
    });

    const html = renderToString(
      <BookkeepingPage businessId="biz-1" role="OWNER" />
    );

    expect(html).toContain('UD Makmur Sembako');
    expect(html).toContain('PO-2201');
    expect(html).toContain('Tempo 14');
    expect(html).toContain('Lunasi Tagihan');
    expect(html).toContain('Total Hutang Berjalan');
  });

  it('BOOK-UI-005: hides mutation action buttons for CASHIER role (read-only)', () => {
    vi.mocked(viewmodel.useBookkeepingViewModel).mockReturnValue({
      ...defaultViewModelState,
      tab: 'hutang',
    });

    const html = renderToString(
      <BookkeepingPage businessId="biz-1" role="CASHIER" />
    );

    expect(html).not.toContain('Catat Transaksi Kas');
    expect(html).not.toContain('Lunasi Tagihan');
  });

  it('BOOK-UI-006: renders loading and error states properly', () => {
    vi.mocked(viewmodel.useBookkeepingViewModel).mockReturnValue({
      ...defaultViewModelState,
      isLoading: true,
      error: 'Koneksi API terputus',
    });

    const html = renderToString(
      <BookkeepingPage businessId="biz-1" role="OWNER" />
    );

    expect(html).toContain('Koneksi API terputus');
    expect(html).toContain('Memuat data jurnal kas...');
  });

  it('BOOK-UI-007: renders CashTransactionModal structure correctly', () => {
    const html = renderToString(
      <CashTransactionModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        isSaving={false}
      />
    );

    expect(html).toContain('Catat Transaksi Kas');
    expect(html).toContain('Pemasukan');
    expect(html).toContain('Pengeluaran');
    expect(html).toContain('Nominal (Rp)');
    expect(html).toContain('Simpan Catatan');
  });

  it('BOOK-UI-008: renders DebtSettlementModal structure for receivable', () => {
    const html = renderToString(
      <DebtSettlementModal
        open={true}
        kind="piutang"
        item={sampleReceivables[0]}
        onClose={vi.fn()}
        onSettleReceivable={vi.fn()}
        onSettlePayable={vi.fn()}
        isSaving={false}
      />
    );

    expect(html).toContain('Terima Pembayaran Piutang');
    expect(html).toContain('Warung Bu Siti');
    expect(html).toContain('Nominal Dibayar (Rp)');
    expect(html).toContain('Terima Pembayaran');
  });

  it('BOOK-UI-009: renders DebtSettlementModal structure for payable', () => {
    const html = renderToString(
      <DebtSettlementModal
        open={true}
        kind="hutang"
        item={samplePayables[0]}
        onClose={vi.fn()}
        onSettleReceivable={vi.fn()}
        onSettlePayable={vi.fn()}
        isSaving={false}
      />
    );

    expect(html).toContain('Pelunasan Tagihan Hutang');
    expect(html).toContain('UD Makmur Sembako');
    expect(html).toContain('Nominal Dibayar (Rp)');
    expect(html).toContain('Lunasi Tagihan');
  });

  it('BOOK-UI-010: renders educational bookkeeping tips footer box', () => {
    const html = renderToString(
      <BookkeepingPage businessId="biz-1" role="OWNER" />
    );

    expect(html).toContain('Tips pembukuan UMKM:');
    expect(html).toContain('Pembelian tunai otomatis memotong kas');
  });
});
