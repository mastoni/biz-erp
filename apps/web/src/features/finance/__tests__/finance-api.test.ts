/**
 * Phase 9C.9D & Phase 4.1.41 — Finance API Contract Mapping & RBAC Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '@/lib/api';
import {
  getFinanceCashflow,
  getReceivables,
  getPayables,
  getAccounts,
  getJournals,
  getJournalById,
  createJournalReversal,
  getProfitLossReport,
  getBalanceSheetReport,
  getCashflowStatementReport,
  getGeneralLedgerReport,
  getTrialBalanceReport,
  getFinanceApiErrorMessage,
  createAndPostIncome,
  createAndPostExpense,
  collectReceivablePayment,
  payPurchaseOrder,
  getRecentExpenses,
  getMonthlyCashflowReport,
} from '../api';
import { canAccessRoute } from '@/lib/rbac';

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
    const result = await getMonthlyCashflowReport({ branch_id: 'branch-1' });

    expect(Array.isArray(result.entries)).toBe(true);
    expect(result.total_inflow).toBe(1000000);
    expect(result.net_cash_flow).toBe(1000000);
  });

  it('FIN-API-012: getAccounts fetches chart of accounts and serializes query params', async () => {
    const accountsResponse = {
      data: {
        items: [
          {
            id: 'acc-1',
            code: '100',
            name: 'Kas Utama',
            type: 'cash',
            currency: 'IDR',
            active: true,
            created_at: '2026-01-01T00:00:00Z',
          },
          {
            id: 'acc-2',
            code: '500',
            name: 'Pendapatan Penjualan',
            type: 'revenue',
            currency: 'IDR',
            active: true,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        total: 2,
      },
    };

    vi.mocked(api.get).mockResolvedValueOnce(accountsResponse);

    const result = await getAccounts({ limit: 50, offset: 0 });

    expect(api.get).toHaveBeenCalledWith('/v1/finance/accounts', {
      params: { limit: 50, offset: 0 },
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[0].code).toBe('100');
    expect(result.total).toBe(2);
  });

  it('FIN-API-013: getJournals fetches journals with status and branch filter serialization', async () => {
    const journalsResponse = {
      data: {
        items: [
          {
            id: 'j-1',
            business_id: 'biz-1',
            branch_id: 'branch-1',
            date: '2026-09-01',
            source_type: 'SALE',
            source_id: 'sale-1',
            reference: 'INV-001',
            description: 'Sale Invoice INV-001',
            status: 'posted',
            reversed_by: null,
            reversed_at: null,
            reversal_of: null,
            created_at: '2026-09-01T10:00:00Z',
            server_version: 1,
          },
        ],
        total: 1,
        has_more: false,
      },
    };

    vi.mocked(api.get).mockResolvedValueOnce(journalsResponse);

    const result = await getJournals({
      branch_id: 'branch-1',
      status: 'posted',
      limit: 20,
      offset: 0,
    });

    expect(api.get).toHaveBeenCalledWith('/v1/finance/journals', {
      params: {
        branch_id: 'branch-1',
        status: 'posted',
        limit: 20,
        offset: 0,
      },
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('j-1');
    expect(result.items[0].status).toBe('posted');
  });

  it('FIN-API-014: getJournalById fetches specific journal details with line items', async () => {
    const journalDetailResponse = {
      data: {
        id: 'j-100',
        business_id: 'biz-1',
        branch_id: null,
        date: '2026-09-01',
        source_type: 'SALE',
        source_id: 'sale-100',
        reference: 'INV-100',
        description: 'Sale Journal',
        status: 'posted',
        reversed_by: null,
        reversed_at: null,
        reversal_of: null,
        created_at: '2026-09-01T10:00:00Z',
        server_version: 1,
        lines: [
          {
            id: 'jl-1',
            journal_entry_id: 'j-100',
            account_id: 'acc-1',
            debit_minor: 500000,
            credit_minor: 0,
            description: 'Debit Cash',
            created_at: '2026-09-01T10:00:00Z',
          },
          {
            id: 'jl-2',
            journal_entry_id: 'j-100',
            account_id: 'acc-2',
            debit_minor: 0,
            credit_minor: 500000,
            description: 'Credit Revenue',
            created_at: '2026-09-01T10:00:00Z',
          },
        ],
      },
    };

    vi.mocked(api.get).mockResolvedValueOnce(journalDetailResponse);

    const result = await getJournalById('j-100');

    expect(api.get).toHaveBeenCalledWith('/v1/finance/journals/j-100');
    expect(result.id).toBe('j-100');
    expect(result.lines).toHaveLength(2);
    expect(result.lines?.[0].debit_minor).toBe(500000);
  });

  it('FIN-API-015: createJournalReversal posts journal_id to /v1/finance/reversals', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { reversalId: 'rev-journal-999' },
    });

    const result = await createJournalReversal('j-target-123');

    expect(api.post).toHaveBeenCalledWith('/v1/finance/reversals', {
      journal_id: 'j-target-123',
    });
    expect(result.reversalId).toBe('rev-journal-999');
  });

  it('FIN-API-016: getProfitLossReport calls /v1/finance/reports/profit-loss with correct query filters', async () => {
    const mockPL = {
      data: {
        revenue_minor: 15000000,
        cogs_minor: 8000000,
        operating_expense_minor: 2000000,
        expense_minor: 10000000,
        net_income_minor: 5000000,
      },
    };

    vi.mocked(api.get).mockResolvedValueOnce(mockPL);

    const result = await getProfitLossReport({
      from: '2026-08-01',
      to: '2026-08-31',
      branch_id: 'branch-1',
    });

    expect(api.get).toHaveBeenCalledWith('/v1/finance/reports/profit-loss', {
      params: {
        from: '2026-08-01',
        to: '2026-08-31',
        branch_id: 'branch-1',
      },
    });
    expect(result.revenue_minor).toBe(15000000);
    expect(result.net_income_minor).toBe(5000000);
  });

  it('FIN-API-017: getBalanceSheetReport maps as_of date properly to backend parameter', async () => {
    const mockBS = {
      data: {
        total_assets_minor: 100000000,
        total_liabilities_minor: 40000000,
        total_equity_minor: 60000000,
      },
    };

    vi.mocked(api.get).mockResolvedValueOnce(mockBS);

    const result = await getBalanceSheetReport({
      as_of: '2026-08-31',
      branch_id: 'branch-1',
    });

    expect(api.get).toHaveBeenCalledWith('/v1/finance/reports/balance-sheet', {
      params: {
        as_of: '2026-08-31',
        branch_id: 'branch-1',
      },
    });
    expect(result.total_assets_minor).toBe(100000000);
    expect(result.total_equity_minor).toBe(60000000);
  });

  it('FIN-API-018: getCashflowStatementReport fetches cashflow statement report', async () => {
    const mockCashflow = {
      data: {
        entries: [
          {
            journal_entry_id: 'j-cf-1',
            date: '2026-08-10',
            account_id: 'acc-1',
            account_code: '100',
            account_name: 'Kas',
            account_type: 'cash',
            debit_minor: 2500000,
            credit_minor: 0,
            net_flow: 2500000,
            description: 'Inflow',
          },
        ],
        total_inflow: 2500000,
        total_outflow: 0,
        net_cash_flow: 2500000,
      },
    };

    vi.mocked(api.get).mockResolvedValueOnce(mockCashflow);

    const result = await getCashflowStatementReport({
      from: '2026-08-01',
      to: '2026-08-31',
    });

    expect(api.get).toHaveBeenCalledWith('/v1/finance/reports/cashflow', {
      params: {
        from: '2026-08-01',
        to: '2026-08-31',
      },
    });
    expect(result.total_inflow).toBe(2500000);
    expect(result.entries).toHaveLength(1);
  });

  it('FIN-API-019: getGeneralLedgerReport serializes from, to, branch_id and account_id parameters', async () => {
    const mockGL = {
      data: {
        opening_balance: 1000000,
        period_movements: 500000,
        closing_balance: 1500000,
        entries: [
          {
            account_id: 'acc-1',
            account_code: '100',
            account_name: 'Kas',
            account_type: 'cash',
            opening_balance: 1000000,
            journal_entry_id: 'j-1',
            date: '2026-08-15',
            source_type: 'SALE',
            description: 'Sale 01',
            debit_minor: 500000,
            credit_minor: 0,
            running_balance: 1500000,
          },
        ],
      },
    };

    vi.mocked(api.get).mockResolvedValueOnce(mockGL);

    const result = await getGeneralLedgerReport({
      from: '2026-08-01',
      to: '2026-08-31',
      branch_id: 'branch-1',
      account_id: 'acc-1',
    });

    expect(api.get).toHaveBeenCalledWith('/v1/finance/reports/general-ledger', {
      params: {
        from: '2026-08-01',
        to: '2026-08-31',
        branch_id: 'branch-1',
        account_id: 'acc-1',
      },
    });
    expect(result.entries).toHaveLength(1);
    expect(result.closing_balance).toBe(1500000);
  });

  it('FIN-API-020: getTrialBalanceReport queries /v1/finance/reports/account-balances', async () => {
    const mockTB = {
      data: [
        {
          account_id: 'acc-1',
          account_code: '100',
          account_name: 'Kas',
          account_type: 'cash',
          debit_total: 2000000,
          credit_total: 500000,
          balance: 1500000,
        },
        {
          account_id: 'acc-2',
          account_code: '500',
          account_name: 'Pendapatan',
          account_type: 'revenue',
          debit_total: 0,
          credit_total: 1500000,
          balance: -1500000,
        },
      ],
    };

    vi.mocked(api.get).mockResolvedValueOnce(mockTB);

    const result = await getTrialBalanceReport({
      from: '2026-08-01',
      to: '2026-08-31',
    });

    expect(api.get).toHaveBeenCalledWith('/v1/finance/reports/account-balances', {
      params: {
        from: '2026-08-01',
        to: '2026-08-31',
      },
    });
    expect(result).toHaveLength(2);
    expect(result[0].account_code).toBe('100');
  });

  it('FIN-API-021: getFinanceApiErrorMessage translates 400, 403, 404, 409, 500 and network errors to Indonesian', () => {
    const err400AlreadyReversed = {
      response: {
        status: 400,
        data: { message: 'Journal has already been reversed' },
      },
    };
    expect(getFinanceApiErrorMessage(err400AlreadyReversed)).toBe(
      'Jurnal ini sudah pernah dibalikkan sebelumnya.'
    );

    const err400ApiErrorCode = {
      response: {
        status: 400,
        data: { error: { code: 'ALREADY_REVERSED', message: 'Something went wrong' } },
      },
    };
    expect(getFinanceApiErrorMessage(err400ApiErrorCode)).toBe(
      'Jurnal ini sudah pernah dibalikkan sebelumnya.'
    );

    const err400OnlyPosted = {
      response: {
        status: 400,
        data: { message: 'Only posted journals can be reversed' },
      },
    };
    expect(getFinanceApiErrorMessage(err400OnlyPosted)).toBe(
      'Hanya jurnal berstatus posted yang dapat dibalikkan.'
    );

    const err400Generic = {
      response: {
        status: 400,
        data: {},
      },
    };
    expect(getFinanceApiErrorMessage(err400Generic)).toBe(
      'Permintaan tidak valid atau parameter tanggal tidak sesuai.'
    );

    const err403 = {
      response: {
        status: 403,
        data: { message: 'Forbidden' },
      },
    };
    expect(getFinanceApiErrorMessage(err403)).toBe(
      'Akses ditolak: Hanya pemilik (OWNER) yang berhak melakukan pembalikan jurnal atau tindakan keuangan ini.'
    );

    const err404 = {
      response: {
        status: 404,
        data: { message: 'Journal not found' },
      },
    };
    expect(getFinanceApiErrorMessage(err404)).toBe(
      'Data akun atau jurnal tidak ditemukan dalam konteks bisnis Anda.'
    );

    const err409 = {
      response: {
        status: 409,
        data: { message: 'Conflict' },
      },
    };
    expect(getFinanceApiErrorMessage(err409)).toBe(
      'Jurnal sudah dibalikkan atau terjadi konflik status transaksi.'
    );

    const err500 = {
      response: {
        status: 500,
        data: { message: 'Internal Server Error' },
      },
    };
    expect(getFinanceApiErrorMessage(err500)).toBe(
      'Terjadi kesalahan internal pada server keuangan. Silakan hubungi admin.'
    );

    const netError = {
      request: {},
    };
    expect(getFinanceApiErrorMessage(netError)).toBe(
      'Koneksi jaringan terputus. Pastikan perangkat Anda terhubung ke server.'
    );

    const fallbackError = new Error('Random JS crash');
    expect(getFinanceApiErrorMessage(fallbackError)).toBe('Random JS crash');

    expect(getFinanceApiErrorMessage(null)).toBe(
      'Terjadi kesalahan tidak terduga pada sistem keuangan.'
    );
  });

  it('FIN-API-022: RBAC route permission guards correctly enforce /finance/reports, /finance/accounts, /finance/journals', () => {
    // OWNER has full access
    expect(canAccessRoute('OWNER', '/finance')).toBe(true);
    expect(canAccessRoute('OWNER', '/finance/bookkeeping')).toBe(true);
    expect(canAccessRoute('OWNER', '/finance/reports')).toBe(true);
    expect(canAccessRoute('OWNER', '/finance/reports/profit-loss')).toBe(true);
    expect(canAccessRoute('OWNER', '/finance/accounts')).toBe(true);
    expect(canAccessRoute('OWNER', '/finance/journals')).toBe(true);

    // STAFF has access to reports, accounts, journals, bookkeeping
    expect(canAccessRoute('STAFF', '/finance')).toBe(true);
    expect(canAccessRoute('STAFF', '/finance/bookkeeping')).toBe(true);
    expect(canAccessRoute('STAFF', '/finance/reports')).toBe(true);
    expect(canAccessRoute('STAFF', '/finance/reports/profit-loss')).toBe(true);
    expect(canAccessRoute('STAFF', '/finance/accounts')).toBe(true);
    expect(canAccessRoute('STAFF', '/finance/journals')).toBe(true);

    // CASHIER is allowed on /finance and /finance/bookkeeping ONLY, blocked from reports, accounts, journals
    expect(canAccessRoute('CASHIER', '/finance')).toBe(true);
    expect(canAccessRoute('CASHIER', '/finance/bookkeeping')).toBe(true);
    expect(canAccessRoute('CASHIER', '/finance/reports')).toBe(false);
    expect(canAccessRoute('CASHIER', '/finance/reports/profit-loss')).toBe(false);
    expect(canAccessRoute('CASHIER', '/finance/accounts')).toBe(false);
    expect(canAccessRoute('CASHIER', '/finance/journals')).toBe(false);

    // Unauthenticated role is blocked from everything
    expect(canAccessRoute(null, '/finance')).toBe(false);
    expect(canAccessRoute(null, '/finance/reports')).toBe(false);
  });
});
