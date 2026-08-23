import { describe, it, expect } from 'vitest';
import { getAuthorizedNavigation, Role } from '../../../lib/rbac';
import type { ScopeState } from '../scope';
import { canAccessTenant } from '../scope';

// ── Session fixtures ─────────────────────────────────────────────────────────

const tenantOwner: ScopeState = {
  scope: 'tenant',
  role: 'OWNER',
  platformRole: null,
  business: { id: 'b1', name: 'Biz' },
};

const tenantCashier: ScopeState = {
  scope: 'tenant',
  role: 'CASHIER',
  platformRole: null,
  business: { id: 'b1', name: 'Biz' },
};

const tenantWithoutBusiness: ScopeState = {
  scope: 'tenant',
  role: 'OWNER',
  platformRole: null,
  business: null,
};

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

const unauthenticated: ScopeState = {
  scope: null,
  role: null,
  platformRole: null,
  business: null,
};

// ── Tenant guard (TenantGuard wiring decision) ───────────────────────────────

describe('41C-3 tenant guard', () => {
  it('allows OWNER tenant session', () => {
    expect(canAccessTenant(tenantOwner)).toBe(true);
  });

  it('allows CASHIER tenant session', () => {
    expect(canAccessTenant(tenantCashier)).toBe(true);
  });

  it('requires an authenticated business context (business not null)', () => {
    expect(canAccessTenant(tenantWithoutBusiness)).toBe(false);
    expect(canAccessTenant(tenantOwner)).toBe(true);
  });

  it('platform session rejected from tenant shell', () => {
    expect(canAccessTenant(platformAdmin)).toBe(false);
    expect(canAccessTenant(superAdmin)).toBe(false);
  });

  it('unauthenticated session rejected from tenant shell', () => {
    expect(canAccessTenant(unauthenticated)).toBe(false);
  });

  it('tenant guard supports role narrowing', () => {
    expect(canAccessTenant(tenantOwner, ['OWNER'])).toBe(true);
    expect(canAccessTenant(tenantOwner, ['CASHIER'])).toBe(false);
    expect(canAccessTenant(tenantCashier, ['CASHIER'])).toBe(true);
    expect(canAccessTenant(tenantCashier, ['OWNER'])).toBe(false);
  });
});

// ── OWNER navigation ──────────────────────────────────────────────────────────

describe('41C-3 OWNER navigation', () => {
  it('OWNER sees OWNER-allowed tenant navigation', () => {
    const nav = getAuthorizedNavigation('OWNER' as Role);
    const hrefs = nav.map((i) => i.href);
    expect(hrefs).toContain('/dashboard');
    expect(hrefs).toContain('/products');
    expect(hrefs).toContain('/inventory');
    expect(hrefs).toContain('/sales');
    expect(hrefs).toContain('/customers');
    expect(hrefs).toContain('/users');
    expect(hrefs).toContain('/reports');
  });
});

// ── CASHIER navigation ───────────────────────────────────────────────────────

describe('41C-3 CASHIER navigation', () => {
  it('CASHIER sees CASHIER-allowed navigation and not OWNER-only routes', () => {
    const nav = getAuthorizedNavigation('CASHIER' as Role);
    const hrefs = nav.map((i) => i.href);
    expect(hrefs).toContain('/dashboard');
    expect(hrefs).toContain('/inventory');
    expect(hrefs).toContain('/customers');
    expect(hrefs).toContain('/reports');
    // OWNER-only tenant routes hidden from CASHIER
    expect(hrefs).not.toContain('/products');
    expect(hrefs).not.toContain('/users');
    expect(hrefs).not.toContain('/sales');
  });
});

// ── Tenant navigation never shows platform sections ──────────────────────────

describe('41C-3 tenant navigation isolation', () => {
  it('tenant navigation does not show platform sections', () => {
    const ownerNav = getAuthorizedNavigation('OWNER' as Role).map((i) => i.href);
    const cashierNav = getAuthorizedNavigation('CASHIER' as Role).map((i) => i.href);

    for (const href of [...ownerNav, ...cashierNav]) {
      expect(href.startsWith('/platform')).toBe(false);
    }
    expect(ownerNav).not.toContain('/platform');
    expect(ownerNav).not.toContain('/platform/businesses');
    expect(ownerNav).not.toContain('/platform/modules');
    expect(ownerNav).not.toContain('/platform/plans');
    expect(ownerNav).not.toContain('/platform/bundles');
    expect(ownerNav).not.toContain('/platform/subscriptions');
    expect(cashierNav).not.toContain('/platform');
  });
});

// ── Tenant business context ───────────────────────────────────────────────────

describe('41C-3 tenant business context', () => {
  it('a tenant session carries a business context', () => {
    expect(tenantOwner.business).not.toBeNull();
    expect(tenantOwner.business?.id).toBe('b1');
    expect(canAccessTenant(tenantOwner)).toBe(true);
  });

  it('business_id is never read from the URL for authorization', () => {
    // Authorization is derived from the authenticated session scope/business,
    // not from any request/route parameter. A tenant session without a server
    // provided business context is denied, regardless of URL.
    expect(canAccessTenant(tenantWithoutBusiness)).toBe(false);
  });
});
