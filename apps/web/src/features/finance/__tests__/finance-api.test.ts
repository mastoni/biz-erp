/**
 * Phase 9C.9D — Finance API Contract Mapping Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '@/lib/api';
import { getFinanceCashflow, getReceivables, getPayables, getFinanceSummary } from '../api';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('Finance API Contract Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('FIN-API-001: getFinanceCashflow unpacks entries object from backend contract', async () => {
    const backendResponse = {
      data: {
        entries: [
          {
            journal_entry_id: 'je-1',
            date: '2026-08-30',
            account_id: 'acc-1',
            account_code: '1010',
            account_name: 'Kas Operasional',
            account_type: 'cash',
            debit_minor: 500000,
            credit_minor: 0,
            net_flow: 500000,
            description: 'Penjualan harian',
          },
        ],
        summary: {
          total_assets: 50000000,
        },
      },
    };

    vi.mocked(api.get).mockResolvedValueOnce(backendResponse);

    const result = await getFinanceCashflow({ branch_id: 'branch-1' });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].journal_entry_id).toBe('je-1');
  });

  it('FIN-API-002: getReceivables unpacks rows array from backend /v1/receivables contract', async () => {
    const backendResponse = {
      data: {
        rows: [
          {
            id: 'recv-1',
            business_id: 'biz-1',
            customer_id: 'cust-1',
            amount_minor: 1000000,
            paid_minor: 0,
            outstanding_minor: 1000000,
            status: 'OPEN',
            date: '2026-08-30',
          },
        ],
        total: 1,
      },
    };

    vi.mocked(api.get).mockResolvedValueOnce(backendResponse);

    const result = await getReceivables('branch-1');

    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('recv-1');
    expect(result.total).toBe(1);
  });

  it('FIN-API-003: getPayables unpacks items array from backend /v1/purchases contract', async () => {
    const backendResponse = {
      data: {
        items: [
          {
            id: 'po-1',
            business_id: 'biz-1',
            code: 'PO-001',
            status: 'received',
            total_minor: 2000000,
            paid_minor: 0,
            outstanding_minor: 2000000,
          },
        ],
        total: 1,
      },
    };

    vi.mocked(api.get).mockResolvedValueOnce(backendResponse);

    const result = await getPayables('biz-1', 'branch-1');

    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].code).toBe('PO-001');
    expect(result.total).toBe(1);
  });

  it('FIN-API-004: getFinanceCashflow handles direct array response gracefully', async () => {
    const backendResponse = {
      data: [
        {
          journal_entry_id: 'je-direct',
          date: '2026-08-30',
          account_id: 'acc-1',
          account_code: '1010',
          account_name: 'Kas Operasional',
          account_type: 'cash',
          debit_minor: 200000,
          credit_minor: 0,
          net_flow: 200000,
          description: 'Direct array test',
        },
      ],
    };

    vi.mocked(api.get).mockResolvedValueOnce(backendResponse);

    const result = await getFinanceCashflow();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].journal_entry_id).toBe('je-direct');
  });

  it('FIN-API-005: getReceivables handles items property backward compatibility', async () => {
    const backendResponse = {
      data: {
        items: [
          {
            id: 'recv-compat',
            business_id: 'biz-1',
            total_minor: 500000,
            paid_minor: 0,
            outstanding_minor: 500000,
            status: 'OPEN',
            created_at: '2026-08-30',
          },
        ],
        total: 1,
      },
    };

    vi.mocked(api.get).mockResolvedValueOnce(backendResponse);

    const result = await getReceivables();

    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('recv-compat');
  });

  it('FIN-API-006: createAndPostIncome calls /v1/incomes then posts to ledger with extracted income ID', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { id: 'inc-generated-456' } })
      .mockResolvedValueOnce({ data: { success: true } });

    const { createAndPostIncome } = await import('../api');
    await createAndPostIncome({
      business_id: 'biz-1',
      date: '2026-08-30',
      amount_minor: 50000,
      method: 'cash',
      description: 'Pendapatan Lain',
    });

    expect(api.post).toHaveBeenNthCalledWith(
      1,
      '/v1/incomes',
      expect.objectContaining({
        business_id: 'biz-1',
        amount_minor: 50000,
        method: 'cash',
        description: 'Pendapatan Lain',
      })
    );
    expect(api.post).toHaveBeenNthCalledWith(2, '/v1/finance/postings/income', {
      income_id: 'inc-generated-456',
    });
  });

  it('FIN-API-007: payPurchaseOrder includes valid UUID in Idempotency-Key header', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true } });

    const { payPurchaseOrder } = await import('../api');
    await payPurchaseOrder('po-uuid-123', {
      business_id: 'biz-1',
      expected_server_version: 1,
      amount_minor: 250000,
      method: 'cash',
    });

    expect(api.post).toHaveBeenCalledWith(
      '/v1/purchases/po-uuid-123/pay',
      {
        business_id: 'biz-1',
        expected_server_version: 1,
        amount_minor: 250000,
        method: 'cash',
      },
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          ),
        }),
      })
    );
  });

  it('FIN-API-008: createAndPostExpense calls /v1/expenses then posts to ledger with extracted expense ID', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { id: 'exp-generated-789' } })
      .mockResolvedValueOnce({ data: { success: true } });

    const { createAndPostExpense } = await import('../api');
    await createAndPostExpense({
      business_id: 'biz-1',
      date: '2026-08-30',
      amount_minor: 75000,
      method: 'cash',
      description: 'Beli ATK',
    });

    expect(api.post).toHaveBeenNthCalledWith(
      1,
      '/v1/expenses',
      expect.objectContaining({
        business_id: 'biz-1',
        amount_minor: 75000,
        method: 'cash',
        description: 'Beli ATK',
      })
    );
    expect(api.post).toHaveBeenNthCalledWith(2, '/v1/finance/postings/expense', {
      expense_id: 'exp-generated-789',
    });
  });

  it('FIN-API-009: collectReceivablePayment calls /v1/receivables/:id/collections with payload', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true } });

    const { collectReceivablePayment } = await import('../api');
    await collectReceivablePayment('recv-999', {
      amount_minor: 150000,
      method: 'bank_transfer',
      reference: 'BCA-001',
    });

    expect(api.post).toHaveBeenCalledWith('/v1/receivables/recv-999/collections', {
      amount_minor: 150000,
      method: 'bank_transfer',
      reference: 'BCA-001',
    });
  });

  it('FIN-API-010: getRecentExpenses unpacks items from object wrapper and direct array', async () => {
    const objectResponse = {
      data: {
        items: [
          {
            id: 'exp-1',
            business_id: 'biz-1',
            date: '2026-08-30',
            amount_minor: 50000,
            method: 'cash',
            description: 'Operasional',
            status: 'posted',
            server_version: 1,
          },
        ],
      },
    };

    vi.mocked(api.get).mockResolvedValueOnce(objectResponse);
    const { getRecentExpenses } = await import('../api');
    const res1 = await getRecentExpenses('branch-1', 5);
    expect(Array.isArray(res1)).toBe(true);
    expect(res1).toHaveLength(1);
    expect(res1[0].id).toBe('exp-1');

    const arrayResponse = {
      data: [
        {
          id: 'exp-2',
          business_id: 'biz-1',
          date: '2026-08-30',
          amount_minor: 100000,
          method: 'cash',
          description: 'Operasional 2',
          status: 'posted',
          server_version: 1,
        },
      ],
    };

    vi.mocked(api.get).mockResolvedValueOnce(arrayResponse);
    const res2 = await getRecentExpenses('branch-1', 5);
    expect(Array.isArray(res2)).toBe(true);
    expect(res2).toHaveLength(1);
    expect(res2[0].id).toBe('exp-2');
  });

  it('FIN-API-011: getMonthlyCashflowReport returns report data structure from /v1/finance/reports/cashflow', async () => {
    const reportResponse = {
      data: {
        entries: [
          {
            journal_entry_id: 'je-1',
            date: '2026-08-15',
            account_id: 'acc-1',
            account_code: '1010',
            account_name: 'Kas',
            account_type: 'cash',
            debit_minor: 1000000,
            credit_minor: 0,
            net_flow: 1000000,
            description: 'Penjualan',
          },
        ],
        total_inflow: 1000000,
        total_outflow: 0,
        net_cash_flow: 1000000,
      },
    };

    vi.mocked(api.get).mockResolvedValueOnce(reportResponse);
    const { getMonthlyCashflowReport } = await import('../api');
    const result = await getMonthlyCashflowReport({ branch_id: 'branch-1' });

    expect(Array.isArray(result.entries)).toBe(true);
    expect(result.total_inflow).toBe(1000000);
    expect(result.net_cash_flow).toBe(1000000);
  });
});
