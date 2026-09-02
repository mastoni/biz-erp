import { describe, it, expect } from 'vitest';
import { canAccessTenant, canAccessPlatform, ScopeState } from '@/features/auth/scope';

describe('Phase 4.1.5: Application Shell Scope Guards (SHELL-008..009)', () => {
  const mockBusiness = {
    id: '12345678-1234-4234-8234-1234567890ab',
    name: 'PT Maju Bersama',
    status: 'ACTIVE',
  };

  describe('SHELL-008: Tenant Scope Guard & Platform Token Blocking', () => {
    it('grants access to valid tenant session with business context', () => {
      const ownerState: ScopeState = {
        scope: 'tenant',
        role: 'OWNER',
        platformRole: null,
        business: mockBusiness,
      };

      const cashierState: ScopeState = {
        scope: 'tenant',
        role: 'CASHIER',
        platformRole: null,
        business: mockBusiness,
      };

      expect(canAccessTenant(ownerState)).toBe(true);
      expect(canAccessTenant(cashierState)).toBe(true);
      expect(canAccessTenant(ownerState, ['OWNER'])).toBe(true);
      expect(canAccessTenant(cashierState, ['OWNER'])).toBe(false);
      expect(canAccessTenant(cashierState, ['CASHIER'])).toBe(true);
    });

    it('strictly blocks platform sessions (PLATFORM_ADMIN / SUPER_ADMIN) from tenant routes', () => {
      const platformAdminState: ScopeState = {
        scope: 'platform',
        role: null,
        platformRole: 'PLATFORM_ADMIN',
        business: null,
      };

      const superAdminState: ScopeState = {
        scope: 'platform',
        role: null,
        platformRole: 'SUPER_ADMIN',
        business: null,
      };

      expect(canAccessTenant(platformAdminState)).toBe(false);
      expect(canAccessTenant(superAdminState)).toBe(false);
    });

    it('blocks tenant sessions with missing business context or null scope', () => {
      const missingBizState: ScopeState = {
        scope: 'tenant',
        role: 'OWNER',
        platformRole: null,
        business: null,
      };

      const unauthState: ScopeState = {
        scope: null,
        role: null,
        platformRole: null,
        business: null,
      };

      expect(canAccessTenant(missingBizState)).toBe(false);
      expect(canAccessTenant(unauthState)).toBe(false);
    });
  });

  describe('SHELL-009: Platform Scope Guard & Tenant Token Blocking', () => {
    it('grants access to valid platform session', () => {
      const platformAdminState: ScopeState = {
        scope: 'platform',
        role: null,
        platformRole: 'PLATFORM_ADMIN',
        business: null,
      };

      const superAdminState: ScopeState = {
        scope: 'platform',
        role: null,
        platformRole: 'SUPER_ADMIN',
        business: null,
      };

      expect(canAccessPlatform(platformAdminState)).toBe(true);
      expect(canAccessPlatform(superAdminState)).toBe(true);
      expect(canAccessPlatform(superAdminState, ['SUPER_ADMIN'])).toBe(true);
      expect(canAccessPlatform(platformAdminState, ['SUPER_ADMIN'])).toBe(false);
    });

    it('strictly blocks tenant sessions (OWNER / CASHIER) from platform routes', () => {
      const ownerState: ScopeState = {
        scope: 'tenant',
        role: 'OWNER',
        platformRole: null,
        business: mockBusiness,
      };

      const cashierState: ScopeState = {
        scope: 'tenant',
        role: 'CASHIER',
        platformRole: null,
        business: mockBusiness,
      };

      expect(canAccessPlatform(ownerState)).toBe(false);
      expect(canAccessPlatform(cashierState)).toBe(false);
    });
  });
});
