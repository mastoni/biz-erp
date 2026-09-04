/**
 * Super Admin — Platform Audit & Observability UI Acceptance Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import PlatformAuditPage from '@/app/platform/audit/page';
import * as api from '../api';
import {
  PLATFORM_NAVIGATION,
  formatRangeLabel,
  isPreviousDisabled,
  isNextDisabled,
  maskSensitivePayload,
} from '../list-helpers';

vi.mock('../api');

describe('SUPER ADMIN — Platform Audit & Observability UI Tests', () => {
  const sampleAuditResponse: api.PlatformAuditLogsResponse = {
    items: [
      {
        id: '99000000-0000-0000-0000-000000000001',
        actor_id: '33000000-0000-0000-0000-000000000001',
        actor_email: 'superadmin@observability.com',
        actor_scope: 'platform',
        actor_role: 'SUPER_ADMIN',
        action: 'SERVICE_UPDATE',
        service_code: 'ISP_MANAGEMENT',
        target_type: 'service',
        target_id: 'ISP_MANAGEMENT',
        before_state: { lifecycle_status: 'DRAFT' },
        after_state: { lifecycle_status: 'ACTIVE' },
        diff: { lifecycle_status: { from: 'DRAFT', to: 'ACTIVE' } },
        request_id: 'req-test-1234',
        ip_address: '127.0.0.1',
        user_agent: 'Vitest/Agent',
        status: 'SUCCESS',
        error_message: null,
        metadata: { reason: 'Commercial release' },
        created_at: '2026-09-04T10:00:00.000Z',
      },
      {
        id: '99000000-0000-0000-0000-000000000002',
        actor_id: '33000000-0000-0000-0000-000000000001',
        actor_email: 'superadmin@observability.com',
        actor_scope: 'platform',
        actor_role: 'SUPER_ADMIN',
        action: 'BUSINESS_APPROVE',
        service_code: 'ERP',
        target_type: 'business',
        target_id: '11000000-0000-0000-0000-000000000001',
        before_state: { status: 'PENDING_REVIEW' },
        after_state: { status: 'ACTIVE' },
        diff: { status: { from: 'PENDING_REVIEW', to: 'ACTIVE' } },
        request_id: 'req-test-5678',
        ip_address: '127.0.0.1',
        user_agent: 'Vitest/Agent',
        status: 'SUCCESS',
        error_message: null,
        metadata: {},
        created_at: '2026-09-04T12:00:00.000Z',
      },
    ],
    total: 2,
    limit: 20,
    offset: 0,
    has_more: false,
    summary: {
      total: 2,
      success_count: 2,
      failure_count: 0,
    },
  };

  it('SA-AUD-001: renders audit logs page structure, KPIs, and search/filter controls', () => {
    vi.mocked(api.getPlatformAuditLogs).mockResolvedValue(sampleAuditResponse);

    const html = renderToString(<PlatformAuditPage />);

    expect(html).toContain('Audit Logs &amp; Observability');
    expect(html).toContain('Total Log Audit');
    expect(html).toContain('Operasi Berhasil');
    expect(html).toContain('Operasi Gagal / Anomali');
    expect(html).toContain('Cari aksi, tipe target, email actor, ID target, atau ID request...');
    expect(html).toContain('Semua Status');
    expect(html).toContain('Semua Cakupan (Scope)');
  });

  it('SA-AUD-002: verifies PLATFORM_NAVIGATION contains Audit Logs entry', () => {
    const auditNav = PLATFORM_NAVIGATION.find((item) => item.href === '/platform/audit');
    expect(auditNav).toBeDefined();
    expect(auditNav?.name).toBe('Audit Logs');
  });

  it('SA-AUD-003: formatRangeLabel formats audit pagination correctly', () => {
    const label = formatRangeLabel(50, 0, 20, 'log audit');
    expect(label).toBe('Menampilkan 1–20 dari 50 log audit');
  });

  it('SA-AUD-004: evaluates pagination boundaries for audit list', () => {
    expect(isPreviousDisabled(false, 0)).toBe(true);
    expect(isPreviousDisabled(false, 20)).toBe(false);
    expect(isNextDisabled(false, true)).toBe(false);
    expect(isNextDisabled(false, false)).toBe(true);
  });

  it('SA-AUD-005: maskSensitivePayload redacts passwords, tokens, API keys and JWTs', () => {
    const rawPayload = {
      user_id: 'user-123',
      password: 'superSecretPassword',
      api_key: 'sk_live_12345678',
      auth_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M',
      nested: {
        secret_key: 'my-private-key',
        public_name: 'Visible User',
      },
    };

    const masked = maskSensitivePayload(rawPayload) as any;

    expect(masked.user_id).toBe('user-123');
    expect(masked.password).toBe('[REDACTED]');
    expect(masked.api_key).toBe('[REDACTED]');
    expect(masked.auth_token).toBe('[REDACTED]');
    expect(masked.nested.secret_key).toBe('[REDACTED]');
    expect(masked.nested.public_name).toBe('Visible User');
  });
});
