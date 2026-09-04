/**
 * Super Admin — Platform Service Registry UI Acceptance Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import PlatformServicesPage from '@/app/platform/services/page';
import * as api from '../api';
import { PLATFORM_NAVIGATION, formatRangeLabel, isPreviousDisabled, isNextDisabled } from '../list-helpers';

vi.mock('../api');

describe('SUPER ADMIN — Platform Service Registry UI Tests', () => {
  const sampleServicesResponse: api.PlatformServicesResponse = {
    items: [
      {
        code: 'ERP',
        name: 'Enterprise Resource Planning',
        description: 'Core financial, inventory, and point-of-sale ERP engine',
        category: 'OPERATIONS',
        service_type: 'INTERNAL',
        owner: 'PLATFORM',
        lifecycle_status: 'ACTIVE',
        public_visibility: false,
        base_capability: {},
        provisioning_capability: {},
        support_capability: {},
        dependencies: [],
        created_at: '2026-09-04T10:00:00.000Z',
        updated_at: '2026-09-04T10:00:00.000Z',
      },
      {
        code: 'ISP_MANAGEMENT',
        name: 'ISP Management System',
        description: 'Radius, MikroTik, and bandwidth management automation',
        category: 'OPERATIONS',
        service_type: 'INTERNAL',
        owner: 'PLATFORM',
        lifecycle_status: 'ACTIVE',
        public_visibility: false,
        base_capability: {},
        provisioning_capability: {},
        support_capability: {},
        dependencies: [
          {
            depends_on_service_code: 'ERP',
            dependency_type: 'REQUIRED',
          },
        ],
        created_at: '2026-09-04T10:00:00.000Z',
        updated_at: '2026-09-04T10:00:00.000Z',
      },
    ],
    total: 2,
    limit: 20,
    offset: 0,
    has_more: false,
    summary: {
      total: 2,
      active_count: 2,
      draft_count: 0,
      deprecated_count: 0,
      suspended_count: 0,
      retired_count: 0,
    },
  };

  it('SA-SVC-001: renders service registry page structure, KPIs, and search/filter controls', () => {
    vi.mocked(api.getPlatformServices).mockResolvedValue(sampleServicesResponse);

    const html = renderToString(<PlatformServicesPage />);

    expect(html).toContain('Service Registry');
    expect(html).toContain('Total Layanan');
    expect(html).toContain('Layanan Aktif');
    expect(html).toContain('Status Draft');
    expect(html).toContain('Deprecated / Non-Aktif');
    expect(html).toContain('Cari kode layanan, nama, kategori, atau deskripsi...');
    expect(html).toContain('Semua Status');
    expect(html).toContain('Semua Tipe');
    expect(html).toContain('Tambah Layanan');
  });

  it('SA-SVC-002: verifies PLATFORM_NAVIGATION contains Service Registry entry', () => {
    const serviceNav = PLATFORM_NAVIGATION.find((item) => item.href === '/platform/services');
    expect(serviceNav).toBeDefined();
    expect(serviceNav?.name).toBe('Service Registry');
  });

  it('SA-SVC-003: formatRangeLabel formats service pagination correctly', () => {
    const label = formatRangeLabel(10, 0, 20, 'layanan');
    expect(label).toBe('Menampilkan 1–10 dari 10 layanan');
  });

  it('SA-SVC-004: evaluates pagination boundaries for service list', () => {
    expect(isPreviousDisabled(false, 0)).toBe(true);
    expect(isPreviousDisabled(false, 20)).toBe(false);
    expect(isNextDisabled(false, true)).toBe(false);
    expect(isNextDisabled(false, false)).toBe(true);
  });
});
