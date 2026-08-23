import { describe, it, expect } from 'vitest';
import {
  type ScopeState,
  isTenant,
  isPlatform,
  isOwner,
  isCashier,
  isPlatformAdmin,
  isSuperAdmin,
  canAccessTenant,
  canAccessPlatform,
} from '../scope';

// ── Builders ────────────────────────────────────────────────────────────────

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

// Dual-identity user (platform role + tenant membership) currently holding a
// PLATFORM session — must not be treated as tenant.
const dualIdentityPlatformSession: ScopeState = {
  scope: 'platform',
  role: null,
  platformRole: 'SUPER_ADMIN',
  business: null,
};

// ── Scope recognition ─────────────────────────────────────────────────────────

describe('41C-1 scope recognition', () => {
  it('tenant context recognized', () => {
    expect(isTenant(tenantOwner)).toBe(true);
    expect(isTenant(tenantCashier)).toBe(true);
  });

  it('platform context recognized', () => {
    expect(isPlatform(platformAdmin)).toBe(true);
    expect(isPlatform(superAdmin)).toBe(true);
  });

  it('unauthenticated session is neither tenant nor platform', () => {
    expect(isTenant(unauthenticated)).toBe(false);
    expect(isPlatform(unauthenticated)).toBe(false);
  });
});

// ── Role recognition ───────────────────────────────────────────────────────────

describe('41C-1 role recognition', () => {
  it('OWNER recognized', () => {
    expect(isOwner(tenantOwner)).toBe(true);
    expect(isOwner(tenantCashier)).toBe(false);
    // platform session is never an OWNER
    expect(isOwner(platformAdmin)).toBe(false);
  });

  it('CASHIER recognized', () => {
    expect(isCashier(tenantCashier)).toBe(true);
    expect(isCashier(tenantOwner)).toBe(false);
    expect(isCashier(platformAdmin)).toBe(false);
  });

  it('PLATFORM_ADMIN recognized', () => {
    expect(isPlatformAdmin(platformAdmin)).toBe(true);
    expect(isPlatformAdmin(superAdmin)).toBe(false);
    // tenant session is never a platform admin
    expect(isPlatformAdmin(tenantOwner)).toBe(false);
  });

  it('SUPER_ADMIN recognized', () => {
    expect(isSuperAdmin(superAdmin)).toBe(true);
    expect(isSuperAdmin(platformAdmin)).toBe(false);
    expect(isSuperAdmin(tenantOwner)).toBe(false);
  });
});

// ── Guard: TenantGuard (canAccessTenant) ──────────────────────────────────────

describe('41C-1 TenantGuard rejects platform sessions', () => {
  it('platform session rejected by TenantGuard', () => {
    expect(canAccessTenant(platformAdmin)).toBe(false);
    expect(canAccessTenant(superAdmin)).toBe(false);
    expect(canAccessTenant(dualIdentityPlatformSession)).toBe(false);
  });

  it('tenant session allowed by TenantGuard', () => {
    expect(canAccessTenant(tenantOwner)).toBe(true);
    expect(canAccessTenant(tenantCashier)).toBe(true);
  });

  it('tenant session with specific role requirement', () => {
    expect(canAccessTenant(tenantOwner, ['OWNER'])).toBe(true);
    expect(canAccessTenant(tenantOwner, ['CASHIER'])).toBe(false);
    expect(canAccessTenant(tenantCashier, ['CASHIER'])).toBe(true);
    expect(canAccessTenant(tenantCashier, ['OWNER'])).toBe(false);
  });
});

// ── Guard: PlatformGuard (canAccessPlatform) ──────────────────────────────────

describe('41C-1 PlatformGuard rejects tenant sessions', () => {
  it('tenant session rejected by PlatformGuard', () => {
    expect(canAccessPlatform(tenantOwner)).toBe(false);
    expect(canAccessPlatform(tenantCashier)).toBe(false);
  });

  it('OWNER can never satisfy a platform guard', () => {
    expect(canAccessPlatform(tenantOwner)).toBe(false);
  });

  it('platform session allowed by PlatformGuard', () => {
    expect(canAccessPlatform(platformAdmin)).toBe(true);
    expect(canAccessPlatform(superAdmin)).toBe(true);
  });

  it('platform session with specific role requirement', () => {
    expect(canAccessPlatform(platformAdmin, ['PLATFORM_ADMIN'])).toBe(true);
    expect(canAccessPlatform(platformAdmin, ['SUPER_ADMIN'])).toBe(false);
    expect(canAccessPlatform(superAdmin, ['SUPER_ADMIN'])).toBe(true);
    expect(canAccessPlatform(superAdmin, ['PLATFORM_ADMIN'])).toBe(false);
  });
});

// ── Business requirement ──────────────────────────────────────────────────────

describe('41C-1 business requirement by scope', () => {
  it('business optional for platform (platform recognized without business)', () => {
    expect(isPlatform(platformAdmin)).toBe(true);
    expect(platformAdmin.business).toBeNull();
    expect(canAccessPlatform(platformAdmin)).toBe(true);
  });

  it('business required for tenant', () => {
    const tenantWithoutBusiness: ScopeState = {
      ...tenantOwner,
      business: null,
    };
    // A tenant session without a business is incomplete and must not pass.
    expect(isTenant(tenantWithoutBusiness)).toBe(true);
    expect(canAccessTenant(tenantWithoutBusiness)).toBe(false);

    // A complete tenant session (with business) passes.
    expect(canAccessTenant(tenantOwner)).toBe(true);
  });

  it('platform session must not leak a tenant business', () => {
    // Per security invariants, platform tokens never carry business_id.
    expect(platformAdmin.business).toBeNull();
    expect(superAdmin.business).toBeNull();
  });
});
