/**
 * Super Admin — Platform Subscriptions & Billing Lifecycle UI Acceptance Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import PlatformSubscriptionsPage from '@/app/platform/subscriptions/page';
import * as api from '../api';
import { PLATFORM_NAVIGATION, formatRangeLabel, isPreviousDisabled, isNextDisabled } from '../list-helpers';

vi.mock('../api');

describe('SUPER ADMIN — Platform Billing Lifecycle UI Tests', () => {
  const sampleSubscriptionsResponse: api.PlatformPaginated<api.PlatformSubscription> = {
    items: [
      {
        id: 'sub-test-001',
        business_id: 'biz-tenant-alpha',
        business_name: 'PT Maju Bersama',
        account_customer_id: null,
        plan_code: 'ERP_GROWTH_MONTHLY',
        plan_name: 'ERP Growth Monthly',
        plan_family: 'ERP',
        family_code: 'ERP',
        source: 'MANUAL',
        status: 'ACTIVE',
        starts_at: '2026-09-01T00:00:00.000Z',
        ends_at: '2026-10-01T00:00:00.000Z',
        billing_cycle: 'MONTHLY',
        final_price: 350000,
        currency: 'IDR',
        created_at: '2026-09-01T00:00:00.000Z',
        latest_invoice: {
          id: 'inv-test-001',
          invoice_number: 'INV-202609-0001',
          subscription_id: 'sub-test-001',
          business_id: 'biz-tenant-alpha',
          plan_code: 'ERP_GROWTH_MONTHLY',
          billing_period_start: '2026-09-01T00:00:00.000Z',
          billing_period_end: '2026-10-01T00:00:00.000Z',
          subtotal_amount: 350000,
          discount_amount: 0,
          tax_amount: 0,
          total_amount: 350000,
          currency: 'IDR',
          status: 'PAID',
          due_date: '2026-09-08T00:00:00.000Z',
          paid_at: '2026-09-01T02:00:00.000Z',
          payment_reference: 'TRF-BCA-102938',
          notes: 'Initial activation',
          created_at: '2026-09-01T00:00:00.000Z',
          updated_at: '2026-09-01T02:00:00.000Z',
        },
      },
      {
        id: 'sub-test-002',
        business_id: 'biz-tenant-beta',
        business_name: 'CV Sukses Abadi',
        account_customer_id: null,
        plan_code: 'ERP_PRO_YEARLY',
        plan_name: 'ERP Pro Yearly',
        plan_family: 'ERP',
        family_code: 'ERP',
        source: 'MANUAL',
        status: 'PENDING',
        starts_at: '2026-09-05T00:00:00.000Z',
        ends_at: null,
        billing_cycle: 'YEARLY',
        final_price: 3600000,
        currency: 'IDR',
        created_at: '2026-09-05T00:00:00.000Z',
        latest_invoice: {
          id: 'inv-test-002',
          invoice_number: 'INV-202609-0002',
          subscription_id: 'sub-test-002',
          business_id: 'biz-tenant-beta',
          plan_code: 'ERP_PRO_YEARLY',
          billing_period_start: '2026-09-05T00:00:00.000Z',
          billing_period_end: '2027-09-05T00:00:00.000Z',
          subtotal_amount: 3600000,
          discount_amount: 0,
          tax_amount: 0,
          total_amount: 3600000,
          currency: 'IDR',
          status: 'ISSUED',
          due_date: '2026-09-12T00:00:00.000Z',
          paid_at: null,
          payment_reference: null,
          notes: 'Yearly billing renewal',
          created_at: '2026-09-05T00:00:00.000Z',
          updated_at: '2026-09-05T00:00:00.000Z',
        },
      },
    ],
    total: 2,
    limit: 20,
    offset: 0,
    has_more: false,
    summary: {
      total: 2,
      active_count: 1,
      pending_count: 1,
      suspended_count: 0,
      cancelled_count: 0,
    },
  };

  it('SA-BILL-001: renders subscription & billing lifecycle page with KPIs and filter controls', () => {
    vi.mocked(api.getPlatformSubscriptions).mockResolvedValue(sampleSubscriptionsResponse);

    const html = renderToString(<PlatformSubscriptionsPage />);

    expect(html).toContain('Langganan &amp; Penagihan Platform');
    expect(html).toContain('Total Langganan');
    expect(html).toContain('Aktif');
    expect(html).toContain('Pending');
    expect(html).toContain('Suspended');
    expect(html).toContain('Semua Status');
    expect(html).toContain('Cari bisnis / plan...');
  });

  it('SA-BILL-002: verifies PLATFORM_NAVIGATION contains Subscriptions entry', () => {
    const subNav = PLATFORM_NAVIGATION.find((item) => item.href === '/platform/subscriptions');
    expect(subNav).toBeDefined();
    expect(subNav?.name).toBe('Subscriptions');
  });

  it('SA-BILL-003: formatRangeLabel formats subscription pagination correctly', () => {
    const label = formatRangeLabel(2, 0, 20, 'langganan');
    expect(label).toBe('Menampilkan 1–2 dari 2 langganan');
  });

  it('SA-BILL-004: evaluates pagination boundaries for subscription list', () => {
    expect(isPreviousDisabled(false, 0)).toBe(true);
    expect(isPreviousDisabled(false, 20)).toBe(false);
    expect(isNextDisabled(false, true)).toBe(false);
    expect(isNextDisabled(false, false)).toBe(true);
  });
});
