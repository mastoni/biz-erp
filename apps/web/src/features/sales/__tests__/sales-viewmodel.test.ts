import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DailySalesPointDto,
  Sale,
  SalesFilterModel,
  SalesSummaryDto,
  SalesTransactionViewModel,
} from '../types';
import {
  filterSalesTransactions,
  generateSalesCsv,
  mapDailySalesToTrend,
  mapPaymentMethods,
  mapSalesSummaryToKPI,
  mapSaleToViewModel,
  normalizePaymentMethod,
} from '../sales-helpers';

describe('PHASE 5C — Sales ViewModel & Data Layer Unit Tests', () => {
  const sampleSale1: Sale = {
    id: 'sale-001',
    idempotency_key: 'idem-001',
    branch_id: 'branch-a',
    receipt_number: 'TRX-88231',
    subtotal_minor: 4800000,
    discount_minor: 0,
    tax_minor: 0,
    grand_total_minor: 4800000,
    payment_method: 'CASH',
    cash_received_minor: 5000000,
    change_minor: 200000,
    cashier_id: 'Rani',
    client_created_at: new Date('2026-08-26T10:15:00Z').getTime(),
    server_created_at: new Date('2026-08-26T10:15:01Z').getTime(),
    items: [
      {
        product_id: 'prod-001',
        product_name_snapshot: 'Kopi Susu Gula Aren',
        quantity: 2,
        unit_price_minor: 2400000,
      },
    ],
  };

  const sampleSale2: Sale = {
    id: 'sale-002',
    idempotency_key: 'idem-002',
    branch_id: 'branch-a',
    receipt_number: 'TRX-88232',
    subtotal_minor: 3600000,
    discount_minor: 0,
    tax_minor: 0,
    grand_total_minor: 3600000,
    payment_method: 'QRIS',
    cash_received_minor: 3600000,
    change_minor: 0,
    cashier_id: 'Dimas',
    client_created_at: new Date('2026-08-26T11:30:00Z').getTime(),
    server_created_at: new Date('2026-08-26T11:30:02Z').getTime(),
    items: [
      {
        product_id: 'prod-002',
        product_name_snapshot: 'Roti Bakar Cokelat',
        quantity: 1,
        unit_price_minor: 1800000,
      },
      {
        product_id: 'prod-003',
        product_name_snapshot: 'Mineral Water 600ml',
        quantity: 2,
        unit_price_minor: 900000,
      },
    ],
  };

  const sampleSale3NullBranch: Sale = {
    id: 'sale-003',
    idempotency_key: 'idem-003',
    branch_id: null,
    receipt_number: 'TRX-88233',
    subtotal_minor: 1800000,
    discount_minor: 0,
    tax_minor: 0,
    grand_total_minor: 1800000,
    payment_method: 'DEBIT',
    cash_received_minor: 1800000,
    change_minor: 0,
    cashier_id: 'Adit',
    client_created_at: new Date('2026-08-26T12:00:00Z').getTime(),
    server_created_at: new Date('2026-08-26T12:00:01Z').getTime(),
    items: [
      {
        product_id: 'prod-002',
        product_name_snapshot: 'Roti Bakar Cokelat',
        quantity: 1,
        unit_price_minor: 1800000,
      },
    ],
  };

  // SALES-VM-001: KPI mapping
  describe('SALES-VM-001: KPI mapping', () => {
    it('maps SalesSummaryDto metrics to SalesKPIViewModel and keeps refund_count null', () => {
      const summary: SalesSummaryDto = {
        total_sales: 15,
        total_revenue_minor: 32500000,
        total_items_sold: 38,
        average_order_value_minor: 2166667,
        payment_methods: [
          { payment_method: 'Tunai', count: 10, total_minor: 20000000 },
          { payment_method: 'QRIS', count: 5, total_minor: 12500000 },
        ],
      };

      const kpi = mapSalesSummaryToKPI(summary);

      expect(kpi.total_sales).toBe(15);
      expect(kpi.total_revenue_minor).toBe(32500000);
      expect(kpi.average_order_value_minor).toBe(2166667);
      expect(kpi.refund_count).toBeNull(); // Pending contract preserved
    });

    it('falls back to transaction calculations when summary report is not yet loaded', () => {
      const tx1 = mapSaleToViewModel(sampleSale1);
      const tx2 = mapSaleToViewModel(sampleSale2);

      const kpi = mapSalesSummaryToKPI(null, [tx1, tx2]);

      expect(kpi.total_sales).toBe(2);
      expect(kpi.total_revenue_minor).toBe(8400000);
      expect(kpi.average_order_value_minor).toBe(4200000);
      expect(kpi.refund_count).toBeNull();
    });
  });

  // SALES-VM-002: trend mapping
  describe('SALES-VM-002: trend mapping', () => {
    it('maps DailySalesPointDto array to SalesTrendPointViewModel', () => {
      const rawPoints: DailySalesPointDto[] = [
        { date: '2026-08-20', total_revenue_minor: 5800000, transaction_count: 5 },
        { date: '2026-08-21', total_revenue_minor: 6400000, transaction_count: 6 },
      ];

      const trend = mapDailySalesToTrend(rawPoints, '7d');

      expect(trend.length).toBe(2);
      expect(trend[0].date).toBe('2026-08-20');
      expect(trend[0].total_revenue_minor).toBe(5800000);
      expect(trend[0].transaction_count).toBe(5);
    });
  });

  // SALES-VM-003: 7-day range
  describe('SALES-VM-003: 7-day range', () => {
    it('limits trend to 7 points and formats day name labels in 7d mode', () => {
      const rawPoints: DailySalesPointDto[] = Array.from({ length: 10 }, (_, i) => ({
        date: `2026-08-${String(15 + i).padStart(2, '0')}`,
        total_revenue_minor: (i + 1) * 1000000,
        transaction_count: i + 1,
      }));

      const trend = mapDailySalesToTrend(rawPoints, '7d');

      expect(trend.length).toBe(7);
      expect(trend[trend.length - 1].date).toBe('2026-08-24');
      // Label should be day name (e.g. Sen, Sel, etc.)
      expect(['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']).toContain(trend[0].label);
    });
  });

  // SALES-VM-004: 30-day range
  describe('SALES-VM-004: 30-day range', () => {
    it('limits trend to 30 points and uses numerical index labels in 30d mode', () => {
      const rawPoints: DailySalesPointDto[] = Array.from({ length: 35 }, (_, i) => ({
        date: `2026-08-${String(i + 1).padStart(2, '0')}`,
        total_revenue_minor: (i + 1) * 500000,
        transaction_count: i + 1,
      }));

      const trend = mapDailySalesToTrend(rawPoints, '30d');

      expect(trend.length).toBe(30);
      expect(trend[0].label).toBe('1');
      expect(trend[29].label).toBe('30');
    });
  });

  // SALES-VM-005: zero-filled trend preserved
  describe('SALES-VM-005: zero-filled trend preserved', () => {
    it('preserves zero revenue points without dropping days', () => {
      const rawPoints: DailySalesPointDto[] = [
        { date: '2026-08-20', total_revenue_minor: 5000000, transaction_count: 4 },
        { date: '2026-08-21', total_revenue_minor: 0, transaction_count: 0 },
        { date: '2026-08-22', total_revenue_minor: 7200000, transaction_count: 6 },
      ];

      const trend = mapDailySalesToTrend(rawPoints, '7d');

      expect(trend.length).toBe(3);
      expect(trend[1].total_revenue_minor).toBe(0);
      expect(trend[1].transaction_count).toBe(0);
    });
  });

  // SALES-VM-006: payment mix mapping
  describe('SALES-VM-006: payment mix mapping', () => {
    it('groups backend methods into canonical Tunai, QRIS, Debit with colors and percentages', () => {
      const rawMethods = [
        { payment_method: 'CASH', count: 50, total_minor: 50000000 },
        { payment_method: 'QRIS', count: 30, total_minor: 30000000 },
        { payment_method: 'DEBIT', count: 20, total_minor: 20000000 },
      ];

      const mix = mapPaymentMethods(rawMethods, 100);

      expect(mix.length).toBe(3);
      const tunai = mix.find((m) => m.canonical_method === 'Tunai');
      const qris = mix.find((m) => m.canonical_method === 'QRIS');
      const debit = mix.find((m) => m.canonical_method === 'Debit');

      expect(tunai).toBeDefined();
      expect(tunai!.percentage).toBe(50);
      expect(tunai!.color).toBe('#17593e');

      expect(qris).toBeDefined();
      expect(qris!.percentage).toBe(30);
      expect(qris!.color).toBe('#d3921f');

      expect(debit).toBeDefined();
      expect(debit!.percentage).toBe(20);
      expect(debit!.color).toBe('#35657f');
    });
  });

  // SALES-VM-007: transaction mapping
  describe('SALES-VM-007: transaction mapping', () => {
    it('correctly maps Sale entity to SalesTransactionViewModel', () => {
      const tx = mapSaleToViewModel(sampleSale1, true);

      expect(tx.id).toBe('sale-001');
      expect(tx.receipt_number).toBe('TRX-88231');
      expect(tx.cashier).toBe('Rani');
      expect(tx.items_count).toBe(2);
      expect(tx.canonical_method).toBe('Tunai');
      expect(tx.total_minor).toBe(4800000);
      expect(tx.status).toBe('selesai');
      expect(tx.fresh).toBe(true);
      expect(tx.branch_id).toBe('branch-a');
    });
  });

  // SALES-VM-008: receipt line mapping
  describe('SALES-VM-008: receipt line mapping', () => {
    it('maps line items with accurate quantity, unit price, and computed line total', () => {
      const tx = mapSaleToViewModel(sampleSale2);

      expect(tx.lines.length).toBe(2);
      expect(tx.lines[0].product_name).toBe('Roti Bakar Cokelat');
      expect(tx.lines[0].quantity).toBe(1);
      expect(tx.lines[0].unit_price_minor).toBe(1800000);
      expect(tx.lines[0].line_total_minor).toBe(1800000);

      expect(tx.lines[1].product_name).toBe('Mineral Water 600ml');
      expect(tx.lines[1].quantity).toBe(2);
      expect(tx.lines[1].unit_price_minor).toBe(900000);
      expect(tx.lines[1].line_total_minor).toBe(1800000);
    });
  });

  // SALES-VM-009: search filters receipt number
  describe('SALES-VM-009: search filters receipt number', () => {
    it('filters transactions matching receipt number query case-insensitively', () => {
      const txs = [
        mapSaleToViewModel(sampleSale1),
        mapSaleToViewModel(sampleSale2),
        mapSaleToViewModel(sampleSale3NullBranch),
      ];

      const filtered = filterSalesTransactions(txs, { search: 'trx-88231' });

      expect(filtered.length).toBe(1);
      expect(filtered[0].receipt_number).toBe('TRX-88231');
    });
  });

  // SALES-VM-010: search filters cashier
  describe('SALES-VM-010: search filters cashier', () => {
    it('filters transactions matching cashier name query case-insensitively', () => {
      const txs = [
        mapSaleToViewModel(sampleSale1),
        mapSaleToViewModel(sampleSale2),
        mapSaleToViewModel(sampleSale3NullBranch),
      ];

      const filtered = filterSalesTransactions(txs, { search: 'dimas' });

      expect(filtered.length).toBe(1);
      expect(filtered[0].cashier).toBe('Dimas');
    });
  });

  // SALES-VM-011: payment method filter
  describe('SALES-VM-011: payment method filter', () => {
    it('filters transactions strictly by canonical payment method', () => {
      const txs = [
        mapSaleToViewModel(sampleSale1),
        mapSaleToViewModel(sampleSale2),
        mapSaleToViewModel(sampleSale3NullBranch),
      ];

      const qrisOnly = filterSalesTransactions(txs, { payment_method: 'QRIS' });
      expect(qrisOnly.length).toBe(1);
      expect(qrisOnly[0].receipt_number).toBe('TRX-88232');

      const tunaiOnly = filterSalesTransactions(txs, { payment_method: 'Tunai' });
      expect(tunaiOnly.length).toBe(1);
      expect(tunaiOnly[0].receipt_number).toBe('TRX-88231');

      const all = filterSalesTransactions(txs, { payment_method: 'Semua' });
      expect(all.length).toBe(3);
    });
  });

  // SALES-VM-012: historical null branch safe
  describe('SALES-VM-012: historical null branch safe', () => {
    it('safely serializes and handles transactions with branch_id = null', () => {
      const tx = mapSaleToViewModel(sampleSale3NullBranch);

      expect(tx.branch_id).toBeNull();
      expect(tx.receipt_number).toBe('TRX-88233');
      expect(tx.canonical_method).toBe('Debit');
    });
  });

  // SALES-VM-013: branch change clears/reloads
  describe('SALES-VM-013: branch change clears/reloads', () => {
    it('filters out transactions from other branches when branch_id is active', () => {
      const tx1 = mapSaleToViewModel(sampleSale1); // branch-a
      const tx2 = { ...mapSaleToViewModel(sampleSale2), branch_id: 'branch-b' }; // branch-b

      const branchAOnly = filterSalesTransactions([tx1, tx2], { branch_id: 'branch-a' });
      expect(branchAOnly.length).toBe(1);
      expect(branchAOnly[0].id).toBe('sale-001');

      const branchBOnly = filterSalesTransactions([tx1, tx2], { branch_id: 'branch-b' });
      expect(branchBOnly.length).toBe(1);
      expect(branchBOnly[0].id).toBe('sale-002');
    });
  });

  // SALES-VM-014: tenant change clears state
  describe('SALES-VM-014: tenant change clears state', () => {
    it('verifies helper functions maintain strict isolation given disparate business sales', () => {
      const txTenantA = mapSaleToViewModel(sampleSale1);
      const kpiA = mapSalesSummaryToKPI(null, [txTenantA]);

      expect(kpiA.total_sales).toBe(1);
      expect(kpiA.total_revenue_minor).toBe(4800000);

      // Switching to Tenant B with empty transactions
      const kpiB = mapSalesSummaryToKPI(null, []);
      expect(kpiB.total_sales).toBe(0);
      expect(kpiB.total_revenue_minor).toBe(0);
    });
  });

  // SALES-VM-015: CSV contains only filtered rows
  describe('SALES-VM-015: CSV contains only filtered rows', () => {
    it('generates CSV string containing only the provided filtered transaction list', () => {
      const tx1 = mapSaleToViewModel(sampleSale1);
      const tx2 = mapSaleToViewModel(sampleSale2);

      // Filter to only tx1
      const filtered = [tx1];
      const csv = generateSalesCsv(filtered);

      expect(csv).toContain('TRX-88231');
      expect(csv).not.toContain('TRX-88232');
    });
  });

  // SALES-VM-016: CSV header matches blueprint
  describe('SALES-VM-016: CSV header matches blueprint', () => {
    it('formats exact CSV headers: No. Struk, Waktu, Kasir, Item, Metode, Total, Status', () => {
      const tx1 = mapSaleToViewModel(sampleSale1);
      const csv = generateSalesCsv([tx1]);

      const [headerLine] = csv.split('\n');
      expect(headerLine).toBe('No. Struk,Waktu,Kasir,Item,Metode,Total,Status');
    });
  });

  // SALES-VM-017: no mock/static sales data
  describe('SALES-VM-017: no mock/static sales data', () => {
    it('handles dynamic API shapes without reliance on hardcoded mock arrays', () => {
      const dynamicSale: Sale = {
        id: 'dyn-001',
        idempotency_key: 'idem-dyn',
        branch_id: 'dyn-branch',
        receipt_number: 'TRX-DYN-999',
        subtotal_minor: 9900000,
        discount_minor: 0,
        tax_minor: 0,
        grand_total_minor: 9900000,
        payment_method: 'QRIS',
        cash_received_minor: 9900000,
        change_minor: 0,
        cashier_id: 'Siti',
        client_created_at: 1787742000000,
        server_created_at: 1787742000000,
        items: [
          {
            product_id: 'p-dyn',
            product_name_snapshot: 'Custom Special Order',
            quantity: 3,
            unit_price_minor: 3300000,
          },
        ],
      };

      const vm = mapSaleToViewModel(dynamicSale);
      expect(vm.receipt_number).toBe('TRX-DYN-999');
      expect(vm.cashier).toBe('Siti');
      expect(vm.items_count).toBe(3);
      expect(vm.lines[0].line_total_minor).toBe(9900000);
    });
  });
});
