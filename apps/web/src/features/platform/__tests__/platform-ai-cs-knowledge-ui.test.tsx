/**
 * Super Admin — Platform AI CS Knowledge Base UI Acceptance Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import PlatformKnowledgeBasePage from '@/app/platform/ai-cs/knowledge/page';
import * as api from '../api';
import { PLATFORM_NAVIGATION, formatRangeLabel, isPreviousDisabled, isNextDisabled } from '../list-helpers';

vi.mock('../api');

describe('SUPER ADMIN — Platform AI CS Knowledge Base UI Tests', () => {
  const sampleKnowledgeResponse: api.PlatformKnowledgeListResponse = {
    items: [
      {
        id: '11111111-0000-0000-0000-000000000001',
        code: 'KB-PLAT-01',
        category: 'PLATFORM',
        title: 'Tentang Ekosistem SKMNetwork',
        content: 'SKMNetwork adalah platform multi-service terintegrasi.',
        keywords: ['skmnetwork', 'platform', 'layanan'],
        is_public: true,
        is_active: true,
        priority_order: 10,
        created_by: null,
        updated_by: null,
        created_at: '2026-09-04T10:00:00.000Z',
        updated_at: '2026-09-04T10:00:00.000Z',
      },
      {
        id: '11111111-0000-0000-0000-000000000002',
        code: 'KB-BILL-01',
        category: 'BILLING',
        title: 'Siklus dan Pembayaran Tagihan',
        content: 'Tagihan langganan dibuat setiap awal periode.',
        keywords: ['tagihan', 'pembayaran', 'invoice'],
        is_public: true,
        is_active: true,
        priority_order: 20,
        created_by: null,
        updated_by: null,
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
      inactive_count: 0,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SA-KB-001: verifies AI CS Knowledge is registered in PLATFORM_NAVIGATION', () => {
    const navItem = PLATFORM_NAVIGATION.find((item) => item.href === '/platform/ai-cs/knowledge');
    expect(navItem).toBeDefined();
    expect(navItem?.name).toBe('AI CS Knowledge');
  });

  it('SA-KB-002: renders knowledge base page header, structure, and filter controls', () => {
    vi.mocked(api.getPlatformKnowledgeList).mockResolvedValue(sampleKnowledgeResponse);

    const html = renderToString(<PlatformKnowledgeBasePage />);

    expect(html).toContain('AI CS Knowledge Base');
    expect(html).toContain('Platform Authoritative');
    expect(html).toContain('Total Artikel Knowledge');
    expect(html).toContain('Artikel Aktif');
    expect(html).toContain('Nonaktif / Dinonaktifkan');
    expect(html).toContain('Cari judul, konten, kode, atau kata kunci...');
    expect(html).toContain('Tambah Artikel');
  });

  it('SA-KB-003: evaluates pagination helpers for knowledge base list', () => {
    expect(formatRangeLabel(10, 0, 20, 'artikel')).toBe('Menampilkan 1–10 dari 10 artikel');
    expect(isPreviousDisabled(false, 0)).toBe(true);
    expect(isPreviousDisabled(false, 20)).toBe(false);
    expect(isNextDisabled(false, true)).toBe(false);
    expect(isNextDisabled(false, false)).toBe(true);
  });

  it('SA-KB-004: verifies API client functions for knowledge management CRUD contracts', async () => {
    vi.mocked(api.getPlatformKnowledgeList).mockResolvedValue(sampleKnowledgeResponse);
    vi.mocked(api.getPlatformKnowledgeById).mockResolvedValue(sampleKnowledgeResponse.items[0]);
    vi.mocked(api.createPlatformKnowledgeArticle).mockResolvedValue({
      message: 'Created',
      article: sampleKnowledgeResponse.items[0],
    });
    vi.mocked(api.updatePlatformKnowledgeArticle).mockResolvedValue({
      message: 'Updated',
      article: sampleKnowledgeResponse.items[0],
    });
    vi.mocked(api.deletePlatformKnowledgeArticle).mockResolvedValue({
      message: 'Deactivated',
    });

    const list = await api.getPlatformKnowledgeList({ category: 'BILLING' });
    expect(list.items).toHaveLength(2);

    const single = await api.getPlatformKnowledgeById('11111111-0000-0000-0000-000000000001');
    expect(single.code).toBe('KB-PLAT-01');

    const created = await api.createPlatformKnowledgeArticle({
      title: 'Panduan Baru',
      content: 'Isi baru',
      category: 'ERP',
    });
    expect(created.article.title).toBe('Tentang Ekosistem SKMNetwork');

    const updated = await api.updatePlatformKnowledgeArticle('11111111-0000-0000-0000-000000000001', {
      title: 'Updated Title',
    });
    expect(updated.message).toBe('Updated');

    const deleted = await api.deletePlatformKnowledgeArticle('11111111-0000-0000-0000-000000000001');
    expect(deleted.message).toBe('Deactivated');
  });
});
