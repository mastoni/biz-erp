/**
 * Super Admin — Platform Businesses UI & Lifecycle Acceptance Tests (Phase SA-1)
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import PlatformBusinessesPage from '@/app/platform/businesses/page';
import * as api from '../api';
import { formatRangeLabel, isPreviousDisabled, isNextDisabled } from '../list-helpers';

vi.mock('../api');

describe('SUPER ADMIN — Platform Businesses UI & Lifecycle Tests (Phase SA-1)', () => {
  const sampleBusinessesResponse: api.PlatformBusinessesResponse = {
    items: [
      {
        id: 'biz-001',
        name: 'Toko Sumber Rejeki',
        status: 'PENDING_REVIEW',
        owner_user_id: 'user-001',
        owner_email: 'owner@sumberrejeki.com',
        created_at: '2026-08-10T10:00:00.000Z',
        updated_at: '2026-08-10T10:00:00.000Z',
      },
      {
        id: 'biz-002',
        name: 'Minimarket Barokah',
        status: 'ACTIVE',
        owner_user_id: 'user-002',
        owner_email: 'owner@barokah.com',
        created_at: '2026-08-15T12:00:00.000Z',
        updated_at: '2026-08-15T12:00:00.000Z',
      },
    ],
    total: 2,
    limit: 20,
    offset: 0,
    has_more: false,
    summary: {
      pending_count: 1,
      active_count: 1,
      suspended_count: 0,
      rejected_count: 0,
      total: 2,
    },
  };

  it('SA-BIZ-001: renders businesses page structure, KPIs, and search controls', () => {
    vi.mocked(api.getPlatformBusinesses).mockResolvedValue(sampleBusinessesResponse);

    const html = renderToString(<PlatformBusinessesPage />);

    expect(html).toContain('Manajemen Tenant &amp; Approval');
    expect(html).toContain('Perlu Ditinjau');
    expect(html).toContain('Bisnis Aktif');
    expect(html).toContain('Ditangguhkan');
    expect(html).toContain('Ditolak');
    expect(html).toContain('Cari nama bisnis atau email pemilik...');
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
