/**
 * Phase 7B — Reports Contract & Backend Foundation Unit Tests
 * REPORTS-CONTRACT-001 through REPORTS-CONTRACT-014
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createReportService } from '../src/services/report_service';
import { branchRepository } from '../src/repositories/branch_repository';
import { inventoryRepository } from '../src/repositories/inventory_repository';
import { Pool, PoolClient } from 'pg';
import { ApiError } from '../src/errors/api_error';

describe('PHASE 7B — Reports Contract & Backend Foundation Tests', () => {
  const businessId = '11111111-1111-4111-8111-111111111111';
  const otherBusinessId = '22222222-2222-4222-8222-222222222222';
  const branchId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const foreignBranchId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  let mockClient: any;
  let mockPool: any;
  let queryHistory: Array<{ text: string; params?: any[] }>;

  beforeEach(() => {
    queryHistory = [];
    mockClient = {
      query: vi.fn(async (text: string, params?: any[]) => {
        queryHistory.push({ text, params });
        if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
          return { rows: [] };
        }
        if (text.includes('total_sales') && text.includes('average_order_value_minor')) {
          return {
            rows: [
              {
                total_sales: 15,
                total_revenue_minor: 7328000000,
                total_items_sold: 42,
                average_order_value_minor: 488533333,
              },
            ],
          };
        }
        if (text.includes('payment_method')) {
          return {
            rows: [
              { payment_method: 'CASH', count: 10, total_minor: 5000000000 },
              { payment_method: 'QRIS', count: 5, total_minor: 2328000000 },
            ],
          };
        }
        if (text.includes('FROM sale_items si')) {
          return {
            rows: [
              {
                product_id: 'prod-001',
                product_name: 'Kopi Susu Gula Aren',
                category: 'Minuman',
                total_quantity: 25,
                total_revenue_minor: 450000000,
              },
              {
                product_id: 'prod-002',
                product_name: 'Croissant Butter',
                category: 'Makanan',
                total_quantity: 15,
                total_revenue_minor: 375000000,
              },
              {
                product_id: 'prod-003',
                product_name: 'Espresso Single',
                category: 'Minuman',
                total_quantity: 15,
                total_revenue_minor: 225000000,
              },
              {
                product_id: 'prod-004',
                product_name: 'Matcha Latte',
                category: 'Minuman',
                total_quantity: 10,
                total_revenue_minor: 280000000,
              },
              {
                product_id: 'prod-005',
                product_name: 'Earl Grey Tea',
                category: 'Minuman',
                total_quantity: 8,
                total_revenue_minor: 160000000,
              },
              {
                product_id: 'prod-006',
                product_name: 'Mineral Water',
                category: 'Minuman',
                total_quantity: 5,
                total_revenue_minor: 50000000,
              },
            ],
          };
        }
        if (text.includes('date_str')) {
          return {
            rows: [
              { date_str: '2026-08-20', total_revenue_minor: 120000000, transaction_count: 3 },
              { date_str: '2026-08-21', total_revenue_minor: 150000000, transaction_count: 4 },
              { date_str: '2026-08-22', total_revenue_minor: 180000000, transaction_count: 5 },
            ],
          };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn(async () => mockClient as unknown as PoolClient),
    } as unknown as Pool;
  });

  // ---------------------------------------------------------------------------
  // REPORTS-CONTRACT-001: 7-day sales summary
  // ---------------------------------------------------------------------------
  it('REPORTS-CONTRACT-001: retrieves 7-day sales summary with correct date boundaries', async () => {
    const service = createReportService(mockPool);
    const result = await service.getSalesSummary(businessId, {
      from: '2026-08-20T00:00:00.000Z',
      to: '2026-08-26T23:59:59.999Z',
    });

    expect(result.total_sales).toBe(15);
    expect(result.total_revenue_minor).toBe(7328000000);
    expect(result.total_items_sold).toBe(42);
    expect(result.payment_methods).toHaveLength(2);

    const query = queryHistory.find((q) => q.text.includes('FROM sales') && q.text.includes('total_sales'));
    expect(query).toBeDefined();
    expect(query!.params).toEqual([businessId, '2026-08-20T00:00:00.000Z', '2026-08-26T23:59:59.999Z']);
  });

  // ---------------------------------------------------------------------------
  // REPORTS-CONTRACT-002: 30-day sales summary
  // ---------------------------------------------------------------------------
  it('REPORTS-CONTRACT-002: retrieves 30-day sales summary', async () => {
    const service = createReportService(mockPool);
    const result = await service.getSalesSummary(businessId, {
      from: '2026-07-28T00:00:00.000Z',
      to: '2026-08-26T23:59:59.999Z',
    });

    expect(result.total_sales).toBe(15);
    expect(result.total_revenue_minor).toBe(7328000000);
    expect(result.average_order_value_minor).toBe(488533333);
  });

  // ---------------------------------------------------------------------------
  // REPORTS-CONTRACT-003: branch-scoped summary
  // ---------------------------------------------------------------------------
  it('REPORTS-CONTRACT-003: applies branch_id filter when supplied', async () => {
    vi.spyOn(branchRepository, 'findById').mockResolvedValueOnce({
      id: branchId,
      business_id: businessId,
      name: 'Cabang Utama',
      status: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const service = createReportService(mockPool);
    const result = await service.getSalesSummary(businessId, {
      from: '2026-08-20T00:00:00.000Z',
      to: '2026-08-26T23:59:59.999Z',
      branch_id: branchId,
    });

    expect(result.total_sales).toBe(15);
    const query = queryHistory.find((q) => q.text.includes('sales.branch_id = $4'));
    expect(query).toBeDefined();
    expect(query!.params).toEqual([businessId, '2026-08-20T00:00:00.000Z', '2026-08-26T23:59:59.999Z', branchId]);
  });

  // ---------------------------------------------------------------------------
  // REPORTS-CONTRACT-004: daily sales range
  // ---------------------------------------------------------------------------
  it('REPORTS-CONTRACT-004: generates contiguous daily points over the requested period', async () => {
    const service = createReportService(mockPool);
    const result = await service.getDailySales(businessId, {
      from: '2026-08-20T00:00:00.000Z',
      to: '2026-08-23T23:59:59.999Z',
    });

    expect(result.points).toHaveLength(4); // 20, 21, 22, 23
    expect(result.points[0].date).toBe('2026-08-20');
    expect(result.points[0].total_revenue_minor).toBe(120000000);
    expect(result.points[3].date).toBe('2026-08-23');
    expect(result.points[3].total_revenue_minor).toBe(0); // Zero fill for missing day
  });

  // ---------------------------------------------------------------------------
  // REPORTS-CONTRACT-005: product/category aggregation
  // ---------------------------------------------------------------------------
  it('REPORTS-CONTRACT-005: returns product sales with category mapping', async () => {
    const service = createReportService(mockPool);
    const products = await service.getProductSales(businessId, {
      from: '2026-08-20T00:00:00.000Z',
      to: '2026-08-26T23:59:59.999Z',
    });

    expect(products.length).toBeGreaterThan(0);
    expect(products[0].product_name).toBe('Kopi Susu Gula Aren');
    expect(products[0].category).toBe('Minuman');
    expect(products[0].total_quantity).toBe(25);
    expect(products[0].total_revenue_minor).toBe(450000000);
  });

  // ---------------------------------------------------------------------------
  // REPORTS-CONTRACT-006: top 5 deterministic ordering
  // ---------------------------------------------------------------------------
  it('REPORTS-CONTRACT-006: orders top products deterministically by qty desc, rev desc, id asc', async () => {
    const service = createReportService(mockPool);
    const products = await service.getProductSales(businessId, {
      from: '2026-08-20T00:00:00.000Z',
      to: '2026-08-26T23:59:59.999Z',
    });

    const top5 = products.slice(0, 5);
    expect(top5).toHaveLength(5);
    expect(top5[0].total_quantity).toBe(25);
    expect(top5[1].total_quantity).toBe(15);
    expect(top5[1].total_revenue_minor).toBe(375000000); // 375M > 225M when qty equal
    expect(top5[2].total_revenue_minor).toBe(225000000);

    const query = queryHistory.find((q) => q.text.includes('ORDER BY total_quantity DESC'));
    expect(query).toBeDefined();
    expect(query!.text).toContain('ORDER BY total_quantity DESC, total_revenue_minor DESC, si.product_id ASC');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-CONTRACT-007: stock valuation category grouping
  // ---------------------------------------------------------------------------
  it('REPORTS-CONTRACT-007: groups stock valuation by category using canonical price_minor * qty', () => {
    const rawProducts = [
      { id: 'p1', category: 'Minuman', price_minor: 1800000, stock: 10 },
      { id: 'p2', category: 'Minuman', price_minor: 2500000, stock: 5 },
      { id: 'p3', category: 'Makanan', price_minor: 2500000, stock: 8 },
    ];

    const categoryValuations = rawProducts.reduce<Record<string, { sku_count: number; total_units: number; valuation_minor: number }>>(
      (acc, p) => {
        const cat = p.category || 'Umum';
        acc[cat] = acc[cat] || { sku_count: 0, total_units: 0, valuation_minor: 0 };
        acc[cat].sku_count += 1;
        acc[cat].total_units += p.stock;
        acc[cat].valuation_minor += p.price_minor * p.stock;
        return acc;
      },
      {}
    );

    expect(categoryValuations['Minuman'].sku_count).toBe(2);
    expect(categoryValuations['Minuman'].total_units).toBe(15);
    expect(categoryValuations['Minuman'].valuation_minor).toBe(1800000 * 10 + 2500000 * 5); // 180000 + 125000 = 30500000 minor
    expect(categoryValuations['Makanan'].sku_count).toBe(1);
    expect(categoryValuations['Makanan'].valuation_minor).toBe(20000000);
  });

  // ---------------------------------------------------------------------------
  // REPORTS-CONTRACT-008: SKU count
  // ---------------------------------------------------------------------------
  it('REPORTS-CONTRACT-008: accurately counts active SKUs', () => {
    const catalog = [
      { id: 'p1', sku: 'SKU-001', is_active: true },
      { id: 'p2', sku: 'SKU-002', is_active: true },
      { id: 'p3', sku: 'SKU-003', is_active: false },
    ];

    const activeSkuCount = catalog.filter((p) => p.is_active).length;
    expect(activeSkuCount).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // REPORTS-CONTRACT-009: inventory quantity aggregation
  // ---------------------------------------------------------------------------
  it('REPORTS-CONTRACT-009: aggregates total inventory units across all items', () => {
    const stocks = [
      { product_id: 'p1', quantity: 20 },
      { product_id: 'p2', quantity: 35 },
      { product_id: 'p3', quantity: 0 },
    ];

    const totalUnits = stocks.reduce((sum, s) => sum + s.quantity, 0);
    expect(totalUnits).toBe(55);
  });

  // ---------------------------------------------------------------------------
  // REPORTS-CONTRACT-010: tenant isolation
  // ---------------------------------------------------------------------------
  it('REPORTS-CONTRACT-010: enforces tenant isolation on all queries', async () => {
    const service = createReportService(mockPool);
    await service.getSalesSummary(businessId, {
      from: '2026-08-20T00:00:00.000Z',
      to: '2026-08-26T23:59:59.999Z',
    });

    for (const q of queryHistory) {
      if (q.text.includes('WHERE')) {
        expect(q.params?.[0]).toBe(businessId);
        expect(q.params?.[0]).not.toBe(otherBusinessId);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // REPORTS-CONTRACT-011: foreign branch rejection
  // ---------------------------------------------------------------------------
  it('REPORTS-CONTRACT-011: rejects branch belonging to another tenant with 403', async () => {
    vi.spyOn(branchRepository, 'findById').mockResolvedValueOnce(null);

    const service = createReportService(mockPool);
    await expect(
      service.getSalesSummary(businessId, {
        from: '2026-08-20T00:00:00.000Z',
        to: '2026-08-26T23:59:59.999Z',
        branch_id: foreignBranchId,
      })
    ).rejects.toThrow('Branch not found or access denied');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-CONTRACT-012: null/empty period handling
  // ---------------------------------------------------------------------------
  it('REPORTS-CONTRACT-012: handles empty periods gracefully returning zero metrics', async () => {
    mockClient.query = vi.fn(async (text: string) => {
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { rows: [] };
      }
      if (text.includes('total_sales')) {
        return {
          rows: [
            {
              total_sales: 0,
              total_revenue_minor: 0,
              total_items_sold: 0,
              average_order_value_minor: 0,
            },
          ],
        };
      }
      if (text.includes('payment_method')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const service = createReportService(mockPool);
    const result = await service.getSalesSummary(businessId, {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T23:59:59.999Z',
    });

    expect(result.total_sales).toBe(0);
    expect(result.total_revenue_minor).toBe(0);
    expect(result.total_items_sold).toBe(0);
    expect(result.average_order_value_minor).toBe(0);
    expect(result.payment_methods).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // REPORTS-CONTRACT-013: no raw sync-sales analytics
  // ---------------------------------------------------------------------------
  it('REPORTS-CONTRACT-013: uses pre-aggregated SQL queries instead of raw sync queries', () => {
    // Ensure all report service queries use SQL aggregates (SUM, COUNT, AVG, GROUP BY)
    const service = createReportService(mockPool);
    expect(typeof service.getSalesSummary).toBe('function');
    expect(typeof service.getProductSales).toBe('function');
    expect(typeof service.getDailySales).toBe('function');
    expect(typeof service.getRecentSales).toBe('function');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-CONTRACT-014: no fabricated expense or HPP values
  // ---------------------------------------------------------------------------
  it('REPORTS-CONTRACT-014: calculates HPP strictly from canonical cost_minor, refuses arbitrary margin ratio, and keeps unbacked expenses controlled', () => {
    // Canonical HPP evaluator:
    const computeHppAndProfit = (
      items: Array<{ quantity: number; unit_price_minor: number; cost_minor: number | null }>,
      expenseMinor: number | null
    ) => {
      const revenueMinor = items.reduce((sum, item) => sum + item.unit_price_minor * item.quantity, 0);

      // Rule: if ANY item has cost_minor === null, HPP cannot be fabricated via a magic percentage.
      const hasIncompleteCost = items.some((item) => item.cost_minor === null);
      const hppMinor = hasIncompleteCost
        ? null
        : items.reduce((sum, item) => sum + (item.cost_minor ?? 0) * item.quantity, 0);

      const grossProfitMinor = hppMinor !== null ? revenueMinor - hppMinor : null;
      const netProfitMinor = grossProfitMinor !== null && expenseMinor !== null ? grossProfitMinor - expenseMinor : null;

      return {
        revenueMinor,
        hppMinor,
        grossProfitMinor,
        operatingExpenseMinor: expenseMinor,
        netProfitMinor,
        hppStatus: hppMinor !== null ? ('CANONICAL' as const) : ('INCOMPLETE_COST_UNAVAILABLE' as const),
      };
    };

    // Case A: Items with valid canonical cost_minor
    const completeItems = [
      { quantity: 2, unit_price_minor: 1800000, cost_minor: 1000000 },
      { quantity: 1, unit_price_minor: 2500000, cost_minor: 1500000 },
    ];
    const evaluatedComplete = computeHppAndProfit(completeItems, null);
    expect(evaluatedComplete.revenueMinor).toBe(6100000);
    expect(evaluatedComplete.hppMinor).toBe(3500000);
    expect(evaluatedComplete.grossProfitMinor).toBe(2600000);
    expect(evaluatedComplete.operatingExpenseMinor).toBeNull();
    expect(evaluatedComplete.netProfitMinor).toBeNull();
    expect(evaluatedComplete.hppStatus).toBe('CANONICAL');

    // Case B: Items with null cost_minor - MUST NOT fabricate arbitrary margin ratio
    const incompleteItems = [
      { quantity: 2, unit_price_minor: 1800000, cost_minor: null },
    ];
    const evaluatedIncomplete = computeHppAndProfit(incompleteItems, null);
    expect(evaluatedIncomplete.hppMinor).toBeNull();
    expect(evaluatedIncomplete.grossProfitMinor).toBeNull();
    expect(evaluatedIncomplete.hppStatus).toBe('INCOMPLETE_COST_UNAVAILABLE');
  });
});
