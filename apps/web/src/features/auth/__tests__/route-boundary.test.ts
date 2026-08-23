import { describe, it, expect } from 'vitest';
import { getAuthorizedNavigation, canAccessRoute, Role } from '../../../lib/rbac';
import { PLATFORM_NAVIGATION } from '../../platform/list-helpers';
import type { ScopeState } from '../scope';
import { canAccessTenant, canAccessPlatform } from '../scope';

/**
 * 41C-4 Route & Navigation boundary regression matrix.
 *
 * The tenant shell (app/(authenticated)/layout.tsx) gates on `TenantGuard`
 * (canAccessTenant) and the platform shell (app/platform/layout.tsx) gates on
 * `PlatformGuard` (canAccessPlatform). Both helpers derive the decision purely
 * from the authenticated session scope/role — never from the URL. These tests
 * lock that boundary so a future change cannot reintroduce cross-context access.
 */

function makeState(p: Partial<ScopeState>): ScopeState {
  return {
    scope: null,
    role: null,
    platformRole: null,
    business: null,
    ...p,
  };
}

const unauthenticated = makeState({}); // mirrors UNAUTHENTICATED/SESSION_EXPIRED state
const sessionExpired = makeState({}); // AuthContext SESSION_EXPIRED_STATE has scope: null
const ownerTenant = makeState({ scope: 'tenant', role: 'OWNER', business: { id: 'b1', name: 'Biz' } });
const cashierTenant = makeState({ scope: 'tenant', role: 'CASHIER', business: { id: 'b1', name: 'Biz' } });
const ownerNoBusiness = makeState({ scope: 'tenant', role: 'OWNER' });
const platformAdmin = makeState({ scope: 'platform', platformRole: 'PLATFORM_ADMIN' });
const superAdmin = makeState({ scope: 'platform', platformRole: 'SUPER_ADMIN' });

describe('41C-4 route matrix — authentication', () => {
  it('R-001 unauthenticated → tenant route denied', () => {
    expect(canAccessTenant(unauthenticated)).toBe(false);
  });

  it('R-002 unauthenticated → platform route denied', () => {
    expect(canAccessPlatform(unauthenticated)).toBe(false);
  });

  it('R-012 session-expired → both tenant and platform denied', () => {
    expect(canAccessTenant(sessionExpired)).toBe(false);
    expect(canAccessPlatform(sessionExpired)).toBe(false);
  });
});

describe('41C-4 route matrix — tenant sessions', () => {
  it('R-003 OWNER → tenant route allowed', () => {
    expect(canAccessTenant(ownerTenant)).toBe(true);
  });

  it('R-004 CASHIER → tenant route allowed', () => {
    expect(canAccessTenant(cashierTenant)).toBe(true);
  });

  it('tenant session without business context denied', () => {
    expect(canAccessTenant(ownerNoBusiness)).toBe(false);
  });

  it('R-005 OWNER → platform route denied', () => {
    expect(canAccessPlatform(ownerTenant)).toBe(false);
  });

  it('R-006 CASHIER → platform route denied', () => {
    expect(canAccessPlatform(cashierTenant)).toBe(false);
  });
});

describe('41C-4 route matrix — platform sessions', () => {
  it('R-007 PLATFORM_ADMIN → platform route allowed', () => {
    expect(canAccessPlatform(platformAdmin)).toBe(true);
  });

  it('R-008 SUPER_ADMIN → platform route allowed', () => {
    expect(canAccessPlatform(superAdmin)).toBe(true);
  });

  it('R-009 PLATFORM_ADMIN → tenant route denied', () => {
    expect(canAccessTenant(platformAdmin)).toBe(false);
  });

  it('R-010 SUPER_ADMIN → tenant route denied', () => {
    expect(canAccessTenant(superAdmin)).toBe(false);
  });
});

describe('41C-4 direct URL access (R-011)', () => {
  it('decisions depend only on session scope, not entry method', () => {
    // Reaching /platform via direct URL vs sidebar yields the same verdict.
    expect(canAccessPlatform(platformAdmin)).toBe(true); // admitted either way
    expect(canAccessPlatform(ownerTenant)).toBe(false); // denied either way
    expect(canAccessTenant(ownerTenant)).toBe(true); // tenant direct URL allowed
    expect(canAccessTenant(platformAdmin)).toBe(false); // platform direct URL denied
  });
});

describe('41C-4 tenant-internal role boundary (audit item 5)', () => {
  it('CASHIER cannot reach OWNER-only tenant routes', () => {
    expect(canAccessRoute('CASHIER' as Role, '/users')).toBe(false);
    expect(canAccessRoute('CASHIER' as Role, '/products')).toBe(false);
    expect(canAccessRoute('CASHIER' as Role, '/sales')).toBe(false);
  });

  it('OWNER can reach OWNER-only tenant routes', () => {
    expect(canAccessRoute('OWNER' as Role, '/users')).toBe(true);
    expect(canAccessRoute('OWNER' as Role, '/products')).toBe(true);
  });
});

describe('41C-4 navigation isolation', () => {
  it('R-013 tenant navigation excludes platform sections', () => {
    for (const role of ['OWNER', 'CASHIER'] as Role[]) {
      const hrefs = getAuthorizedNavigation(role).map((i) => i.href);
      for (const href of hrefs) {
        expect(href.startsWith('/platform')).toBe(false);
      }
      expect(hrefs).not.toContain('/platform');
      expect(hrefs).not.toContain('/platform/businesses');
      expect(hrefs).not.toContain('/platform/modules');
    }
  });

  it('R-014 platform navigation excludes tenant-only items', () => {
    const hrefs = PLATFORM_NAVIGATION.map((i) => i.href);
    const tenantOnly = ['/dashboard', '/products', '/users', '/sales', '/customers', '/inventory', '/reports'];
    for (const t of tenantOnly) {
      expect(hrefs).not.toContain(t);
    }
    // Platform nav must never carry a tenant route prefix either.
    for (const href of hrefs) {
      expect(href.startsWith('/dashboard')).toBe(false);
      expect(href.startsWith('/products')).toBe(false);
      expect(href.startsWith('/customers')).toBe(false);
    }
  });
});
