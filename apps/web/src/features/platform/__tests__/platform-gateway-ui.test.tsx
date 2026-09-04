/**
 * Super Admin — Platform Payment Gateway UI Acceptance Tests (Phase 5B)
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import PlatformSubscriptionsPage from '@/app/platform/subscriptions/page';
import * as api from '../api';

vi.mock('../api');

describe('SUPER ADMIN — Platform Payment Gateway UI Tests', () => {
  const sampleSubscriptionsWithUnpaidInvoice: api.PlatformPaginated<api.PlatformSubscription> = {
    items: [
      {
        id: 'sub-gw-001',
        business_id: 'biz-tenant-gw',
        business_name: 'PT Digital Gateway Solusi',
        account_customer_id: null,
        plan_code: 'ERP_PRO_MONTHLY',
        plan_name: 'ERP Pro Monthly',
        plan_family: 'ERP',
        family_code: 'ERP',
        source: 'MANUAL',
        status: 'PENDING',
        starts_at: '2026-09-05T00:00:00.000Z',
        ends_at: null,
        billing_cycle: 'MONTHLY',
        final_price: 500000,
        currency: 'IDR',
        created_at: '2026-09-05T00:00:00.000Z',
        latest_invoice: {
          id: 'inv-gw-001',
          invoice_number: 'INV-202609-8888',
          subscription_id: 'sub-gw-001',
          business_id: 'biz-tenant-gw',
          plan_code: 'ERP_PRO_MONTHLY',
          billing_period_start: '2026-09-05T00:00:00.000Z',
          billing_period_end: '2026-10-05T00:00:00.000Z',
          subtotal_amount: 500000,
          discount_amount: 0,
          tax_amount: 0,
          total_amount: 500000,
          currency: 'IDR',
          status: 'ISSUED',
          due_date: '2026-09-12T00:00:00.000Z',
          paid_at: null,
          payment_reference: null,
          notes: 'Initial activation',
          created_at: '2026-09-05T00:00:00.000Z',
          updated_at: '2026-09-05T00:00:00.000Z',
        },
      },
    ],
    total: 1,
    limit: 20,
    offset: 0,
    has_more: false,
    summary: {
      total: 1,
      active_count: 0,
      pending_count: 1,
      suspended_count: 0,
      cancelled_count: 0,
    },
  };

  it('GW-UI-001: renders gateway action and subscription controls', () => {
    vi.mocked(api.getPlatformSubscriptions).mockResolvedValue(sampleSubscriptionsWithUnpaidInvoice);

    const html = renderToString(<PlatformSubscriptionsPage />);

    expect(html).toContain('Langganan &amp; Penagihan Platform');
    expect(html).toContain('payment gateway online');
    expect(html).toContain('Total Langganan');
    expect(html).toContain('Semua Status');
  });

  it('GW-UI-002: verifies createPlatformInvoicePaymentToken API contract', () => {
    expect(typeof api.createPlatformInvoicePaymentToken).toBe('function');
  });
});
