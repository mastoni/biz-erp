import { describe, it, expect } from 'vitest';
import { canAccessTenant, type ScopeState } from '../scope';

describe('V1.1-A Tenant Auth Foundation Flow', () => {
  describe('Tenant Context & Routing Invariants', () => {
    it('Single tenant session resolves to valid tenant scope with business UUID and role', () => {
      const singleTenantSession: ScopeState = {
        scope: 'tenant',
        role: 'OWNER',
        platformRole: null,
        business: {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'Toko Utama',
        },
      };

      expect(canAccessTenant(singleTenantSession)).toBe(true);
      expect(singleTenantSession.business?.id).toBe('11111111-1111-1111-1111-111111111111');
      expect(singleTenantSession.role).toBe('OWNER');
    });

    it('Multi-tenant user requires explicit business selection before gaining tenant access', () => {
      // Before business selection, business context is null
      const preSelectionState: ScopeState = {
        scope: 'tenant',
        role: null,
        platformRole: null,
        business: null,
      };

      expect(canAccessTenant(preSelectionState)).toBe(false);

      // After user selects tenant '22222222-2222-2222-2222-222222222222'
      const postSelectionState: ScopeState = {
        scope: 'tenant',
        role: 'CASHIER',
        platformRole: null,
        business: {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'Cabang Kedua',
        },
      };

      expect(canAccessTenant(postSelectionState)).toBe(true);
      expect(postSelectionState.business?.id).toBe('22222222-2222-2222-2222-222222222222');
      expect(postSelectionState.role).toBe('CASHIER');
    });

    it('Zero-tenant account is rejected from entering tenant context (Empty State)', () => {
      const zeroTenantState: ScopeState = {
        scope: null,
        role: null,
        platformRole: null,
        business: null,
      };

      expect(canAccessTenant(zeroTenantState)).toBe(false);
    });

    it('Platform scope session is denied access to tenant workspace', () => {
      const platformAdminSession: ScopeState = {
        scope: 'platform',
        role: null,
        platformRole: 'PLATFORM_ADMIN',
        business: null,
      };

      expect(canAccessTenant(platformAdminSession)).toBe(false);
    });
  });
});
