import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { AgingSummaryCards } from '../components/AgingSummaryCards';
import { ReceivablesAgingTable } from '../components/ReceivablesAgingTable';
import { PayablesAgingTable } from '../components/PayablesAgingTable';
import { DebtAuditHistoryModal } from '../components/DebtAuditHistoryModal';
import { DebtSettlementModal } from '../components/DebtSettlementModal';
import { getAgingBucket, getAgingBucketLabel } from '../api';
import type { ReceivableItem, PayableItem } from '../types';

describe('AR / AP Aging & Debt Management UI Tests (Gate G-4)', () => {
  const fixedNow = new Date('2026-09-05T00:00:00.000Z');

  const mockReceivables: ReceivableItem[] = [
    {
      id: 'recv-1111-aaaa',
      business_id: 'biz-1',
      customer_id: 'cust-1',
      customer_name: 'PT Maju Bersama',
      sale_id: 'sale-1',
      total_minor: 5000000,
      paid_minor: 2000000,
      outstanding_minor: 3000000,
      status: 'PARTIAL',
      due_date: '2026-08-25', // 11 days overdue -> 0-30 bucket
      created_at: '2026-08-01T00:00:00.000Z',
    },
    {
      id: 'recv-2222-bbbb',
      business_id: 'biz-1',
      customer_id: 'cust-2',
      customer_name: 'Toko Sumber Rejeki',
      sale_id: 'sale-2',
      total_minor: 10000000,
      paid_minor: 0,
      outstanding_minor: 10000000,
      status: 'OPEN',
      due_date: '2026-07-20', // 47 days overdue -> 31-60 bucket
      created_at: '2026-07-01T00:00:00.000Z',
    },
    {
      id: 'recv-3333-cccc',
      business_id: 'biz-1',
      customer_id: 'cust-3',
      customer_name: 'CV Berkah Sentosa',
      sale_id: 'sale-3',
      total_minor: 7500000,
      paid_minor: 0,
      outstanding_minor: 7500000,
      status: 'OPEN',
      due_date: '2026-06-25', // 72 days overdue -> 61-90 bucket
      created_at: '2026-06-01T00:00:00.000Z',
    },
    {
      id: 'recv-4444-dddd',
      business_id: 'biz-1',
      customer_id: 'cust-4',
      customer_name: 'UD Prima Abadi',
      sale_id: 'sale-4',
      total_minor: 12000000,
      paid_minor: 0,
      outstanding_minor: 12000000,
      status: 'OPEN',
      due_date: '2026-05-01', // 127 days overdue -> >90 bucket
      created_at: '2026-04-15T00:00:00.000Z',
    },
  ];

  const mockPayables: PayableItem[] = [
    {
      id: 'po-1111-aaaa',
      business_id: 'biz-1',
      supplier_id: 'supp-1',
      supplier_name: 'PT Distributor Utama',
      code: 'PO-2026-001',
      date: '2026-08-15',
      due_date: '2026-08-30', // 6 days overdue -> 0-30 bucket
      supplier_term: 'Tempo 14',
      status: 'received',
      total_minor: 8000000,
      paid_minor: 3000000,
      outstanding_minor: 5000000,
      received_minor: 8000000,
      server_version: 1,
    },
    {
      id: 'po-2222-bbbb',
      business_id: 'biz-1',
      supplier_id: 'supp-2',
      supplier_name: 'CV Pangan Nusantara',
      code: 'PO-2026-002',
      date: '2026-07-05',
      due_date: '2026-07-20', // 47 days overdue -> 31-60 bucket
      supplier_term: 'Tempo 30',
      status: 'received',
      total_minor: 15000000,
      paid_minor: 0,
      outstanding_minor: 15000000,
      received_minor: 15000000,
      server_version: 1,
    },
    {
      id: 'po-3333-cccc',
      business_id: 'biz-1',
      supplier_id: 'supp-3',
      supplier_name: 'PT Kemasan Bersaudara',
      code: 'PO-2026-003',
      date: '2026-06-10',
      due_date: '2026-06-25', // 72 days overdue -> 61-90 bucket
      supplier_term: 'Tempo 14',
      status: 'received',
      total_minor: 4000000,
      paid_minor: 0,
      outstanding_minor: 4000000,
      received_minor: 4000000,
      server_version: 1,
    },
    {
      id: 'po-4444-dddd',
      business_id: 'biz-1',
      supplier_id: 'supp-4',
      supplier_name: 'Pabrik Minyak Jaya',
      code: 'PO-2026-004',
      date: '2026-04-10',
      due_date: '2026-05-10', // 118 days overdue -> >90 bucket
      supplier_term: 'Tempo 30',
      status: 'received',
      total_minor: 20000000,
      paid_minor: 0,
      outstanding_minor: 20000000,
      received_minor: 20000000,
      server_version: 1,
    },
  ];

  describe('AGING: Bucket calculation & classification', () => {
    it('FIN-AGE-001: Correctly calculates 0-30, 31-60, 61-90, and >90 buckets', () => {
      // 0-30 days
      expect(getAgingBucket('2026-08-25', fixedNow)).toBe('0-30');
      expect(getAgingBucket('2026-09-01', fixedNow)).toBe('0-30');
      expect(getAgingBucket('2026-09-10', fixedNow)).toBe('0-30'); // Future / not yet due

      // 31-60 days
      expect(getAgingBucket('2026-07-20', fixedNow)).toBe('31-60');
      expect(getAgingBucket('2026-07-10', fixedNow)).toBe('31-60');

      // 61-90 days
      expect(getAgingBucket('2026-06-25', fixedNow)).toBe('61-90');
      expect(getAgingBucket('2026-06-10', fixedNow)).toBe('61-90');

      // >90 days
      expect(getAgingBucket('2026-05-01', fixedNow)).toBe('>90');
      expect(getAgingBucket('2026-01-01', fixedNow)).toBe('>90');
    });

    it('FIN-AGE-002: Formats canonical Indonesian bucket labels', () => {
      expect(getAgingBucketLabel('0-30')).toBe('Current / 0–30 Hari');
      expect(getAgingBucketLabel('31-60')).toBe('31–60 Hari');
      expect(getAgingBucketLabel('61-90')).toBe('61–90 Hari');
      expect(getAgingBucketLabel('>90')).toBe('>90 Hari Terlambat');
    });

    it('FIN-AGE-003: AgingSummaryCards renders all buckets and total outstanding', () => {
      const html = renderToString(
        <AgingSummaryCards
          title="Ringkasan Umur Piutang Pelanggan (AR Aging)"
          items={mockReceivables}
          asOfDate={fixedNow}
        />
      );

      // Verify title & buckets
      expect(html).toContain('Ringkasan Umur Piutang Pelanggan (AR Aging)');
      expect(html).toContain('Total Outstanding');
      expect(html).toContain('Current / 0–30 Hari');
      expect(html).toContain('31–60 Hari');
      expect(html).toContain('61–90 Hari');
      expect(html).toContain('&gt;90 Hari Terlambat');

      // Total = 3M + 10M + 7.5M + 12M = 32.5M
      expect(html).toContain('32.500.000');
    });
  });

  describe('AR: ReceivablesAgingTable & collection management', () => {
    it('FIN-AR-001: Renders customer names, reference IDs, due dates, and outstanding balances', () => {
      const html = renderToString(
        <ReceivablesAgingTable
          receivables={mockReceivables}
          isLoading={false}
          role="OWNER"
          onOpenSettlement={() => {}}
          onOpenHistory={() => {}}
          asOfDate={fixedNow}
        />
      );

      expect(html).toContain('PT Maju Bersama');
      expect(html).toContain('Toko Sumber Rejeki');
      expect(html).toContain('CV Berkah Sentosa');
      expect(html).toContain('UD Prima Abadi');

      expect(html).toContain('recv-111');
      expect(html).toContain('2026-08-25');
      expect(html).toContain('3.000.000');
      expect(html).toContain('10.000.000');
      expect(html).toContain('Current / 0–30 Hari');
      expect(html).toContain('31–60 Hari');
      expect(html).toContain('61–90 Hari');
      expect(html).toContain('&gt;90 Hari Terlambat');
    });

    it('FIN-AR-002: Shows collection action button for OWNER, STAFF, and CASHIER', () => {
      const ownerHtml = renderToString(
        <ReceivablesAgingTable
          receivables={mockReceivables}
          isLoading={false}
          role="OWNER"
          onOpenSettlement={() => {}}
          onOpenHistory={() => {}}
          asOfDate={fixedNow}
        />
      );
      expect(ownerHtml).toContain('Terima Pembayaran');

      const staffHtml = renderToString(
        <ReceivablesAgingTable
          receivables={mockReceivables}
          isLoading={false}
          role="STAFF"
          onOpenSettlement={() => {}}
          onOpenHistory={() => {}}
          asOfDate={fixedNow}
        />
      );
      expect(staffHtml).toContain('Terima Pembayaran');

      const cashierHtml = renderToString(
        <ReceivablesAgingTable
          receivables={mockReceivables}
          isLoading={false}
          role="CASHIER"
          onOpenSettlement={() => {}}
          onOpenHistory={() => {}}
          asOfDate={fixedNow}
        />
      );
      expect(cashierHtml).toContain('Terima Pembayaran');
    });

    it('FIN-AR-003: Shows empty state when no receivables exist', () => {
      const html = renderToString(
        <ReceivablesAgingTable
          receivables={[]}
          isLoading={false}
          role="OWNER"
          onOpenSettlement={() => {}}
          onOpenHistory={() => {}}
          asOfDate={fixedNow}
        />
      );

      expect(html).toContain('Tidak ada catatan piutang ditemukan.');
    });
  });

  describe('AP: PayablesAgingTable & supplier settlement controls', () => {
    it('FIN-AP-001: Renders supplier names, PO codes, terms, and outstanding balances', () => {
      const html = renderToString(
        <PayablesAgingTable
          payables={mockPayables}
          isLoading={false}
          role="OWNER"
          onOpenSettlement={() => {}}
          onOpenHistory={() => {}}
          asOfDate={fixedNow}
        />
      );

      expect(html).toContain('PT Distributor Utama');
      expect(html).toContain('CV Pangan Nusantara');
      expect(html).toContain('PO-2026-001');
      expect(html).toContain('Tempo 14');
      expect(html).toContain('5.000.000');
      expect(html).toContain('15.000.000');
    });

    it('FIN-AP-002: Shows settlement action for OWNER and STAFF', () => {
      const ownerHtml = renderToString(
        <PayablesAgingTable
          payables={mockPayables}
          isLoading={false}
          role="OWNER"
          onOpenSettlement={() => {}}
          onOpenHistory={() => {}}
          asOfDate={fixedNow}
        />
      );
      expect(ownerHtml).toContain('Lunasi Tagihan');

      const staffHtml = renderToString(
        <PayablesAgingTable
          payables={mockPayables}
          isLoading={false}
          role="STAFF"
          onOpenSettlement={() => {}}
          onOpenHistory={() => {}}
          asOfDate={fixedNow}
        />
      );
      expect(staffHtml).toContain('Lunasi Tagihan');
    });

    it('FIN-AP-003: STRICTLY HIDES settlement action for CASHIER role', () => {
      const cashierHtml = renderToString(
        <PayablesAgingTable
          payables={mockPayables}
          isLoading={false}
          role="CASHIER"
          onOpenSettlement={() => {}}
          onOpenHistory={() => {}}
          asOfDate={fixedNow}
        />
      );

      expect(cashierHtml).not.toContain('Lunasi Tagihan');
      // CASHIER still has Riwayat button to view status
      expect(cashierHtml).toContain('Riwayat');
    });
  });

  describe('MODALS: DebtSettlementModal & DebtAuditHistoryModal', () => {
    it('FIN-MDL-001: DebtSettlementModal renders maximum payable limit and payment methods', () => {
      const html = renderToString(
        <DebtSettlementModal
          open={true}
          kind="piutang"
          item={mockReceivables[0]}
          onClose={() => {}}
          onSettleReceivable={async () => {}}
          onSettlePayable={async () => {}}
          isSaving={false}
        />
      );

      expect(html).toContain('Terima Pembayaran Piutang');
      expect(html).toContain('PT Maju Bersama');
      expect(html).toContain('Metode Pembayaran');
      expect(html).toContain('Kas Tunai');
      expect(html).toContain('Transfer Bank');
      expect(html).toContain('Kartu Debit');
      expect(html).toContain('Nomor Referensi / Catatan (Opsional)');
    });

    it('FIN-MDL-002: DebtAuditHistoryModal renders party metadata and audit container', () => {
      const html = renderToString(
        <DebtAuditHistoryModal
          open={true}
          kind="hutang"
          item={mockPayables[0]}
          onClose={() => {}}
        />
      );

      expect(html).toContain('Riwayat Pembayaran Hutang');
      expect(html).toContain('PT Distributor Utama');
      expect(html).toContain('PO-2026-001');
      expect(html).toContain('Total Tagihan');
      expect(html).toContain('Sisa Outstanding');
    });
  });

  describe('TENANT & ISOLATION: Context verification', () => {
    it('FIN-ISO-001: Does not expose or require manual client-side business_id overrides in components', () => {
      const html = renderToString(
        <ReceivablesAgingTable
          receivables={mockReceivables}
          isLoading={false}
          role="OWNER"
          onOpenSettlement={() => {}}
          onOpenHistory={() => {}}
          asOfDate={fixedNow}
        />
      );

      // Verify no input field for business_id
      expect(html).not.toContain('name="business_id"');
      expect(html).not.toContain('input name="tenant_id"');
    });
  });
});
