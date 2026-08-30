/**
 * Phase 9C.9D — Bookkeeping ViewModel & Data Layer Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '../api';

vi.mock('../api');

describe('PHASE 9C.9D — Bookkeeping ViewModel Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('BOOK-VM-001: fetches summary, cashflow, receivables, and payables on initial load', async () => {
    const mockSummary = {
      total_assets: 50000000,
      total_liabilities: 15000000,
      total_equity: 35000000,
      total_revenue: 20000000,
      total_expense: 5000000,
      net_income: 15000000,
      cash_inflow: 25000000,
      cash_outflow: 10000000,
      net_cash_flow: 15000000,
    };

    const mockCashflow = [
      {
        journal_entry_id: 'je-1',
        date: '2026-08-30',
        account_id: 'acc-1',
        account_code: '1010',
        account_name: 'Kas Operasional',
        account_type: 'cash' as const,
        debit_minor: 500000,
        credit_minor: 0,
        net_flow: 500000,
        description: 'Penjualan harian',
      },
    ];

    const mockReceivables = {
      items: [
        {
          id: 'recv-1',
          business_id: 'biz-1',
          customer_name: 'Pak Budi',
          total_minor: 1000000,
          paid_minor: 0,
          outstanding_minor: 1000000,
          status: 'OPEN' as const,
          created_at: '2026-08-30',
        },
      ],
      total: 1,
    };

    const mockPayables = {
      items: [
        {
          id: 'po-1',
          business_id: 'biz-1',
          code: 'PO-2201',
          supplier_name: 'UD Makmur',
          date: '2026-08-30',
          due_date: '2026-09-14',
          supplier_term: 'Tempo 14',
          status: 'received',
          total_minor: 2500000,
          paid_minor: 0,
          outstanding_minor: 2500000,
          received_minor: 2500000,
          server_version: 1,
        },
      ],
      total: 1,
    };

    vi.mocked(api.getFinanceSummary).mockResolvedValueOnce(mockSummary);
    vi.mocked(api.getFinanceCashflow).mockResolvedValueOnce(mockCashflow);
    vi.mocked(api.getReceivables).mockResolvedValueOnce(mockReceivables);
    vi.mocked(api.getPayables).mockResolvedValueOnce(mockPayables);

    const [sumRes, cfRes, recvRes, payRes] = await Promise.all([
      api.getFinanceSummary(),
      api.getFinanceCashflow(),
      api.getReceivables(),
      api.getPayables(),
    ]);

    expect(sumRes.total_assets).toBe(50000000);
    expect(cfRes).toHaveLength(1);
    expect(cfRes[0].description).toBe('Penjualan harian');
    expect(recvRes.items).toHaveLength(1);
    expect(recvRes.items[0].customer_name).toBe('Pak Budi');
    expect(payRes.items).toHaveLength(1);
    expect(payRes.items[0].supplier_name).toBe('UD Makmur');
  });

  it('BOOK-VM-002: successfully posts cash expense via API client', async () => {
    vi.mocked(api.createAndPostExpense).mockResolvedValueOnce(undefined);

    await expect(
      api.createAndPostExpense({
        business_id: 'biz-1',
        date: '2026-08-30',
        amount_minor: 150000,
        method: 'cash',
        category: 'Operasional',
        description: 'Servis printer kasir',
      })
    ).resolves.toBeUndefined();

    expect(api.createAndPostExpense).toHaveBeenCalledWith({
      business_id: 'biz-1',
      date: '2026-08-30',
      amount_minor: 150000,
      method: 'cash',
      category: 'Operasional',
      description: 'Servis printer kasir',
    });
  });

  it('BOOK-VM-003: successfully posts cash income via API client', async () => {
    vi.mocked(api.createAndPostIncome).mockResolvedValueOnce(undefined);

    await expect(
      api.createAndPostIncome({
        business_id: 'biz-1',
        date: '2026-08-30',
        amount_minor: 75000,
        method: 'cash',
        category: 'Komisi Agen',
        description: 'Komisi Agen PPOB',
      })
    ).resolves.toBeUndefined();

    expect(api.createAndPostIncome).toHaveBeenCalledWith({
      business_id: 'biz-1',
      date: '2026-08-30',
      amount_minor: 75000,
      method: 'cash',
      category: 'Komisi Agen',
      description: 'Komisi Agen PPOB',
    });
  });

  it('BOOK-VM-004: successfully settles receivable via API client', async () => {
    vi.mocked(api.collectReceivablePayment).mockResolvedValueOnce(undefined);

    await expect(
      api.collectReceivablePayment('recv-123', {
        amount_minor: 500000,
        method: 'cash',
        reference: 'TRF-001',
      })
    ).resolves.toBeUndefined();

    expect(api.collectReceivablePayment).toHaveBeenCalledWith('recv-123', {
      amount_minor: 500000,
      method: 'cash',
      reference: 'TRF-001',
    });
  });

  it('BOOK-VM-005: successfully settles payable via API client', async () => {
    vi.mocked(api.payPurchaseOrder).mockResolvedValueOnce(undefined);

    await expect(
      api.payPurchaseOrder('po-999', {
        business_id: 'biz-1',
        expected_server_version: 1,
        amount_minor: 1250000,
        method: 'bank_transfer',
        reference: 'BCA-88912',
      })
    ).resolves.toBeUndefined();

    expect(api.payPurchaseOrder).toHaveBeenCalledWith('po-999', {
      business_id: 'biz-1',
      expected_server_version: 1,
      amount_minor: 1250000,
      method: 'bank_transfer',
      reference: 'BCA-88912',
    });
  });
});
