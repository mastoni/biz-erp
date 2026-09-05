/**
 * Phase 4.1.40H — G-6 Web ERP Native Recurring Customer Billing UI Test Suite
 * BILLING-UI-001 through BILLING-UI-025
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { BillingKPICards } from '../components/BillingKPICards';
import { SubscriptionTable } from '../components/SubscriptionTable';
import { SubscriptionDetailView } from '../components/SubscriptionDetailView';
import { SubscriptionCreateModal } from '../components/SubscriptionCreateModal';
import { SubscriptionPriceModal } from '../components/SubscriptionPriceModal';
import { SubscriptionActionModal } from '../components/SubscriptionActionModal';
import { GenerateInvoiceModal } from '../components/GenerateInvoiceModal';
import { InvoiceTable } from '../components/InvoiceTable';
import { InvoiceDetailView } from '../components/InvoiceDetailView';
import { InvoicePaymentModal } from '../components/InvoicePaymentModal';
import { InvoiceCancelModal } from '../components/InvoiceCancelModal';
import { SubscriptionStatusPill } from '../components/SubscriptionStatusPill';
import { InvoiceStatusPill } from '../components/InvoiceStatusPill';
import { BillingCyclePill } from '../components/BillingCyclePill';
import { getBillingApiErrorMessage } from '../api';
import { ROUTE_PERMISSIONS, NAVIGATION_ITEMS, canAccessRoute } from '@/lib/rbac';
import type {
  CustomerSubscriptionDto,
  CustomerSubscriptionDetailDto,
  CustomerInvoiceDto,
  CustomerInvoiceDetailDto,
  BillingDashboardKPI,
} from '../types';

describe('PHASE 4.1.40H — G-6 Web ERP Native Recurring Customer Billing UI Acceptance Tests', () => {
  const sampleKPI: BillingDashboardKPI = {
    activeSubscriptionsCount: 42,
    pausedSubscriptionsCount: 3,
    totalSubscriptionsCount: 45,
    monthlyRecurringRevenueMinor: 1250000000, // Rp 12.500.000
    upcomingBillingCount: 8,
    upcomingBillingAmountMinor: 240000000,   // Rp 2.400.000
    overdueInvoicesCount: 2,
    overdueInvoicesAmountMinor: 60000000,    // Rp 600.000
    totalOutstandingReceivablesMinor: 850000000, // Rp 8.500.000
    totalPaidThisMonthMinor: 1100000000,     // Rp 11.000.000
  };

  const sampleSubscriptions: CustomerSubscriptionDto[] = [
    {
      id: 'sub-11111111-1111-4111-8111-111111111111',
      business_id: 'biz-001',
      customer_id: 'cst-11111111-1111-4111-8111-111111111111',
      customer_name: 'PT Maju Bersama',
      plan_code: 'INTERNET_100M',
      product_id: null,
      name: 'Internet Dedicated 100 Mbps',
      unit_price_minor: 30000000, // Rp 300.000
      discount_minor: 0,
      tax_minor: 3300000,         // Rp 33.000
      total_minor: 33300000,      // Rp 333.000
      currency: 'IDR',
      billing_cycle: 'MONTHLY',
      status: 'ACTIVE',
      starts_at: '2026-09-01T00:00:00Z',
      ends_at: null,
      next_billing_date: '2026-10-01',
      anchor_day: 1,
      notes: 'Paket kantor utama',
      metadata: {},
      created_at: '2026-09-01T08:00:00Z',
      updated_at: '2026-09-01T08:00:00Z',
    },
    {
      id: 'sub-22222222-2222-4222-8222-222222222222',
      business_id: 'biz-001',
      customer_id: 'cst-22222222-2222-4222-8222-222222222222',
      customer_name: 'Budi Santoso',
      plan_code: 'HOME_50M',
      product_id: null,
      name: 'Home Fiber 50 Mbps',
      unit_price_minor: 25000000, // Rp 250.000
      discount_minor: 5000000,    // Rp 50.000
      tax_minor: 2200000,         // Rp 22.000
      total_minor: 22200000,      // Rp 222.000
      currency: 'IDR',
      billing_cycle: 'QUARTERLY',
      status: 'PAUSED',
      starts_at: '2026-08-01T00:00:00Z',
      ends_at: null,
      next_billing_date: '2026-11-01',
      anchor_day: 1,
      notes: 'Cuti sementara',
      metadata: {},
      created_at: '2026-08-01T08:00:00Z',
      updated_at: '2026-09-01T08:00:00Z',
    },
  ];

  const sampleSubscriptionDetail: CustomerSubscriptionDetailDto = {
    ...sampleSubscriptions[0],
    customer_phone: '081234567890',
    customer_email: 'finance@majubersama.com',
    customer_address: 'Jl. Jendral Sudirman No. 45, Jakarta Pusat',
    invoices_count: 2,
    total_billed_minor: 66600000,
    total_paid_minor: 33300000,
    invoices: [
      {
        id: 'inv-11111111-1111-4111-8111-111111111111',
        invoice_number: 'INV-202609-0001',
        business_id: 'biz-001',
        customer_subscription_id: 'sub-11111111-1111-4111-8111-111111111111',
        customer_id: 'cst-11111111-1111-4111-8111-111111111111',
        customer_name: 'PT Maju Bersama',
        receivable_id: 'rec-11111111-1111-4111-8111-111111111111',
        billing_period_start: '2026-09-01',
        billing_period_end: '2026-09-30',
        subtotal_minor: 30000000,
        discount_minor: 0,
        tax_minor: 3300000,
        total_minor: 33300000,
        outstanding_minor: 0,
        paid_minor: 33300000,
        currency: 'IDR',
        status: 'PAID',
        issue_date: '2026-09-01',
        due_date: '2026-09-15',
        paid_at: '2026-09-03T10:00:00Z',
        payment_reference: 'TRF-BCA-9921',
        notes: 'Periode September 2026',
        metadata: {},
        created_at: '2026-09-01T08:00:00Z',
        updated_at: '2026-09-03T10:00:00Z',
      },
    ],
  };

  const sampleInvoices: CustomerInvoiceDto[] = [
    {
      id: 'inv-11111111-1111-4111-8111-111111111111',
      invoice_number: 'INV-202609-0001',
      business_id: 'biz-001',
      customer_subscription_id: 'sub-11111111-1111-4111-8111-111111111111',
      customer_id: 'cst-11111111-1111-4111-8111-111111111111',
      customer_name: 'PT Maju Bersama',
      receivable_id: 'rec-11111111-1111-4111-8111-111111111111',
      billing_period_start: '2026-09-01',
      billing_period_end: '2026-09-30',
      subtotal_minor: 30000000,
      discount_minor: 0,
      tax_minor: 3300000,
      total_minor: 33300000,
      outstanding_minor: 0,
      paid_minor: 33300000,
      currency: 'IDR',
      status: 'PAID',
      issue_date: '2026-09-01',
      due_date: '2026-09-15',
      paid_at: '2026-09-03T10:00:00Z',
      payment_reference: 'TRF-BCA-9921',
      notes: 'Periode September 2026',
      metadata: {},
      created_at: '2026-09-01T08:00:00Z',
      updated_at: '2026-09-03T10:00:00Z',
    },
    {
      id: 'inv-22222222-2222-4222-8222-222222222222',
      invoice_number: 'INV-202609-0002',
      business_id: 'biz-001',
      customer_subscription_id: 'sub-22222222-2222-4222-8222-222222222222',
      customer_id: 'cst-22222222-2222-4222-8222-222222222222',
      customer_name: 'Budi Santoso',
      receivable_id: 'rec-22222222-2222-4222-8222-222222222222',
      billing_period_start: '2026-09-01',
      billing_period_end: '2026-11-30',
      subtotal_minor: 25000000,
      discount_minor: 5000000,
      tax_minor: 2200000,
      total_minor: 22200000,
      outstanding_minor: 22200000,
      paid_minor: 0,
      currency: 'IDR',
      status: 'ISSUED',
      issue_date: '2026-09-01',
      due_date: '2026-09-10',
      paid_at: null,
      payment_reference: null,
      notes: 'Tagihan Triwulan Q3',
      metadata: {},
      created_at: '2026-09-01T08:00:00Z',
      updated_at: '2026-09-01T08:00:00Z',
    },
  ];

  const sampleInvoiceDetail: CustomerInvoiceDetailDto = {
    ...sampleInvoices[1],
    customer_phone: '0855551234',
    customer_email: 'budi@gmail.com',
    customer_address: 'Jl. Anggrek No. 12, Bandung',
    subscription_name: 'Home Fiber 50 Mbps',
    subscription_billing_cycle: 'QUARTERLY',
    receivable_status: 'UNPAID',
    journal_entry_id: 'je-22222222-2222-4222-8222-222222222222',
    journal_status: 'POSTED',
    payments: [],
  };

  // =========================================================================
  // 1. RBAC ROUTE PERMISSIONS & NAVIGATION
  // =========================================================================
  it('BILLING-UI-001: route permissions allow OWNER, STAFF, CASHIER to access billing routes', () => {
    expect(ROUTE_PERMISSIONS['/billing']).toEqual(['OWNER', 'STAFF', 'CASHIER']);
    expect(ROUTE_PERMISSIONS['/billing/subscriptions']).toEqual(['OWNER', 'STAFF', 'CASHIER']);
    expect(ROUTE_PERMISSIONS['/billing/invoices']).toEqual(['OWNER', 'STAFF', 'CASHIER']);

    expect(canAccessRoute('OWNER', '/billing')).toBe(true);
    expect(canAccessRoute('STAFF', '/billing')).toBe(true);
    expect(canAccessRoute('CASHIER', '/billing')).toBe(true);
    expect(canAccessRoute(null, '/billing')).toBe(false);
  });

  it('BILLING-UI-002: navigation items include billing module for authorized tenant roles', () => {
    const billingNav = NAVIGATION_ITEMS.find((item) => item.href === '/billing');
    expect(billingNav).toBeDefined();
    expect(billingNav?.name).toBe('Langganan & Tagihan');
    expect(canAccessRoute('OWNER', billingNav!.href)).toBe(true);
    expect(canAccessRoute('STAFF', billingNav!.href)).toBe(true);
    expect(canAccessRoute('CASHIER', billingNav!.href)).toBe(true);
  });

  // =========================================================================
  // 2. STATUS PILLS & CYCLE PILLS
  // =========================================================================
  it('BILLING-UI-003: subscription status pills render correct Indonesian labels and styles', () => {
    const activeHtml = renderToString(<SubscriptionStatusPill status="ACTIVE" />);
    expect(activeHtml).toContain('Aktif');
    expect(activeHtml).toContain('emerald');

    const pausedHtml = renderToString(<SubscriptionStatusPill status="PAUSED" />);
    expect(pausedHtml).toContain('Ditunda');
    expect(pausedHtml).toContain('amber');

    const cancelledHtml = renderToString(<SubscriptionStatusPill status="CANCELLED" />);
    expect(cancelledHtml).toContain('Dibatalkan');
    expect(cancelledHtml).toContain('rose');
  });

  it('BILLING-UI-004: invoice status pills render correct Indonesian labels and styles', () => {
    const draftHtml = renderToString(<InvoiceStatusPill status="DRAFT" />);
    expect(draftHtml).toContain('Draf');

    const issuedHtml = renderToString(<InvoiceStatusPill status="ISSUED" />);
    expect(issuedHtml).toContain('Diterbitkan');
    expect(issuedHtml).toContain('sky');

    const paidHtml = renderToString(<InvoiceStatusPill status="PAID" />);
    expect(paidHtml).toContain('Lunas');
    expect(paidHtml).toContain('emerald');

    const overdueHtml = renderToString(<InvoiceStatusPill status="OVERDUE" />);
    expect(overdueHtml).toContain('Jatuh Tempo');
    expect(overdueHtml).toContain('rose');

    const cancelledHtml = renderToString(<InvoiceStatusPill status="CANCELLED" />);
    expect(cancelledHtml).toContain('Dibatalkan');
  });

  it('BILLING-UI-005: billing cycle pill renders Indonesian cycle descriptions', () => {
    const monthlyHtml = renderToString(<BillingCyclePill cycle="MONTHLY" />);
    expect(monthlyHtml).toContain('Bulanan');

    const quarterlyHtml = renderToString(<BillingCyclePill cycle="QUARTERLY" />);
    expect(quarterlyHtml).toContain('Triwulan');

    const semiAnnualHtml = renderToString(<BillingCyclePill cycle="SEMI_ANNUAL" />);
    expect(semiAnnualHtml).toContain('Semester');

    const annualHtml = renderToString(<BillingCyclePill cycle="ANNUAL" />);
    expect(annualHtml).toContain('Tahunan');
  });

  // =========================================================================
  // 3. DASHBOARD KPI CARDS
  // =========================================================================
  it('BILLING-UI-006: billing KPI cards render all financial metrics and counts', () => {
    const html = renderToString(<BillingKPICards kpi={sampleKPI} isLoading={false} />);
    expect(html).toContain('Langganan Aktif');
    expect(html).toContain('42');
    expect(html).toContain('total langganan');
    expect(html).toContain('MRR Est.');
    expect(html).toContain('Jatuh Tempo');
    expect(html).toContain('2');
    expect(html).toContain('Total Piutang');
    expect(html).toContain('7 Hari Mendatang');
    expect(html).toContain('8');
    expect(html).toContain('Lunas Bulan Ini');
  });

  it('BILLING-UI-007: billing KPI cards show skeleton loading state', () => {
    const html = renderToString(<BillingKPICards kpi={null} isLoading={true} />);
    expect(html).toContain('animate-pulse');
  });

  // =========================================================================
  // 4. SUBSCRIPTION TABLE & RBAC ACTION BUTTONS
  // =========================================================================
  it('BILLING-UI-008: subscription table renders items with details and links', () => {
    const html = renderToString(
      <SubscriptionTable
        subscriptions={sampleSubscriptions}
        role="OWNER"
        isLoading={false}
        onGenerateInvoice={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
        onEditPrice={vi.fn()}
      />
    );
    expect(html).toContain('PT Maju Bersama');
    expect(html).toContain('Internet Dedicated 100 Mbps');
    expect(html).toContain('Bulanan');
    expect(html).toContain('Budi Santoso');
    expect(html).toContain('Home Fiber 50 Mbps');
    expect(html).toContain('Triwulan');
  });

  it('BILLING-UI-009: subscription table shows empty and loading states', () => {
    const emptyHtml = renderToString(
      <SubscriptionTable
        subscriptions={[]}
        role="OWNER"
        isLoading={false}
        onGenerateInvoice={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
        onEditPrice={vi.fn()}
      />
    );
    expect(emptyHtml).toContain('Tidak ada langganan ditemukan');

    const loadingHtml = renderToString(
      <SubscriptionTable
        subscriptions={[]}
        role="OWNER"
        isLoading={true}
        onGenerateInvoice={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
        onEditPrice={vi.fn()}
      />
    );
    expect(loadingHtml).toContain('Memuat daftar langganan pelanggan...');
  });

  it('BILLING-UI-010: subscription table RBAC - OWNER sees all actions including price edit and cancel', () => {
    const html = renderToString(
      <SubscriptionTable
        subscriptions={sampleSubscriptions}
        role="OWNER"
        isLoading={false}
        onGenerateInvoice={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
        onEditPrice={vi.fn()}
      />
    );
    expect(html).toContain('Ubah Nominal &amp; Harga (OWNER)'); // OWNER only
    expect(html).toContain('Terbitkan Tagihan Manual');        // Generate invoice
    expect(html).toContain('Tunda Langganan');                 // Pause
    expect(html).toContain('Aktifkan Kembali');                // Resume
    expect(html).toContain('Batalkan Langganan (OWNER)');      // Cancel
  });

  it('BILLING-UI-011: subscription table RBAC - STAFF sees operational actions but NOT Edit Harga or Batal', () => {
    const html = renderToString(
      <SubscriptionTable
        subscriptions={sampleSubscriptions}
        role="STAFF"
        isLoading={false}
        onGenerateInvoice={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
        onEditPrice={vi.fn()}
      />
    );
    expect(html).not.toContain('Ubah Nominal &amp; Harga (OWNER)'); // Financial: hidden for STAFF
    expect(html).toContain('Terbitkan Tagihan Manual');            // Operational: visible for STAFF
    expect(html).toContain('Tunda Langganan');                     // Operational: visible for STAFF
    expect(html).not.toContain('Batalkan Langganan (OWNER)');      // Destructive: hidden for STAFF
  });

  it('BILLING-UI-012: subscription table RBAC - CASHIER has no operational/financial mutation controls', () => {
    const html = renderToString(
      <SubscriptionTable
        subscriptions={sampleSubscriptions}
        role="CASHIER"
        isLoading={false}
        onGenerateInvoice={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
        onEditPrice={vi.fn()}
      />
    );
    expect(html).not.toContain('Ubah Nominal &amp; Harga (OWNER)');
    expect(html).not.toContain('Terbitkan Tagihan Manual');
    expect(html).not.toContain('Tunda Langganan');
    expect(html).not.toContain('Aktifkan Kembali');
    expect(html).not.toContain('Batalkan Langganan (OWNER)');
  });

  // =========================================================================
  // 5. SUBSCRIPTION DETAIL VIEW
  // =========================================================================
  it('BILLING-UI-013: subscription detail view renders customer info, financial breakdown, and linked invoices', () => {
    const html = renderToString(
      <SubscriptionDetailView
        subscription={sampleSubscriptionDetail}
        role="OWNER"
        onGenerateInvoice={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
        onEditPrice={vi.fn()}
      />
    );
    expect(html).toContain('PT Maju Bersama');
    expect(html).toContain('081234567890');
    expect(html).toContain('finance@majubersama.com');
    expect(html).toContain('Jl. Jendral Sudirman No. 45');
    expect(html).toContain('Internet Dedicated 100 Mbps');
    expect(html).toContain('Bulanan');
    expect(html).toContain('Tanggal Tagih (Anchor):');
    expect(html).toContain('Setiap tanggal');
    expect(html).toContain('Riwayat Tagihan');
    expect(html).toContain('INV-202609-0001');
  });

  // =========================================================================
  // 6. SUBSCRIPTION MODALS (CREATE, PRICE, ACTION, GENERATE INVOICE)
  // =========================================================================
  it('BILLING-UI-014: subscription create modal renders all required input fields', () => {
    const html = renderToString(
      <SubscriptionCreateModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(html).toContain('Tambah Langganan Pelanggan');
    expect(html).toContain('Pelanggan CRM');
    expect(html).toContain('Nama Paket / Layanan');
    expect(html).toContain('Siklus Penagihan');
    expect(html).toContain('Harga Pokok (Rp)');
    expect(html).toContain('Tanggal Tagih (Anchor Day)');
    expect(html).toContain('Daftarkan Langganan');
  });

  it('BILLING-UI-015: subscription price modal (OWNER only) renders price amendment form', () => {
    const html = renderToString(
      <SubscriptionPriceModal
        isOpen={true}
        subscription={sampleSubscriptions[0]}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(html).toContain('Perubahan Finansial &amp; Harga');
    expect(html).toContain('PT Maju Bersama');
    expect(html).toContain('Harga Pokok (Rp)');
    expect(html).toContain('Diskon (Rp)');
    expect(html).toContain('PPN / Pajak (Rp)');
    expect(html).toContain('Total Snapshot Baru');
    expect(html).toContain('Simpan Perubahan Finansial');
  });

  it('BILLING-UI-016: subscription action modal handles pause, resume, cancel states', () => {
    const pauseHtml = renderToString(
      <SubscriptionActionModal
        isOpen={true}
        subscription={sampleSubscriptions[0]}
        actionType="pause"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(pauseHtml).toContain('Tunda Langganan');
    expect(pauseHtml).toContain('Alasan Tindakan');
    expect(pauseHtml).toContain('(opsional)');

    const cancelHtml = renderToString(
      <SubscriptionActionModal
        isOpen={true}
        subscription={sampleSubscriptions[0]}
        actionType="cancel"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(cancelHtml).toContain('Batalkan Langganan Permanen');
    expect(cancelHtml).toContain('Langganan yang dibatalkan tidak dapat diaktifkan kembali');
  });

  it('BILLING-UI-017: generate invoice modal renders period and due date inputs', () => {
    const html = renderToString(
      <GenerateInvoiceModal
        isOpen={true}
        subscription={sampleSubscriptions[0]}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(html).toContain('Terbitkan Tagihan Manual');
    expect(html).toContain('Periode Mulai');
    expect(html).toContain('Periode Selesai');
    expect(html).toContain('Jatuh Tempo Pembayaran');
    expect(html).toContain('Terbitkan Invoice');
  });

  // =========================================================================
  // 7. INVOICE TABLE & RBAC ACTION BUTTONS
  // =========================================================================
  it('BILLING-UI-018: invoice table renders invoice rows with numbers, status, and amounts', () => {
    const html = renderToString(
      <InvoiceTable
        invoices={sampleInvoices}
        role="OWNER"
        isLoading={false}
        onRecordPayment={vi.fn()}
        onCancelInvoice={vi.fn()}
      />
    );
    expect(html).toContain('INV-202609-0001');
    expect(html).toContain('PT Maju Bersama');
    expect(html).toContain('INV-202609-0002');
    expect(html).toContain('Budi Santoso');
  });

  it('BILLING-UI-019: invoice table RBAC - OWNER can see Bayar and Batalkan buttons', () => {
    const html = renderToString(
      <InvoiceTable
        invoices={sampleInvoices}
        role="OWNER"
        isLoading={false}
        onRecordPayment={vi.fn()}
        onCancelInvoice={vi.fn()}
      />
    );
    expect(html).toContain('Catat Pembayaran');          // Payment
    expect(html).toContain('Batalkan Invoice (OWNER)'); // Cancellation
  });

  it('BILLING-UI-020: invoice table RBAC - STAFF and CASHIER can see Bayar but NOT Batalkan', () => {
    const staffHtml = renderToString(
      <InvoiceTable
        invoices={sampleInvoices}
        role="STAFF"
        isLoading={false}
        onRecordPayment={vi.fn()}
        onCancelInvoice={vi.fn()}
      />
    );
    expect(staffHtml).toContain('Catat Pembayaran');
    expect(staffHtml).not.toContain('Batalkan Invoice (OWNER)'); // Cancel invoice is OWNER only

    const cashierHtml = renderToString(
      <InvoiceTable
        invoices={sampleInvoices}
        role="CASHIER"
        isLoading={false}
        onRecordPayment={vi.fn()}
        onCancelInvoice={vi.fn()}
      />
    );
    expect(cashierHtml).toContain('Catat Pembayaran');
    expect(cashierHtml).not.toContain('Batalkan Invoice (OWNER)');
  });

  // =========================================================================
  // 8. INVOICE DETAIL VIEW
  // =========================================================================
  it('BILLING-UI-021: invoice detail view displays financial breakdown, receivable status, and accounting GL journal entry', () => {
    const html = renderToString(
      <InvoiceDetailView
        invoice={sampleInvoiceDetail}
        role="OWNER"
        onRecordPayment={vi.fn()}
        onCancelInvoice={vi.fn()}
      />
    );
    expect(html).toContain('INV-202609-0002');
    expect(html).toContain('Budi Santoso');
    expect(html).toContain('Home Fiber 50 Mbps');
    expect(html).toContain('Triwulan');
    expect(html).toContain('ID Piutang Usaha (AR)');
    expect(html).toContain('Integrasi Buku Besar &amp; AR');
    expect(html).toContain('rec-22222222-2222-4222-8222-222222222222');
    expect(html).toContain('Catat Pembayaran');
    expect(html).toContain('Batalkan Tagihan (OWNER)');
  });

  it('BILLING-UI-022: invoice detail view hides Batalkan Tagihan for STAFF and CASHIER', () => {
    const staffHtml = renderToString(
      <InvoiceDetailView
        invoice={sampleInvoiceDetail}
        role="STAFF"
        onRecordPayment={vi.fn()}
        onCancelInvoice={vi.fn()}
      />
    );
    expect(staffHtml).toContain('Catat Pembayaran');
    expect(staffHtml).not.toContain('Batalkan Tagihan (OWNER)');

    const cashierHtml = renderToString(
      <InvoiceDetailView
        invoice={sampleInvoiceDetail}
        role="CASHIER"
        onRecordPayment={vi.fn()}
        onCancelInvoice={vi.fn()}
      />
    );
    expect(cashierHtml).toContain('Catat Pembayaran');
    expect(cashierHtml).not.toContain('Batalkan Tagihan (OWNER)');
  });

  // =========================================================================
  // 9. INVOICE PAYMENT & CANCEL MODALS
  // =========================================================================
  it('BILLING-UI-023: invoice payment modal renders method selector, reference, and amount fields', () => {
    const html = renderToString(
      <InvoicePaymentModal
        isOpen={true}
        invoice={sampleInvoices[1]}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(html).toContain('Catat Pembayaran Tagihan');
    expect(html).toContain('INV-202609-0002');
    expect(html).toContain('Nominal Pembayaran (Rp)');
    expect(html).toContain('Metode Pembayaran');
    expect(html).toContain('Nomor Referensi');
    expect(html).toContain('Simpan Pembayaran');
  });

  it('BILLING-UI-024: invoice cancel modal (OWNER only) renders cancellation warning and reason input', () => {
    const html = renderToString(
      <InvoiceCancelModal
        isOpen={true}
        invoice={sampleInvoices[1]}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(html).toContain('Batalkan Tagihan');
    expect(html).toContain('INV-202609-0002');
    expect(html).toContain('Alasan Pembatalan');
    expect(html).toContain('Konfirmasi Batalkan Tagihan');
  });

  // =========================================================================
  // 10. API ERROR MESSAGE PARSING
  // =========================================================================
  it('BILLING-UI-025: getBillingApiErrorMessage parses domain errors into Indonesian user guidance', () => {
    const pricingForbidden = {
      isAxiosError: true,
      response: {
        status: 403,
        data: { message: 'Only OWNER can modify financial pricing' },
      },
    };
    expect(getBillingApiErrorMessage(pricingForbidden)).toContain('Hanya pemilik (OWNER) yang berhak mengubah nominal harga');

    const cancelForbidden = {
      isAxiosError: true,
      response: {
        status: 403,
        data: { message: 'Only OWNER can cancel subscription' },
      },
    };
    expect(getBillingApiErrorMessage(cancelForbidden)).toContain('Hanya pemilik (OWNER) yang berhak membatalkan');

    const paymentConflict = {
      isAxiosError: true,
      response: {
        status: 409,
        data: { code: 'PAYMENT_EXISTS', message: 'Invoice has recorded payment' },
      },
    };
    expect(getBillingApiErrorMessage(paymentConflict)).toContain('sudah memiliki riwayat pembayaran');

    const notFound = {
      isAxiosError: true,
      response: {
        status: 404,
        data: { message: 'Invoice not found' },
      },
    };
    expect(getBillingApiErrorMessage(notFound)).toContain('Data langganan atau tagihan tidak ditemukan');
  });
});
