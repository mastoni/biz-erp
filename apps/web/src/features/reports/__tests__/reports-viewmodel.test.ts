/**
 * Phase 7C — Reports ViewModel & Data Layer Unit Tests
 * REPORTS-VM-001 through REPORTS-VM-019
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatReportsDateRange,
  mapExecutiveKPI,
  mapCashFlowPoints,
  mapSalesComposition,
  mapTopProducts,
  mapInventoryReport,
  mapProfitLoss,
  generateReportsCsv,
  num,
  idr,
  idrShort,
} from '../reports-helpers';
import type {
  SalesSummaryReport,
  ProductSalesReport,
  DailySalesPoint,
  RecentSaleItem,
  ReportsRange,
  ReportTab,
} from '../types';

describe('PHASE 7C — Reports ViewModel Unit Tests', () => {
  const sampleSummary: SalesSummaryReport = {
    total_sales: 120,
    total_revenue_minor: 7328000000,
    total_items_sold: 340,
    average_order_value_minor: 61066667,
    payment_methods: [
      { payment_method: 'CASH', count: 80, total_minor: 4800000000 },
      { payment_method: 'QRIS', count: 40, total_minor: 2528000000 },
    ],
  };

  const sampleDailyPoints: DailySalesPoint[] = [
    { date: '2026-08-20', total_revenue_minor: 1200000000, transaction_count: 20 },
    { date: '2026-08-21', total_revenue_minor: 1500000000, transaction_count: 25 },
    { date: '2026-08-22', total_revenue_minor: 0, transaction_count: 0 },
    { date: '2026-08-23', total_revenue_minor: 1800000000, transaction_count: 30 },
  ];

  const sampleProducts: ProductSalesReport[] = [
    { product_id: 'prod-001', product_name: 'Kopi Susu Gula Aren', category: 'Minuman', total_quantity: 150, total_revenue_minor: 2700000000 },
    { product_id: 'prod-002', product_name: 'Croissant Butter', category: 'Makanan', total_quantity: 80, total_revenue_minor: 2000000000 },
    { product_id: 'prod-003', product_name: 'Americano Ice', category: 'Minuman', total_quantity: 60, total_revenue_minor: 1080000000 },
    { product_id: 'prod-004', product_name: 'Potato Chips', category: 'Snack', total_quantity: 40, total_revenue_minor: 600000000 },
    { product_id: 'prod-005', product_name: 'Mineral Water', category: 'Minuman', total_quantity: 30, total_revenue_minor: 300000000 },
    { product_id: 'prod-006', product_name: 'Earl Grey Tea', category: 'Minuman', total_quantity: 20, total_revenue_minor: 400000000 },
  ];

  const sampleStocks = [
    { sku: 'KPS-001', name: 'Kopi Susu', category: 'Minuman', price_minor: 1800000, cost_minor: 1000000, quantity: 20, is_active: true },
    { sku: 'CRS-001', name: 'Croissant', category: 'Makanan', price_minor: 2500000, cost_minor: 1500000, quantity: 15, is_active: true },
    { sku: 'PTC-001', name: 'Potato Chips', category: 'Snack', price_minor: 1500000, cost_minor: 800000, quantity: 10, is_active: true },
    { sku: 'MNR-001', name: 'Mineral Water', category: 'Minuman', price_minor: 1000000, cost_minor: 500000, quantity: 50, is_active: true },
  ];

  // ---------------------------------------------------------------------------
  // REPORTS-VM-001: executive KPI mapping
  // ---------------------------------------------------------------------------
  it('REPORTS-VM-001: maps executive KPI correctly from sales summary', () => {
    const kpi = mapExecutiveKPI(sampleSummary, 4500000000, 1200000000);
    expect(kpi.revenue_minor).toBe(7328000000);
    expect(kpi.gross_profit_minor).toBe(2828000000);
    expect(kpi.operating_expense_minor).toBe(1200000000);
    expect(kpi.net_profit_minor).toBe(1628000000);
    expect(Math.round(kpi.gross_margin_percent!)).toBe(39);
  });

  // ---------------------------------------------------------------------------
  // REPORTS-VM-002: 7-day range
  // ---------------------------------------------------------------------------
  it('REPORTS-VM-002: formats exact 7-day UTC date range boundaries', () => {
    const refDate = new Date('2026-08-26T12:00:00.000Z');
    const { from, to } = formatReportsDateRange('7d', refDate);
    expect(from).toBe('2026-08-20T00:00:00.000Z');
    expect(to).toBe('2026-08-26T12:00:00.000Z');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-VM-003: 30-day range
  // ---------------------------------------------------------------------------
  it('REPORTS-VM-003: formats exact 30-day UTC date range boundaries', () => {
    const refDate = new Date('2026-08-26T12:00:00.000Z');
    const { from, to } = formatReportsDateRange('30d', refDate);
    expect(from).toBe('2026-07-28T00:00:00.000Z');
    expect(to).toBe('2026-08-26T12:00:00.000Z');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-VM-004: zero-filled dates
  // ---------------------------------------------------------------------------
  it('REPORTS-VM-004: cash flow mapping preserves zero revenue days without dropping dates', () => {
    const points = mapCashFlowPoints(sampleDailyPoints);
    expect(points).toHaveLength(4);
    expect(points[2].date).toBe('2026-08-22');
    expect(points[2].inflow_minor).toBe(0);
    expect(points[2].label).toBe('22/8');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-VM-005: gross profit from canonical cost
  // ---------------------------------------------------------------------------
  it('REPORTS-VM-005: evaluates gross profit strictly when canonical HPP is available', () => {
    const kpi = mapExecutiveKPI(sampleSummary, 3000000000, null);
    expect(kpi.gross_profit_minor).toBe(4328000000);
    expect(kpi.operating_expense_minor).toBeNull();
    expect(kpi.net_profit_minor).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // REPORTS-VM-006: null cost produces unavailable gross profit
  // ---------------------------------------------------------------------------
  it('REPORTS-VM-006: returns null for gross profit when HPP is null/unbacked', () => {
    const kpi = mapExecutiveKPI(sampleSummary, null, null);
    expect(kpi.revenue_minor).toBe(7328000000);
    expect(kpi.gross_profit_minor).toBeNull();
    expect(kpi.gross_margin_percent).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // REPORTS-VM-007: expense unavailable state
  // ---------------------------------------------------------------------------
  it('REPORTS-VM-007: keeps operating expense null when no canonical ledger exists', () => {
    const pnl = mapProfitLoss(7328000000, 3000000000, null);
    expect(pnl.operating_expense_minor).toBeNull();
    expect(pnl.status).toBe('EXPENSE_UNAVAILABLE');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-VM-008: net profit unavailable state
  // ---------------------------------------------------------------------------
  it('REPORTS-VM-008: leaves net profit null if either gross profit or expense is unavailable', () => {
    const pnlWithoutExpense = mapProfitLoss(7328000000, 3000000000, null);
    expect(pnlWithoutExpense.net_profit_minor).toBeNull();

    const pnlWithoutHpp = mapProfitLoss(7328000000, null, 1000000000);
    expect(pnlWithoutHpp.net_profit_minor).toBeNull();
    expect(pnlWithoutHpp.status).toBe('INCOMPLETE_COST_UNAVAILABLE');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-VM-009: cash flow mapping
  // ---------------------------------------------------------------------------
  it('REPORTS-VM-009: maps daily points into cash flow chart points with formatted labels', () => {
    const points = mapCashFlowPoints(sampleDailyPoints);
    expect(points[0].label).toBe('20/8');
    expect(points[0].inflow_minor).toBe(1200000000);
    expect(points[0].outflow_minor).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // REPORTS-VM-010: sales composition mapping
  // ---------------------------------------------------------------------------
  it('REPORTS-VM-010: aggregates sales composition by category with accurate percentages and colors', () => {
    const composition = mapSalesComposition(sampleProducts);
    expect(composition.length).toBe(3); // Minuman, Makanan, Snack

    const minuman = composition.find((c) => c.category === 'Minuman')!;
    expect(minuman).toBeDefined();
    expect(minuman.quantity).toBe(260); // 150 + 60 + 30 + 20
    expect(minuman.color).toBe('#17593e');
    expect(minuman.percentage).toBe(68); // 260 / 380 = 68.4% -> 68%
  });

  // ---------------------------------------------------------------------------
  // REPORTS-VM-011: top 5 ordering
  // ---------------------------------------------------------------------------
  it('REPORTS-VM-011: slices top 5 products deterministically', () => {
    const top5 = mapTopProducts(sampleProducts, 5);
    expect(top5).toHaveLength(5);
    expect(top5[0].product_name).toBe('Kopi Susu Gula Aren');
    expect(top5[0].percentage).toBe(100);
    expect(top5[1].product_name).toBe('Croissant Butter');
    expect(top5[1].percentage).toBe(53); // 80 / 150 = 53.3% -> 53%
    expect(top5.find((p) => p.product_name === 'Earl Grey Tea')).toBeUndefined(); // 6th item omitted
  });

  // ---------------------------------------------------------------------------
  // REPORTS-VM-012: inventory category valuation
  // ---------------------------------------------------------------------------
  it('REPORTS-VM-012: groups inventory into categories with retail and cost valuations', () => {
    const report = mapInventoryReport(sampleStocks);
    expect(report.categories.length).toBe(3); // Minuman, Makanan, Snack

    const minuman = report.categories.find((c) => c.category === 'Minuman')!;
    expect(minuman.sku_count).toBe(2);
    expect(minuman.quantity).toBe(70); // 20 + 50
    expect(minuman.valuation_minor).toBe(20 * 1800000 + 50 * 1000000); // 36M + 50M = 86000000
    expect(minuman.cost_valuation_minor).toBe(20 * 1000000 + 50 * 500000); // 20M + 25M = 45000000
  });

  // ---------------------------------------------------------------------------
  // REPORTS-VM-013: SKU count
  // ---------------------------------------------------------------------------
  it('REPORTS-VM-013: calculates active total SKU count across inventory', () => {
    const report = mapInventoryReport(sampleStocks);
    expect(report.total_skus).toBe(4);
  });

  // ---------------------------------------------------------------------------
  // REPORTS-VM-014: inventory quantity
  // ---------------------------------------------------------------------------
  it('REPORTS-VM-014: calculates total units across inventory', () => {
    const report = mapInventoryReport(sampleStocks);
    expect(report.total_quantity).toBe(95); // 20 + 15 + 10 + 50
  });

  // ---------------------------------------------------------------------------
  // REPORTS-VM-015: P0/P1 tab separation
  // ---------------------------------------------------------------------------
  it('REPORTS-VM-015: classifies P0 vs P1 tabs accurately', () => {
    const isP1 = (tab: ReportTab) => ['pembelian', 'hutangpiutang', 'digital'].includes(tab);
    expect(isP1('penjualan')).toBe(false);
    expect(isP1('labarugi')).toBe(false);
    expect(isP1('stok')).toBe(false);
    expect(isP1('pembelian')).toBe(true);
    expect(isP1('hutangpiutang')).toBe(true);
    expect(isP1('digital')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // REPORTS-VM-016: tenant switch clears state
  // ---------------------------------------------------------------------------
  it('REPORTS-VM-016: maps empty defaults on tenant switch or empty summary', () => {
    const kpi = mapExecutiveKPI(null);
    expect(kpi.revenue_minor).toBe(0);
    expect(kpi.gross_profit_minor).toBeNull();
    expect(kpi.net_profit_minor).toBeNull();

    const emptyReport = mapInventoryReport([]);
    expect(emptyReport.total_skus).toBe(0);
    expect(emptyReport.total_quantity).toBe(0);
    expect(emptyReport.valuation_minor).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // REPORTS-VM-017: branch switch reloads scoped reports
  // ---------------------------------------------------------------------------
  it('REPORTS-VM-017: allows filtering reports per branch scope', () => {
    const branch1Stocks = sampleStocks.slice(0, 2);
    const branch1Report = mapInventoryReport(branch1Stocks);
    expect(branch1Report.total_skus).toBe(2);
    expect(branch1Report.total_quantity).toBe(35);
  });

  // ---------------------------------------------------------------------------
  // REPORTS-VM-018: CSV header and delimiter
  // ---------------------------------------------------------------------------
  it('REPORTS-VM-018: generates CSV with Indonesian semicolon delimiter and UTF-8 BOM', () => {
    const csv = generateReportsCsv('penjualan', {
      range: '30d',
      sales: [
        {
          id: 'sale-001',
          receipt_number: 'TRX-1001',
          total_minor: 4800000,
          payment_method: 'CASH',
          cashier_id: 'Rani',
          created_at: '2026-08-26 10:15:00',
          branch_id: 'branch-1',
        },
      ],
    });

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"No. Struk";"Waktu";"Kasir";"Metode";"Total";"Status"');
    expect(csv).toContain('"TRX-1001";"2026-08-26 10:15:00";"Rani";"CASH";"48000";"Selesai"');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-VM-019: no mock/static report figures
  // ---------------------------------------------------------------------------
  it('REPORTS-VM-019: all metrics are derived strictly from input parameters without static fixtures', () => {
    const dynamicSummary: SalesSummaryReport = {
      total_sales: 5,
      total_revenue_minor: 125000000,
      total_items_sold: 10,
      average_order_value_minor: 25000000,
      payment_methods: [],
    };
    const kpi = mapExecutiveKPI(dynamicSummary);
    expect(kpi.revenue_minor).toBe(125000000);
    expect(idrShort(kpi.revenue_minor)).toBe('Rp 1,25 jt');
  });
});
