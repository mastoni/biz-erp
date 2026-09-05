/**
 * Super Admin — Platform Account Customers UI & Governance Tests (Phase 4.1.40F-4)
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import PlatformAccountCustomersPage from '@/app/platform/account-customers/page';
import * as api from '../api';
import { PLATFORM_NAVIGATION, formatRangeLabel } from '../list-helpers';

vi.mock('../api');

describe('SUPER ADMIN — Platform Account Customers UI (Phase 4.1.40F-4)', () => {
  const sampleResponse: api.PlatformAccountCustomersResponse = {
    items: [
      {
        id: '11111111-2222-3333-4444-555555555555',
        code: 'ACC-2026-0001',
        name: 'PT Mitra Sukses Nusantara',
        account_type: 'BUSINESS',
        tax_id: '01.234.567.8-901.000',
        billing_email: 'finance@mitrasukses.co.id',
        billing_phone: '+628123456789',
        status: 'ACTIVE',
        business_count: 3,
        user_count: 2,
        active_subscription_count: 3,
        created_at: '2026-08-01T10:00:00.000Z',
        updated_at: '2026-08-01T10:00:00.000Z',
      },
    ],
    total: 1,
    limit: 20,
    offset: 0,
    has_more: false,
    summary: {
      total: 1,
      active_count: 1,
      suspended_count: 0,
      pending_count: 0,
      terminated_count: 0,
    },
  };

  it('AC-UI-001: renders Account Customers page with title, KPIs, and controls', () => {
    vi.mocked(api.getPlatformAccountCustomers).mockResolvedValue(sampleResponse);

    const html = renderToString(<PlatformAccountCustomersPage />);

    expect(html).toContain('Account Customers');
    expect(html).toContain('Kelola entitas kepemilikan komersial platform');
    expect(html).toContain('Tambah Account Customer');
    expect(html).toContain('Semua Status');
    expect(html).toContain('Semua Tipe');
    expect(html).toContain('Cari kode, nama, atau email billing...');
  });

  it('AC-UI-002: includes Account Customers in PLATFORM_NAVIGATION', () => {
    const navItem = PLATFORM_NAVIGATION.find((item) => item.href === '/platform/account-customers');
    expect(navItem).toBeDefined();
    expect(navItem?.name).toBe('Account Customers');
  });

  it('AC-UI-003: formats pagination range label for Account Customer noun', () => {
    const label = formatRangeLabel(10, 0, 20, 'Account Customer');
    expect(label).toBe('Menampilkan 1–10 dari 10 Account Customer');
  });
});
