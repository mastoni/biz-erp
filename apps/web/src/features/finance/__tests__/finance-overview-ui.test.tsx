/**
 * Phase 9C.9E — Finance Overview UI Acceptance Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { FinanceOverviewPage } from '../components/FinanceOverviewPage';
import { FinanceKPICards } from '../components/FinanceKPICards';
import { FinanceCashflowChart } from '../components/FinanceCashflowChart';
import { RecentExpensesWidget } from '../components/RecentExpensesWidget';
import * as viewmodel from '../use-finance-overview-viewmodel';

vi.mock('../use-finance-overview-viewmodel');

describe('PHASE 9C.9E — Finance Overview UI Acceptance Tests', () => {
  const sampleKPIs = {
    kas_bank_minor: 46200000,
    piutang_minor: 8400000,
    hutang_minor: 12700000,
    laba_bersih_minor: 21900000,
    margin_percent: 37,
  };

  const sampleMonthlyCashflow = [
    {
      month: '2026-08',
      label: 'Agu',
      inflow_minor: 150000000,
      outflow_minor: 95000000,
      net_flow_minor: 55000000,
    },
    {
      month: '2026-09',
      label: 'Sep',
      inflow_minor: 180000000,
      outflow_minor: 110000000,
      net_flow_minor: 70000000,
    },
  ];

  const sampleExpenses = [
    {
      id: 'exp-1',
      business_id: 'biz-1',
      date: '2026-08-28',
      amount_minor: 1250000,
      method: 'cash' as const,
      category: 'Utilitas',
      reference: 'PLN-8812',
      description: 'Listrik & air toko',
      status: 'posted' as const,
      server_version: 1,
    },
    {
      id: 'exp-2',
      business_id: 'biz-1',
      date: '2026-08-29',
      amount_minor: 2500000,
      method: 'bank_transfer' as const,
      category: 'Sewa',
      reference: 'TRF-SEWA',
      description: 'Sewa gudang mingguan',
      status: 'posted' as const,
      server_version: 1,
    },
  ];

  const defaultState = {
    kpis: sampleKPIs,
    summary: null,
    monthlyCashflow: sampleMonthlyCashflow,
    recentExpenses: sampleExpenses,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    exportRekeningKoran: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(viewmodel.useFinanceOverviewViewModel).mockReturnValue(defaultState);
  });

  it('FIN-UI-001: renders 4 FinCards with correct labels and formatted values', () => {
    const html = renderToString(
      <FinanceKPICards kpis={sampleKPIs} isLoading={false} />
    );

    expect(html).toContain('Kas &amp; Bank');
    expect(html).toContain('Piutang');
    expect(html).toContain('Hutang');
    expect(html).toContain('Laba Bersih Bulan Ini');
    expect(html).toContain('Margin 37% dari omzet');
  });

  it('FIN-UI-002: renders FinanceCashflowChart with legend and pair bars', () => {
    const html = renderToString(
      <FinanceCashflowChart data={sampleMonthlyCashflow} isLoading={false} />
    );

    expect(html).toContain('Arus Kas Multi-Bulan');
    expect(html).toContain('Pemasukan');
    expect(html).toContain('Pengeluaran');
    expect(html).toContain('Agu');
    expect(html).toContain('Sep');
  });

  it('FIN-UI-003: renders RecentExpensesWidget with expense items and status', () => {
    const html = renderToString(
      <RecentExpensesWidget expenses={sampleExpenses} isLoading={false} />
    );

    expect(html).toContain('Pengeluaran Terkini');
    expect(html).toContain('Listrik &amp; air toko');
    expect(html).toContain('Sewa gudang mingguan');
    expect(html).toContain('Utilitas');
    expect(html).toContain('Lunas');
  });

  it('FIN-UI-004: renders FinanceOverviewPage header and Rekening Koran action button', () => {
    const html = renderToString(
      <FinanceOverviewPage businessId="biz-1" role="OWNER" />
    );

    expect(html).toContain('Keuangan');
    expect(html).toContain('Arus kas, pengeluaran, dan kewajiban toko bulan ini.');
    expect(html).toContain('Rekening Koran');
    expect(html).toContain('Jadwal &amp; Komitmen Rutin');
  });

  it('FIN-UI-005: handles loading state properly', () => {
    vi.mocked(viewmodel.useFinanceOverviewViewModel).mockReturnValue({
      ...defaultState,
      isLoading: true,
    });

    const html = renderToString(
      <FinanceOverviewPage businessId="biz-1" role="OWNER" />
    );

    expect(html).toContain('Memuat data grafik arus kas...');
    expect(html).toContain('Memuat data pengeluaran...');
  });

  it('FIN-UI-006: handles error state properly', () => {
    vi.mocked(viewmodel.useFinanceOverviewViewModel).mockReturnValue({
      ...defaultState,
      error: 'Gagal menghubungi server finance',
    });

    const html = renderToString(
      <FinanceOverviewPage businessId="biz-1" role="OWNER" />
    );

    expect(html).toContain('Gagal menghubungi server finance');
  });
});
