import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  PLATFORM_NAVIGATION,
  getPlatformRoleLabel,
  getPlatformContextDisplay,
  getPaginationRange,
  formatRangeLabel,
  isPreviousDisabled,
  isNextDisabled,
  shouldShowSkeleton,
  shouldShowError,
  shouldShowEmpty,
  shouldShowTable,
  formatPlatformDate,
  formatCurrency,
  formatNullable,
  PLATFORM_PAGE_SIZE,
} from '../list-helpers';
import type { PlatformBusiness, PlatformModule, PlatformPlan, PlatformBundle, PlatformSubscription } from '../types';
import type { ScopeState } from '../../auth/scope';
import { canAccessPlatform } from '../../auth/scope';

// ── Scope / guard states ───────────────────────────────────────────────────

const platformAdmin: ScopeState = {
  scope: 'platform',
  role: null,
  platformRole: 'PLATFORM_ADMIN',
  business: null,
};

const superAdmin: ScopeState = {
  scope: 'platform',
  role: null,
  platformRole: 'SUPER_ADMIN',
  business: null,
};

const owner: ScopeState = {
  scope: 'tenant',
  role: 'OWNER',
  platformRole: null,
  business: { id: 'b1', name: 'Biz' },
};

const cashier: ScopeState = {
  scope: 'tenant',
  role: 'CASHIER',
  platformRole: null,
  business: { id: 'b1', name: 'Biz' },
};

const unauthenticated: ScopeState = {
  scope: null,
  role: null,
  platformRole: null,
  business: null,
};

describe('41C-2 platform shell guard', () => {
  it('platform layout admits platform sessions (PLATFORM_ADMIN / SUPER_ADMIN)', () => {
    expect(canAccessPlatform(platformAdmin)).toBe(true);
    expect(canAccessPlatform(superAdmin)).toBe(true);
  });

  it('tenant session rejected by PlatformGuard', () => {
    expect(canAccessPlatform(unauthenticated)).toBe(false);
  });

  it('OWNER rejected by PlatformGuard', () => {
    expect(canAccessPlatform(owner)).toBe(false);
  });

  it('CASHIER rejected by PlatformGuard', () => {
    expect(canAccessPlatform(cashier)).toBe(false);
  });
});

// ── Navigation ───────────────────────────────────────────────────────────────

describe('41C-2 platform navigation', () => {
  it('platform nav entries exist', () => {
    const hrefs = PLATFORM_NAVIGATION.map((n) => n.href);
    expect(hrefs).toContain('/platform');
    expect(hrefs).toContain('/platform/businesses');
    expect(hrefs).toContain('/platform/modules');
    expect(hrefs).toContain('/platform/plans');
    expect(hrefs).toContain('/platform/bundles');
    expect(hrefs).toContain('/platform/subscriptions');
  });

  it('does NOT duplicate tenant navigation and excludes Account Customers', () => {
    const hrefs = PLATFORM_NAVIGATION.map((n) => n.href);
    // No tenant routes leaked into the platform shell.
    expect(hrefs).not.toContain('/dashboard');
    expect(hrefs).not.toContain('/products');
    expect(hrefs).not.toContain('/customers');
    // Account Customers is owned by 40F and must not exist here.
    expect(hrefs.some((h) => h.toLowerCase().includes('account-customer'))).toBe(false);
    expect(hrefs).not.toContain('/platform/account-customers');
  });
});

// ── Account Customers route absence (filesystem) ─────────────────────────────

describe('41C-2 Account Customers route', () => {
  it('no /platform/account-customers page is created', () => {
    const target = join(process.cwd(), 'src', 'app', 'platform', 'account-customers');
    expect(existsSync(target)).toBe(false);
  });
});

// ── Context page ─────────────────────────────────────────────────────────────

describe('41C-2 context page', () => {
  it('maps platform context to display fields', () => {
    const adminDisplay = getPlatformContextDisplay({
      scope: 'platform',
      role: 'PLATFORM_ADMIN',
      userId: 'u-1',
      businessId: null,
    });
    expect(adminDisplay.scope).toBe('platform');
    expect(adminDisplay.roleLabel).toBe('Platform Admin');

    const superDisplay = getPlatformContextDisplay({
      scope: 'platform',
      role: 'SUPER_ADMIN',
      userId: 'u-2',
      businessId: null,
    });
    expect(superDisplay.roleLabel).toBe('Super Admin');
  });

  it('role label helper distinguishes platform roles', () => {
    expect(getPlatformRoleLabel('PLATFORM_ADMIN')).toBe('Platform Admin');
    expect(getPlatformRoleLabel('SUPER_ADMIN')).toBe('Super Admin');
  });
});

// ── List page states (businesses / modules / plans / bundles / subscriptions) ─

const sampleData = {
  businesses: [{ id: 'b1', name: 'Biz', created_at: '2026-01-01T00:00:00Z' }] as PlatformBusiness[],
  modules: [
    { code: 'm1', name: 'M', pillar: null, category: null, is_core: true, status: 'ACTIVE', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  ] as PlatformModule[],
  plans: [
    { code: 'p1', name: 'P', family: null, tier: null, billing_cycle: null, type: null, status: 'ACTIVE', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  ] as PlatformPlan[],
  bundles: [
    { code: 'bb1', name: 'B', target_segment: null, installation_required: false, status: 'ACTIVE', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  ] as PlatformBundle[],
  subscriptions: [
    { id: 's1', business_id: 'b1', account_customer_id: null, plan_code: 'p1', plan_family: null, family_code: null, source: null, status: 'ACTIVE', starts_at: null, ends_at: null, billing_cycle: null, final_price: 100, currency: 'USD', created_at: '2026-01-01T00:00:00Z' },
  ] as PlatformSubscription[],
};

describe('41C-2 list page states', () => {
  const pages: Array<[string, unknown[]]> = [
    ['businesses', sampleData.businesses],
    ['modules', sampleData.modules],
    ['plans', sampleData.plans],
    ['bundles', sampleData.bundles],
    ['subscriptions', sampleData.subscriptions],
  ];

  for (const [name, rows] of pages) {
    it(`${name} shows loading skeleton while loading`, () => {
      expect(shouldShowSkeleton(true)).toBe(true);
      expect(shouldShowSkeleton(false)).toBe(false);
    });

    it(`${name} shows error state on failure`, () => {
      expect(shouldShowError(false, 'boom')).toBe(true);
      expect(shouldShowError(false, null)).toBe(false);
      expect(shouldShowError(true, 'boom')).toBe(false);
    });

    it(`${name} shows empty state when no rows`, () => {
      expect(shouldShowEmpty(false, null, 0)).toBe(true);
      expect(shouldShowEmpty(false, null, rows.length)).toBe(rows.length === 0);
    });

    it(`${name} shows table when rows present`, () => {
      expect(shouldShowTable(false, null, rows.length)).toBe(rows.length > 0);
      expect(shouldShowTable(true, null, rows.length)).toBe(false);
      expect(shouldShowTable(false, 'err', rows.length)).toBe(false);
    });
  }
});

// ── Pagination helper behavior ───────────────────────────────────────────────

describe('41C-2 pagination helpers', () => {
  it('getPaginationRange is 1-based and clamped', () => {
    expect(getPaginationRange(42, 0, PLATFORM_PAGE_SIZE)).toEqual({ start: 1, end: 20 });
    expect(getPaginationRange(42, 20, PLATFORM_PAGE_SIZE)).toEqual({ start: 21, end: 40 });
    expect(getPaginationRange(42, 40, PLATFORM_PAGE_SIZE)).toEqual({ start: 41, end: 42 });
    expect(getPaginationRange(0, 0, PLATFORM_PAGE_SIZE)).toEqual({ start: 0, end: 0 });
  });

  it('formatRangeLabel renders "Menampilkan X–Y dari Z noun"', () => {
    expect(formatRangeLabel(42, 0, PLATFORM_PAGE_SIZE, 'bisnis')).toBe('Menampilkan 1–20 dari 42 bisnis');
  });

  it('previous disabled at first page or while loading', () => {
    expect(isPreviousDisabled(false, 0)).toBe(true);
    expect(isPreviousDisabled(false, 20)).toBe(false);
    expect(isPreviousDisabled(true, 20)).toBe(true);
  });

  it('next disabled while loading or without more pages', () => {
    expect(isNextDisabled(false, true)).toBe(false);
    expect(isNextDisabled(false, false)).toBe(true);
    expect(isNextDisabled(true, true)).toBe(true);
  });

  it('PLATFORM_PAGE_SIZE is within backend range (1-200)', () => {
    expect(PLATFORM_PAGE_SIZE).toBeGreaterThanOrEqual(1);
    expect(PLATFORM_PAGE_SIZE).toBeLessThanOrEqual(200);
  });
});

// ── Formatting helpers ───────────────────────────────────────────────────────

describe('41C-2 formatting', () => {
  it('formatNullable renders placeholder for null and Ya/Tidak for booleans', () => {
    expect(formatNullable(null)).toBe('-');
    expect(formatNullable(true)).toBe('Ya');
    expect(formatNullable(false)).toBe('Tidak');
    expect(formatNullable('x')).toBe('x');
  });

  it('formatCurrency uses id-ID currency formatting', () => {
    expect(formatCurrency(100, 'USD')).toContain('100');
    expect(formatCurrency(null, 'USD')).toBe('-');
  });

  it('formatPlatformDate is deterministic and non-empty', () => {
    const out = formatPlatformDate('2026-01-05T14:30:00.000Z');
    expect(out.length).toBeGreaterThan(0);
    expect(out).toBe(formatPlatformDate('2026-01-05T14:30:00.000Z'));
  });
});
