/**
 * Phase 7D — Reports UI Component & Visual Acceptance Test Suite
 * REPORTS-UI-001 through REPORTS-UI-020
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import ReportsPage from '@/app/(authenticated)/reports/page';
import { ReportsExecutiveKPICards } from '../components/ReportsExecutiveKPICards';
import { CashFlowChart, SalesCompositionChart } from '../components/ReportsCharts';
import { ReportsTabSelector } from '../components/ReportsTabSelector';
import { ReportsActivePanel } from '../components/ReportsActivePanel';
import {
  idr,
  idrShort,
  num,
  generateReportsCsv,
} from '../reports-helpers';
import type {
  ReportsExecutiveKPI,
  CashFlowPoint,
  SalesCompositionItem,
  SalesReportViewModel,
  InventoryReportViewModel,
  ProfitLossViewModel,
} from '../types';

// Mock Auth Context
vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-1', name: 'Owner', role: 'OWNER' },
    business: { id: '11111111-1111-4111-8111-111111111111', name: 'SKM Mart' },
  }),
}));

describe('PHASE 7D — Reports UI Acceptance Tests', () => {
  const sampleKPI: ReportsExecutiveKPI = {
    revenue_minor: 7328000000,
    gross_profit_minor: 2828000000,
    gross_margin_percent: 38.6,
    operating_expense_minor: null,
    net_profit_minor: null,
  };

  const sampleCashFlow: CashFlowPoint[] = [
    { date: '2026-08-20', label: '20/8', inflow_minor: 1200000000, outflow_minor: null },
    { date: '2026-08-21', label: '21/8', inflow_minor: 1500000000, outflow_minor: null },
    { date: '2026-08-22', label: '22/8', inflow_minor: 1800000000, outflow_minor: null },
  ];

  const sampleComposition: SalesCompositionItem[] = [
    { category: 'Minuman', quantity: 150, revenue_minor: 2700000000, percentage: 65, color: '#17593e' },
    { category: 'Makanan', quantity: 80, revenue_minor: 2000000000, percentage: 35, color: '#d3921f' },
  ];

  const sampleSalesReport: SalesReportViewModel = {
    summary: {
      total_sales: 120,
      total_revenue_minor: 7328000000,
      total_items_sold: 340,
      average_order_value_minor: 61066667,
      payment_methods: [],
    },
    transactions: [
      {
        id: 'sale-001',
        receipt_number: 'TRX-1001',
        total_minor: 4800000,
        payment_method: 'CASH',
        cashier_id: 'Rani',
        created_at: '2026-08-26T10:15:00.000Z',
        branch_id: 'branch-1',
      },
    ],
    top_products: [
      {
        product_id: 'p1',
        product_name: 'Kopi Susu Gula Aren',
        category: 'Minuman',
        quantity_sold: 150,
        revenue_minor: 2700000000,
        percentage: 100,
      },
    ],
  };

  const sampleInventoryReport: InventoryReportViewModel = {
    categories: [
      {
        category: 'Minuman',
        sku_count: 5,
        quantity: 120,
        valuation_minor: 8600000000,
        cost_valuation_minor: 4500000000,
        percentage: 70,
        color: '#17593e',
      },
      {
        category: 'Makanan',
        sku_count: 3,
        quantity: 80,
        valuation_minor: 3900000000,
        cost_valuation_minor: 2000000000,
        percentage: 30,
        color: '#d3921f',
      },
    ],
    total_skus: 8,
    total_quantity: 200,
    valuation_minor: 12500000000,
    cost_valuation_minor: 6500000000,
  };

  const sampleProfitLoss: ProfitLossViewModel = {
    revenue_minor: 7328000000,
    hpp_minor: 4500000000,
    gross_profit_minor: 2828000000,
    gross_margin_percent: 38.6,
    operating_expense_minor: null,
    net_profit_minor: null,
    status: 'EXPENSE_UNAVAILABLE',
  };

  // ---------------------------------------------------------------------------
  // REPORTS-UI-001: Header Title and Subtitle
  // ---------------------------------------------------------------------------
  it('REPORTS-UI-001: renders main SectionHead title and subtitle', () => {
    const html = renderToString(<ReportsPage />);
    expect(html).toContain('Laporan &amp; Analisis');
    expect(html).toContain('Seluruh laporan dihitung langsung dari data transaksi, stok, dan pembukuan.');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-UI-002: Range Toggle
  // ---------------------------------------------------------------------------
  it('REPORTS-UI-002: renders 7 Hari and 30 Hari range toggle buttons', () => {
    const html = renderToString(<ReportsPage />);
    expect(html).toContain('7 Hari');
    expect(html).toContain('30 Hari');
    expect(html).toContain('data-testid="range-toggle"');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-UI-003: Omzet KPI Card
  // ---------------------------------------------------------------------------
  it('REPORTS-UI-003: renders Omzet KPI card with currency formatting', () => {
    const html = renderToString(<ReportsExecutiveKPICards kpi={sampleKPI} />);
    expect(html).toContain('Omzet');
    expect(html).toContain('Rp 7,33 M');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-UI-004: Laba Kotor KPI Card
  // ---------------------------------------------------------------------------
  it('REPORTS-UI-004: renders Laba Kotor KPI card with gross margin percent', () => {
    const html = renderToString(<ReportsExecutiveKPICards kpi={sampleKPI} />);
    expect(html).toContain('Laba Kotor');
    expect(html).toContain('Rp 2,83 M');
    expect(html).toContain('margin 39%');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-UI-005: Beban Operasional KPI Card
  // ---------------------------------------------------------------------------
  it('REPORTS-UI-005: renders Beban Operasional with controlled unavailable state when unbacked', () => {
    const html = renderToString(<ReportsExecutiveKPICards kpi={sampleKPI} />);
    expect(html).toContain('Beban Operasional');
    expect(html).toContain('Tidak Tersedia');
    expect(html).toContain('Buku beban belum terhubung');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-UI-006: Laba Bersih Highlight Card
  // ---------------------------------------------------------------------------
  it('REPORTS-UI-006: renders Laba Bersih card with pine highlight', () => {
    const html = renderToString(<ReportsExecutiveKPICards kpi={sampleKPI} />);
    expect(html).toContain('Laba Bersih');
    expect(html).toContain('Tidak Tersedia');
    expect(html).toContain('bg-pine-soft/40');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-UI-007: Cash Flow Chart
  // ---------------------------------------------------------------------------
  it('REPORTS-UI-007: renders Cash Flow pair bars chart with Kas Masuk and Kas Keluar legend', () => {
    const html = renderToString(<CashFlowChart points={sampleCashFlow} />);
    expect(html).toContain('Arus Kas Bulanan');
    expect(html).toContain('Kas Masuk');
    expect(html).toContain('Kas Keluar (Beban)');
    expect(html).toContain('20/8');
    expect(html).toContain('21/8');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-UI-008: Sales Composition Donut Chart
  // ---------------------------------------------------------------------------
  it('REPORTS-UI-008: renders Sales Composition donut chart with category list and percentages', () => {
    const html = renderToString(<SalesCompositionChart items={sampleComposition} />);
    expect(html).toContain('Komposisi Penjualan');
    expect(html).toContain('Minuman');
    expect(html).toContain('65');
    expect(html).toContain('Makanan');
    expect(html).toContain('35');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-UI-009: Six Tab Selector Cards
  // ---------------------------------------------------------------------------
  it('REPORTS-UI-009: renders all 6 report selector cards', () => {
    const html = renderToString(<ReportsTabSelector activeTab="penjualan" onTabChange={vi.fn()} />);
    expect(html).toContain('Penjualan');
    expect(html).toContain('Laba Rugi');
    expect(html).toContain('Stok &amp; Inventaris');
    expect(html).toContain('Pembelian');
    expect(html).toContain('Hutang Piutang');
    expect(html).toContain('Layanan Digital');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-UI-010: Active Tab Styling
  // ---------------------------------------------------------------------------
  it('REPORTS-UI-010: applies active highlight to the selected tab card', () => {
    const html = renderToString(<ReportsTabSelector activeTab="labarugi" onTabChange={vi.fn()} />);
    expect(html).toContain('bg-pine-deep');
    expect(html).toContain('data-testid="report-tab-labarugi"');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-UI-011: Penjualan Panel Transactions Table
  // ---------------------------------------------------------------------------
  it('REPORTS-UI-011: renders Penjualan transactions table with receipt columns', () => {
    const html = renderToString(
      <ReportsActivePanel
        activeTab="penjualan"
        range="30d"
        salesReport={sampleSalesReport}
        inventoryReport={sampleInventoryReport}
        profitLoss={sampleProfitLoss}
        isP1Tab={false}
        p1TabUnavailableMessage={null}
        onExportCsv={vi.fn()}
      />
    );
    expect(html).toContain('Penjualan');
    expect(html).toContain('TRX-1001');
    expect(html).toContain('Rani');
    expect(html).toContain('CASH');
    expect(html).toContain('Selesai');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-UI-012: Penjualan Panel Top 5 Products
  // ---------------------------------------------------------------------------
  it('REPORTS-UI-012: renders Penjualan right panel with Top 5 products', () => {
    const html = renderToString(
      <ReportsActivePanel
        activeTab="penjualan"
        range="30d"
        salesReport={sampleSalesReport}
        inventoryReport={sampleInventoryReport}
        profitLoss={sampleProfitLoss}
        isP1Tab={false}
        p1TabUnavailableMessage={null}
        onExportCsv={vi.fn()}
      />
    );
    expect(html).toContain('Produk Terlaris');
    expect(html).toContain('Kopi Susu Gula Aren');
    expect(html).toContain('Rp 2,7 M');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-UI-013: Laba Rugi Panel Breakdown
  // ---------------------------------------------------------------------------
  it('REPORTS-UI-013: renders formal Profit & Loss statement lines', () => {
    const html = renderToString(
      <ReportsActivePanel
        activeTab="labarugi"
        range="30d"
        salesReport={sampleSalesReport}
        inventoryReport={sampleInventoryReport}
        profitLoss={sampleProfitLoss}
        isP1Tab={false}
        p1TabUnavailableMessage={null}
        businessName="SKM Mart"
        onExportCsv={vi.fn()}
      />
    );
    expect(html).toContain('Laba Rugi');
    expect(html).toContain('Pendapatan Penjualan');
    expect(html).toContain('Harga Pokok Penjualan (HPP)');
    expect(html).toContain('Laba Kotor');
    expect(html).toContain('Beban Operasional');
    expect(html).toContain('Laba Bersih');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-UI-014: Stok Panel Valuasi per Kategori & Total
  // ---------------------------------------------------------------------------
  it('REPORTS-UI-014: renders Stok panel with category valuation list and total stock box', () => {
    const html = renderToString(
      <ReportsActivePanel
        activeTab="stok"
        range="30d"
        salesReport={sampleSalesReport}
        inventoryReport={sampleInventoryReport}
        profitLoss={sampleProfitLoss}
        isP1Tab={false}
        p1TabUnavailableMessage={null}
        onExportCsv={vi.fn()}
      />
    );
    expect(html).toContain('Stok &amp; Inventaris');
    expect(html).toContain('Valuasi per Kategori');
    expect(html).toContain('Total Nilai Stok');
    expect(html).toContain('SKU aktif');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-UI-015: Stok Panel SKU Table
  // ---------------------------------------------------------------------------
  it('REPORTS-UI-015: renders Stok SKU category summary table', () => {
    const html = renderToString(
      <ReportsActivePanel
        activeTab="stok"
        range="30d"
        salesReport={sampleSalesReport}
        inventoryReport={sampleInventoryReport}
        profitLoss={sampleProfitLoss}
        isP1Tab={false}
        p1TabUnavailableMessage={null}
        onExportCsv={vi.fn()}
      />
    );
    expect(html).toContain('Kategori');
    expect(html).toContain('Minuman');
    expect(html).toContain('SKU');
    expect(html).toContain('120');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-UI-016: P1 Unavailable Notices
  // ---------------------------------------------------------------------------
  it('REPORTS-UI-016: renders controlled pending notice on P1 tabs without mock figures', () => {
    const html = renderToString(
      <ReportsActivePanel
        activeTab="pembelian"
        range="30d"
        salesReport={sampleSalesReport}
        inventoryReport={sampleInventoryReport}
        profitLoss={sampleProfitLoss}
        isP1Tab={true}
        p1TabUnavailableMessage="Modul Pembelian & PO Supplier belum memiliki data canonical backend."
        onExportCsv={vi.fn()}
      />
    );
    expect(html).toContain('Modul Belum Terhubung ke Canonical DB');
    expect(html).toContain('Modul Pembelian &amp; PO Supplier belum memiliki data canonical backend.');
    expect(html).toContain('Terkontrol Pending (No Synthetic Mocks)');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-UI-017: Unduh CSV Button
  // ---------------------------------------------------------------------------
  it('REPORTS-UI-017: renders Unduh CSV action button on active panel', () => {
    const html = renderToString(
      <ReportsActivePanel
        activeTab="penjualan"
        range="30d"
        salesReport={sampleSalesReport}
        inventoryReport={sampleInventoryReport}
        profitLoss={sampleProfitLoss}
        isP1Tab={false}
        p1TabUnavailableMessage={null}
        onExportCsv={vi.fn()}
      />
    );
    expect(html).toContain('Unduh CSV');
    expect(html).toContain('data-testid="export-csv-button"');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-UI-018: Footer Notice Banner
  // ---------------------------------------------------------------------------
  it('REPORTS-UI-018: renders footer notice banner regarding real-time synchronization', () => {
    const html = renderToString(<ReportsPage />);
    expect(html).toContain(
      'Laporan laba rugi &amp; valuasi stok diperbarui otomatis saat ada transaksi kasir, penerimaan PO, atau penyesuaian stok.'
    );
  });

  // ---------------------------------------------------------------------------
  // REPORTS-UI-019: Empty State Rendering
  // ---------------------------------------------------------------------------
  it('REPORTS-UI-019: renders graceful empty state when transactions list is empty', () => {
    const emptySalesReport: SalesReportViewModel = {
      summary: {
        total_sales: 0,
        total_revenue_minor: 0,
        total_items_sold: 0,
        average_order_value_minor: 0,
        payment_methods: [],
      },
      transactions: [],
      top_products: [],
    };
    const html = renderToString(
      <ReportsActivePanel
        activeTab="penjualan"
        range="30d"
        salesReport={emptySalesReport}
        inventoryReport={sampleInventoryReport}
        profitLoss={sampleProfitLoss}
        isP1Tab={false}
        p1TabUnavailableMessage={null}
        onExportCsv={vi.fn()}
      />
    );
    expect(html).toContain('Belum ada struk transaksi untuk periode ini.');
  });

  // ---------------------------------------------------------------------------
  // REPORTS-UI-020: Dynamic Calculation Proof (No Hardcoded Metrics)
  // ---------------------------------------------------------------------------
  it('REPORTS-UI-020: ensures all values reflect dynamic inputs rather than hardcoded mock fixtures', () => {
    const dynamicKPI: ReportsExecutiveKPI = {
      revenue_minor: 99900000,
      gross_profit_minor: 45000000,
      gross_margin_percent: 45.0,
      operating_expense_minor: null,
      net_profit_minor: null,
    };
    const html = renderToString(<ReportsExecutiveKPICards kpi={dynamicKPI} />);
    expect(html).toContain('Rp 99,9 jt');
    expect(html).toContain('Rp 45 jt');
    expect(html).toContain('margin 45%');
  });
});
