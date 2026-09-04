/**
 * Super Admin — Platform Support Tickets UI Acceptance Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import PlatformTicketsPage from '@/app/platform/tickets/page';
import * as api from '../api';
import { PLATFORM_NAVIGATION, formatRangeLabel, isPreviousDisabled, isNextDisabled } from '../list-helpers';

vi.mock('../api');

describe('SUPER ADMIN — Platform Support Tickets UI Tests', () => {
  const sampleTicketsResponse: api.PlatformTicketsResponse = {
    items: [
      {
        id: '99000000-0000-0000-0000-000000000001',
        business_id: '11000000-0000-0000-0000-000000000001',
        business_name: 'Toko Sumber Rejeki',
        conversation_id: '22000000-0000-0000-0000-000000000001',
        service_code: 'CS_AI',
        subject: 'Kendala Sinkronisasi Transaksi POS',
        description: 'Pelanggan melaporkan transaksi offline tidak terkirim.',
        priority: 'URGENT',
        status: 'OPEN',
        assigned_to: null,
        assignee_name: null,
        assignee_email: null,
        created_at: '2026-09-04T10:00:00.000Z',
        updated_at: '2026-09-04T10:00:00.000Z',
      },
      {
        id: '99000000-0000-0000-0000-000000000002',
        business_id: '11000000-0000-0000-0000-000000000002',
        business_name: 'Minimarket Barokah',
        conversation_id: '22000000-0000-0000-0000-000000000002',
        service_code: 'CS_AI',
        subject: 'Pertanyaan Perubahan Paket Billing',
        description: 'Ingin upgrade ke paket ERP Enterprise tahunan.',
        priority: 'MEDIUM',
        status: 'IN_PROGRESS',
        assigned_to: '33000000-0000-0000-0000-000000000001',
        assignee_name: 'Admin Super',
        assignee_email: 'admin@skmnetwork.com',
        created_at: '2026-09-04T12:00:00.000Z',
        updated_at: '2026-09-04T12:30:00.000Z',
      },
    ],
    total: 2,
    limit: 20,
    offset: 0,
    has_more: false,
    summary: {
      open_count: 1,
      in_progress_count: 1,
      resolved_count: 0,
      closed_count: 0,
      total: 2,
    },
    assignees: [
      {
        id: '33000000-0000-0000-0000-000000000001',
        name: 'Admin Super',
        email: 'admin@skmnetwork.com',
      },
    ],
  };

  it('SA-TCK-001: renders support tickets page structure, KPIs, and search/filter controls', () => {
    vi.mocked(api.getPlatformTickets).mockResolvedValue(sampleTicketsResponse);

    const html = renderToString(<PlatformTicketsPage />);

    expect(html).toContain('Support Tickets');
    expect(html).toContain('Tiket Terbuka (Open)');
    expect(html).toContain('Sedang Ditangani');
    expect(html).toContain('Selesai (Resolved)');
    expect(html).toContain('Ditutup (Closed)');
    expect(html).toContain('Cari subjek, deskripsi, nama bisnis, atau layanan...');
    expect(html).toContain('Semua Status');
    expect(html).toContain('Semua Prioritas');
  });

  it('SA-TCK-002: verifies PLATFORM_NAVIGATION contains Support Tickets entry', () => {
    const ticketNav = PLATFORM_NAVIGATION.find((item) => item.href === '/platform/tickets');
    expect(ticketNav).toBeDefined();
    expect(ticketNav?.name).toBe('Support Tickets');
  });

  it('SA-TCK-003: formatRangeLabel formats ticket pagination correctly', () => {
    const label = formatRangeLabel(15, 0, 20, 'tiket');
    expect(label).toBe('Menampilkan 1–15 dari 15 tiket');
  });

  it('SA-TCK-004: evaluates pagination boundaries for ticket list', () => {
    expect(isPreviousDisabled(false, 0)).toBe(true);
    expect(isPreviousDisabled(false, 20)).toBe(false);
    expect(isNextDisabled(false, true)).toBe(false);
    expect(isNextDisabled(false, false)).toBe(true);
  });
});
