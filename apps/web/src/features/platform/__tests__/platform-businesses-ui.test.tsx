/**
 * Super Admin — Platform Businesses UI & Acceptance Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import PlatformBusinessesPage from '@/app/platform/businesses/page';
import * as api from '../api';
import { formatRangeLabel, isPreviousDisabled, isNextDisabled } from '../list-helpers';

vi.mock('../api');

describe('SUPER ADMIN — Platform Businesses UI Tests', () => {
  const sampleBusinesses = {
    items: [
      {
        id: 'biz-001',
        name: 'Toko Sumber Rejeki',
        created_at: '2026-08-10T10:00:00.000Z',
      },
      {
        id: 'biz-002',
        name: 'Minimarket Barokah',
        created_at: '2026-08-15T12:00:00.000Z',
      },
    ],
    total: 2,
    limit: 20,
    offset: 0,
    has_more: false,
  };

  const sampleSubscriptions = {
    items: [
      {
        id: 'sub-001',
        business_id: 'biz-001',
        account_customer_id: null,
        plan_code: 'pro',
        plan_family: 'retail',
        family_code: 'ret',
        source: 'direct',
        status: 'active',
        starts_at: '2026-08-10T10:00:00.000Z',
        ends_at: null,
        billing_cycle: 'monthly',
        final_price: 250000,
        currency: 'IDR',
        created_at: '2026-08-10T10:00:00.000Z',
      },
    ],
    total: 1,
    limit: 20,
    offset: 0,
    has_more: false,
  };

  it('SA-BIZ-001: renders businesses page structure and search controls', () => {
    vi.mocked(api.getPlatformBusinesses).mockResolvedValue(sampleBusinesses);
    vi.mocked(api.getPlatformSubscriptions).mockResolvedValue(sampleSubscriptions);

    const html = renderToString(<PlatformBusinessesPage />);

    expect(html).toContain('Manajemen Bisnis Tenant');
    expect(html).toContain('Cari nama bisnis atau tenant ID…');
    expect(html).toContain('Semua Status');
  });

  it('SA-BIZ-002: formatRangeLabel formats pagination correctly', () => {
    const label = formatRangeLabel(25, 0, 20, 'bisnis');
    expect(label).toBe('Menampilkan 1–20 dari 25 bisnis');
  });

  it('SA-BIZ-003: isPreviousDisabled and isNextDisabled evaluate pagination boundaries', () => {
    expect(isPreviousDisabled(false, 0)).toBe(true);
    expect(isPreviousDisabled(false, 20)).toBe(false);
    expect(isNextDisabled(false, true)).toBe(false);
    expect(isNextDisabled(false, false)).toBe(true);
  });
});
