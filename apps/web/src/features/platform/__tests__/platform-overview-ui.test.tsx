/**
 * Super Admin — Platform Overview UI & Acceptance Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { PlatformKPICards } from '../components/PlatformKPICards';
import { PlatformDistributions } from '../components/PlatformDistributions';
import { PlatformQuickNav } from '../components/PlatformQuickNav';
import { PlatformSchemaViewer } from '../components/PlatformSchemaViewer';
import type {
  PlatformOverviewKPIs,
  PlanDistributionItem,
  SubscriptionStatusDistributionItem,
} from '../types';

describe('SUPER ADMIN — Platform Overview UI Tests', () => {
  const sampleKPIs: PlatformOverviewKPIs = {
    total_businesses: 12,
    active_subscriptions: 10,
    estimated_mrr_minor: 4500000,
    total_plans: 3,
    total_modules: 8,
  };

  const samplePlanDistribution: PlanDistributionItem[] = [
    { plan_code: 'starter', plan_name: 'Starter Retail', count: 6, color: '#35657f' },
    { plan_code: 'pro', plan_name: 'Pro Business', count: 3, color: '#17593e' },
    { plan_code: 'enterprise', plan_name: 'Enterprise Multi-Branch', count: 1, color: '#d3921f' },
  ];

  const sampleStatusDistribution: SubscriptionStatusDistributionItem[] = [
    { status: 'active', label: 'Aktif', count: 8, tone: 'pine' },
    { status: 'trial', label: 'Masa Uji Coba (Trial)', count: 2, tone: 'tide' },
    { status: 'suspended', label: 'Ditangguhkan', count: 1, tone: 'clay' },
    { status: 'other', label: 'Lainnya', count: 0, tone: 'fog' },
  ];

  it('SA-UI-001: renders 4 Platform KPI Cards with correct labels and formatted metrics', () => {
    const html = renderToString(
      <PlatformKPICards kpis={sampleKPIs} loading={false} />
    );

    expect(html).toContain('Bisnis Terdaftar');
    expect(html).toContain('12');
    expect(html).toContain('Langganan Aktif');
    expect(html).toContain('10');
    expect(html).toContain('Estimasi MRR');
    expect(html).toContain('Katalog Paket &amp; Modul');
    expect(html).toContain('3 Paket · 8 Modul');
  });

  it('SA-UI-002: renders Plan and Status Distributions correctly', () => {
    const html = renderToString(
      <PlatformDistributions
        planDistribution={samplePlanDistribution}
        statusDistribution={sampleStatusDistribution}
        loading={false}
      />
    );

    expect(html).toContain('Distribusi Paket Langganan');
    expect(html).toContain('Starter Retail');
    expect(html).toContain('Pro Business');
    expect(html).toContain('Enterprise Multi-Branch');
    expect(html).toContain('Status Operasional Tenant');
    expect(html).toContain('Aktif');
    expect(html).toContain('Masa Uji Coba (Trial)');
  });

  it('SA-UI-003: renders Platform Quick Navigation to all sub-modules', () => {
    const html = renderToString(<PlatformQuickNav />);

    expect(html).toContain('Manajemen Bisnis');
    expect(html).toContain('/platform/businesses');
    expect(html).toContain('Katalog Modul');
    expect(html).toContain('/platform/modules');
    expect(html).toContain('Paket Langganan');
    expect(html).toContain('/platform/plans');
    expect(html).toContain('Bundle Solusi');
    expect(html).toContain('/platform/bundles');
    expect(html).toContain('Langganan Aktif');
    expect(html).toContain('/platform/subscriptions');
  });

  it('SA-UI-004: renders Canonical Schema Architecture component', () => {
    const html = renderToString(<PlatformSchemaViewer />);

    expect(html).toContain('Arsitektur Basis Data Canonical');
    expect(html).toContain('Topologi partisi multi-tenant &amp; buku besar double-entry');
  });

  it('SA-UI-005: handles loading state properly in KPI cards and distributions', () => {
    const html = renderToString(
      <div>
        <PlatformKPICards kpis={sampleKPIs} loading={true} />
        <PlatformDistributions
          planDistribution={samplePlanDistribution}
          statusDistribution={sampleStatusDistribution}
          loading={true}
        />
      </div>
    );

    expect(html).toContain('animate-pulse');
  });
});
