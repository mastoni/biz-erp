import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDashboardViewModel, formatPaymentMethodLabel } from '../api';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

describe('PHASE 2D — Dashboard ViewModel & Data Client Suite', () => {
  const branch1Id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const branch2Id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDashboardResponse = {
    data: {
      total_revenue_minor: 5000000,
      total_sales: 10,
      total_customers: 25,
      total_products: 42,
      out_of_stock_count: 3,
      top_products: [
        { product_id: 'p1', product_name: 'Kopi Susu Gula Aren', quantity_sold: 15 },
        { product_id: 'p2', product_name: 'Croissant Butter', quantity_sold: 8 },
      ],
    },
  };

  const mockSummaryResponse = {
    data: {
      sales_summary: {
        total_sales: 10,
        total_revenue_minor: 5000000,
        total_items_sold: 23,
        average_order_value_minor: 500000,
        payment_methods: [
          { payment_method: 'CASH', count: 6, total_minor: 3000000 },
          { payment_method: 'QRIS', count: 4, total_minor: 2000000 },
        ],
      },
    },
  };

  const mockHourlyResponse = {
    data: {
      buckets: [
        { hour: 9, total_revenue_minor: 1500000, transaction_count: 3 },
        { hour: 14, total_revenue_minor: 3500000, transaction_count: 7 },
      ],
    },
  };

  const mockRecentResponse = {
    data: {
      sales: [
        {
          id: 'sale-1',
          receipt_number: 'REC-001',
          total_minor: 2500000,
          payment_method: 'CASH',
          cashier_id: 'cashier-1',
          created_at: '2026-08-25T14:30:00Z',
          branch_id: branch1Id,
        },
        {
          id: 'sale-2',
          receipt_number: 'REC-002',
          total_minor: 2500000,
          payment_method: 'QRIS',
          cashier_id: 'cashier-2',
          created_at: '2026-08-25T12:00:00Z',
          branch_id: null, // Historical sale with null branch
        },
      ],
    },
  };

  it('DASHBOARD-001: all KPI fields map correctly', async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === '/v1/dashboard') return mockDashboardResponse;
      if (url === '/v1/reports/sales-summary') return mockSummaryResponse;
      if (url === '/v1/reports/sales-hourly') return mockHourlyResponse;
      if (url === '/v1/reports/recent-sales') return mockRecentResponse;
      return { data: {} };
    });

    const vm = await fetchDashboardViewModel({ branchId: branch1Id });

    expect(vm.kpis.total_revenue_minor).toBe(5000000);
    expect(vm.kpis.total_sales).toBe(10);
    expect(vm.kpis.average_order_value_minor).toBe(500000);
    expect(vm.kpis.total_products).toBe(42);
    expect(vm.kpis.total_customers).toBe(25);
    expect(vm.stock_alerts.out_of_stock_count).toBe(3);
  });

  it('DASHBOARD-002: branch-scoped values remain branch-scoped', async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === '/v1/dashboard') return mockDashboardResponse;
      if (url === '/v1/reports/sales-summary') return mockSummaryResponse;
      if (url === '/v1/reports/sales-hourly') return mockHourlyResponse;
      if (url === '/v1/reports/recent-sales') return mockRecentResponse;
      return { data: {} };
    });

    const vm = await fetchDashboardViewModel({ branchId: branch1Id });

    expect(vm.branch_id).toBe(branch1Id);
    expect(api.get).toHaveBeenCalledWith('/v1/dashboard', expect.objectContaining({
      params: expect.objectContaining({ branch_id: branch1Id }),
    }));
    expect(api.get).toHaveBeenCalledWith('/v1/reports/sales-summary', expect.objectContaining({
      params: expect.objectContaining({ branch_id: branch1Id }),
    }));
  });

  it('DASHBOARD-003: tenant-scoped product count remains tenant-scoped', async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === '/v1/dashboard') return mockDashboardResponse;
      return { data: {} };
    });

    const vm = await fetchDashboardViewModel({ branchId: branch1Id });
    expect(vm.kpis.total_products).toBe(42);
  });

  it('DASHBOARD-004: hourly buckets preserve 24-hour shape', async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === '/v1/reports/sales-hourly') return mockHourlyResponse;
      return { data: {} };
    });

    const vm = await fetchDashboardViewModel({ branchId: branch1Id });

    expect(vm.hourly_sales.length).toBe(24);
    expect(vm.hourly_sales[9].hour).toBe(9);
    expect(vm.hourly_sales[9].total_revenue_minor).toBe(1500000);
    expect(vm.hourly_sales[9].transaction_count).toBe(3);

    // Empty hour checks
    expect(vm.hourly_sales[0].hour).toBe(0);
    expect(vm.hourly_sales[0].total_revenue_minor).toBe(0);
    expect(vm.hourly_sales[0].transaction_count).toBe(0);
  });

  it('DASHBOARD-005: payment mix normalization', async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === '/v1/dashboard') return mockDashboardResponse;
      if (url === '/v1/reports/sales-summary') return mockSummaryResponse;
      return { data: {} };
    });

    const vm = await fetchDashboardViewModel({ branchId: branch1Id });

    expect(vm.payment_mix.length).toBe(2);
    const cash = vm.payment_mix.find((p) => p.payment_method === 'CASH');
    expect(cash).toBeDefined();
    expect(cash!.label).toBe('Tunai');
    expect(cash!.total_minor).toBe(3000000);
    expect(cash!.percentage).toBe(60); // 3M / 5M = 60%

    const qris = vm.payment_mix.find((p) => p.payment_method === 'QRIS');
    expect(qris).toBeDefined();
    expect(qris!.label).toBe('QRIS');
    expect(qris!.percentage).toBe(40); // 2M / 5M = 40%
  });

  it('DASHBOARD-006: recent transactions map correctly', async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === '/v1/reports/recent-sales') return mockRecentResponse;
      return { data: {} };
    });

    const vm = await fetchDashboardViewModel({ branchId: branch1Id });

    expect(vm.recent_transactions.length).toBe(2);
    expect(vm.recent_transactions[0].id).toBe('sale-1');
    expect(vm.recent_transactions[0].receipt_number).toBe('REC-001');
    expect(vm.recent_transactions[0].total_minor).toBe(2500000);
  });

  it('DASHBOARD-007: historical/null branch fields handled safely', async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === '/v1/reports/recent-sales') return mockRecentResponse;
      return { data: {} };
    });

    const vm = await fetchDashboardViewModel({ branchId: branch1Id });

    const historicalSale = vm.recent_transactions.find((s) => s.id === 'sale-2');
    expect(historicalSale).toBeDefined();
    expect(historicalSale!.branch_id).toBeNull();
  });

  it('DASHBOARD-008: empty branch returns valid zero/empty ViewModel', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} });

    const vm = await fetchDashboardViewModel({ branchId: branch1Id });

    expect(vm.kpis.total_revenue_minor).toBe(0);
    expect(vm.kpis.total_sales).toBe(0);
    expect(vm.kpis.average_order_value_minor).toBe(0);
    expect(vm.kpis.total_products).toBe(0);
    expect(vm.kpis.total_customers).toBe(0);
    expect(vm.hourly_sales.length).toBe(24);
    expect(vm.payment_mix).toEqual([]);
    expect(vm.top_products).toEqual([]);
    expect(vm.recent_transactions).toEqual([]);
  });

  it('DASHBOARD-009: API error produces controlled error state', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'));

    await expect(fetchDashboardViewModel({ branchId: branch1Id })).rejects.toThrow('Network error');
  });

  it('DASHBOARD-010: branch change causes next fetch to use new branch_id', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} });

    await fetchDashboardViewModel({ branchId: branch1Id });
    expect(api.get).toHaveBeenCalledWith('/v1/dashboard', expect.objectContaining({
      params: expect.objectContaining({ branch_id: branch1Id }),
    }));

    await fetchDashboardViewModel({ branchId: branch2Id });
    expect(api.get).toHaveBeenCalledWith('/v1/dashboard', expect.objectContaining({
      params: expect.objectContaining({ branch_id: branch2Id }),
    }));
  });

  it('helper: formatPaymentMethodLabel handles mappings and fallbacks', () => {
    expect(formatPaymentMethodLabel('CASH')).toBe('Tunai');
    expect(formatPaymentMethodLabel('cash')).toBe('Tunai');
    expect(formatPaymentMethodLabel('QRIS')).toBe('QRIS');
    expect(formatPaymentMethodLabel('TRANSFER')).toBe('Transfer Bank');
    expect(formatPaymentMethodLabel('CARD')).toBe('Kartu');
    expect(formatPaymentMethodLabel('CUSTOM')).toBe('CUSTOM');
    expect(formatPaymentMethodLabel(null)).toBe('Lainnya');
    expect(formatPaymentMethodLabel(undefined)).toBe('Lainnya');
  });
});
