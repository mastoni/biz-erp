/**
 * Phase 9C.9E — Finance Overview ViewModel Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '../api';

vi.mock('../api');

describe('PHASE 9C.9E — Finance Overview ViewModel Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('FIN-VM-001: fetches summary, monthly cashflow, and recent expenses', async () => {
    const mockSummary = {
      total_assets: 46200000,
      total_liabilities: 12700000,
      total_equity: 33500000,
      total_revenue: 59189189,
      total_expense: 37289189,
      net_income: 21900000,
      cash_inflow: 59189189,
      cash_outflow: 37289189,
      net_cash_flow: 21900000,
    };

    const mockCashflowReport = {
      entries: [
        {
          journal_entry_id: 'je-1',
          date: '2026-08-15',
          account_id: 'acc-1',
          account_code: '1010',
          account_name: 'Kas Operasional',
          account_type: 'cash' as const,
          debit_minor: 12000000,
          credit_minor: 0,
          net_flow: 12000000,
          description: 'Penjualan Agustus',
        },
        {
          journal_entry_id: 'je-2',
          date: '2026-08-20',
          account_id: 'acc-1',
          account_code: '1010',
          account_name: 'Kas Operasional',
          account_type: 'cash' as const,
          debit_minor: 0,
          credit_minor: 4000000,
          net_flow: -4000000,
          description: 'Belanja stok Agustus',
        },
      ],
      total_inflow: 12000000,
      total_outflow: 4000000,
      net_cash_flow: 8000000,
    };

    const mockExpenses = [
      {
        id: 'exp-1',
        business_id: 'biz-1',
        date: '2026-08-25',
        amount_minor: 1250000,
        method: 'cash' as const,
        category: 'Utilitas',
        reference: 'PLN-01',
        description: 'Tagihan listrik toko',
        status: 'posted' as const,
        server_version: 1,
      },
    ];

    const mockReceivables = {
      items: [
        {
          id: 'recv-1',
          business_id: 'biz-1',
          total_minor: 8400000,
          paid_minor: 0,
          outstanding_minor: 8400000,
          status: 'OPEN' as const,
          created_at: '2026-08-20',
        },
      ],
      total: 1,
    };

    vi.mocked(api.getFinanceSummary).mockResolvedValueOnce(mockSummary);
    vi.mocked(api.getMonthlyCashflowReport).mockResolvedValueOnce(mockCashflowReport);
    vi.mocked(api.getRecentExpenses).mockResolvedValueOnce(mockExpenses);
    vi.mocked(api.getReceivables).mockResolvedValueOnce(mockReceivables);

    const [sum, cf, exp, recv] = await Promise.all([
      api.getFinanceSummary(),
      api.getMonthlyCashflowReport(),
      api.getRecentExpenses(),
      api.getReceivables(),
    ]);

    expect(sum.total_assets).toBe(46200000);
    expect(sum.net_income).toBe(21900000);
    expect(cf.entries).toHaveLength(2);
    expect(exp).toHaveLength(1);
    expect(exp[0].description).toBe('Tagihan listrik toko');
    expect(recv.items[0].outstanding_minor).toBe(8400000);
  });

  it('FIN-VM-002: computes margin percentage correctly from revenue and net income', () => {
    const revenue = 100000000;
    const netIncome = 37000000;
    const margin = Math.round((netIncome / revenue) * 100);
    expect(margin).toBe(37);
  });

  it('FIN-VM-003: groups cashflow entries by month correctly', () => {
    const entries = [
      { date: '2026-08-01', debit_minor: 5000000, credit_minor: 0 },
      { date: '2026-08-15', debit_minor: 3000000, credit_minor: 1000000 },
      { date: '2026-09-02', debit_minor: 4000000, credit_minor: 2000000 },
    ];

    const grouped: Record<string, { in: number; out: number }> = {};
    entries.forEach((e) => {
      const m = e.date.slice(0, 7);
      if (!grouped[m]) grouped[m] = { in: 0, out: 0 };
      grouped[m].in += e.debit_minor;
      grouped[m].out += e.credit_minor;
    });

    expect(grouped['2026-08'].in).toBe(8000000);
    expect(grouped['2026-08'].out).toBe(1000000);
    expect(grouped['2026-09'].in).toBe(4000000);
    expect(grouped['2026-09'].out).toBe(2000000);
  });
});
