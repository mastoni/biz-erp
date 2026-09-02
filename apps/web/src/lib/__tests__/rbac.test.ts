import { describe, it, expect } from 'vitest';
import { canAccessRoute, getAuthorizedNavigation, ROUTE_PERMISSIONS, NAVIGATION_ITEMS } from '../rbac';

describe('Phase 4.1.5: Application Shell & RBAC Navigation (SHELL-001..007)', () => {
  describe('SHELL-001: OWNER route access across all canonical ERP routes', () => {
    it('grants OWNER access to all registered routes in ROUTE_PERMISSIONS', () => {
      const routes = Object.keys(ROUTE_PERMISSIONS);
      expect(routes.length).toBeGreaterThan(0);

      routes.forEach((route) => {
        expect(canAccessRoute('OWNER', route)).toBe(true);
      });
    });

    it('grants OWNER access to dynamic sub-paths of registered routes', () => {
      expect(canAccessRoute('OWNER', '/products/123-abc')).toBe(true);
      expect(canAccessRoute('OWNER', '/inventory/movements/filter?type=in')).toBe(true);
      expect(canAccessRoute('OWNER', '/sales/orders/create')).toBe(true);
    });
  });

  describe('SHELL-002: CASHIER route access to permitted operational routes', () => {
    it('allows CASHIER on operational cash register, pos, and shared routes', () => {
      const permittedRoutes = [
        '/dashboard',
        '/pos',
        '/inventory',
        '/purchases',
        '/customers',
        '/suppliers',
        '/finance',
        '/finance/bookkeeping',
        '/reports',
        '/settings',
      ];

      permittedRoutes.forEach((route) => {
        expect(canAccessRoute('CASHIER', route)).toBe(true);
      });
    });
  });

  describe('SHELL-003: CASHIER route access to restricted routes', () => {
    it('denies CASHIER access to restricted product management, movement history, sales, new customer creation, and user management', () => {
      const restrictedRoutes = [
        '/products',
        '/inventory/movements',
        '/inventory/adjustment',
        '/sales',
        '/customers/new',
        '/users',
      ];

      restrictedRoutes.forEach((route) => {
        expect(canAccessRoute('CASHIER', route)).toBe(false);
      });
    });
  });

  describe('SHELL-004: Longest-prefix child route resolution', () => {
    it('correctly evaluates /inventory (allowed for CASHIER) vs /inventory/movements (denied for CASHIER)', () => {
      // Base /inventory is allowed for CASHIER
      expect(canAccessRoute('CASHIER', '/inventory')).toBe(true);
      // Specific child route /inventory/movements is denied for CASHIER
      expect(canAccessRoute('CASHIER', '/inventory/movements')).toBe(false);
      expect(canAccessRoute('CASHIER', '/inventory/movements/export')).toBe(false);
      // Specific child route /inventory/adjustment is denied for CASHIER
      expect(canAccessRoute('CASHIER', '/inventory/adjustment')).toBe(false);
    });

    it('correctly evaluates /customers (allowed for CASHIER) vs /customers/new (denied for CASHIER)', () => {
      expect(canAccessRoute('CASHIER', '/customers')).toBe(true);
      expect(canAccessRoute('CASHIER', '/customers/new')).toBe(false);
    });
  });

  describe('SHELL-005: getAuthorizedNavigation for OWNER', () => {
    it('returns all navigation items for OWNER', () => {
      const nav = getAuthorizedNavigation('OWNER');
      expect(nav.length).toBe(NAVIGATION_ITEMS.length);
      expect(nav.map((item) => item.href)).toEqual(NAVIGATION_ITEMS.map((item) => item.href));
    });
  });

  describe('SHELL-006: getAuthorizedNavigation for CASHIER', () => {
    it('filters out restricted navigation items for CASHIER', () => {
      const nav = getAuthorizedNavigation('CASHIER');
      const hrefs = nav.map((item) => item.href);

      // Must include permitted items
      expect(hrefs).toContain('/dashboard');
      expect(hrefs).toContain('/pos');
      expect(hrefs).toContain('/inventory');
      expect(hrefs).toContain('/purchases');
      expect(hrefs).toContain('/customers');
      expect(hrefs).toContain('/suppliers');
      expect(hrefs).toContain('/finance');
      expect(hrefs).toContain('/reports');
      expect(hrefs).toContain('/settings');

      // Must NOT include restricted items
      expect(hrefs).not.toContain('/products');
      expect(hrefs).not.toContain('/inventory/movements');
      expect(hrefs).not.toContain('/inventory/adjustment');
      expect(hrefs).not.toContain('/sales');
      expect(hrefs).not.toContain('/users');
    });
  });

  describe('SHELL-007: Unauthenticated and unknown route handling', () => {
    it('returns false and empty navigation when role is null', () => {
      expect(canAccessRoute(null, '/dashboard')).toBe(false);
      expect(getAuthorizedNavigation(null)).toEqual([]);
    });

    it('returns false for unknown unregistered routes', () => {
      expect(canAccessRoute('OWNER', '/unknown-route')).toBe(false);
      expect(canAccessRoute('CASHIER', '/another/unregistered')).toBe(false);
    });
  });
});
