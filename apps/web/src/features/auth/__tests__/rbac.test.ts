import { describe, it, expect } from 'vitest';
import { canAccessRoute, getAuthorizedNavigation } from '../../../lib/rbac';

describe('Web ERP RBAC', () => {
  describe('canAccessRoute', () => {
    it('OWNER can access OWNER-supported routes', () => {
      expect(canAccessRoute('OWNER', '/dashboard')).toBe(true);
      expect(canAccessRoute('OWNER', '/products')).toBe(true);
      expect(canAccessRoute('OWNER', '/products/new')).toBe(true);
      expect(canAccessRoute('OWNER', '/inventory')).toBe(true);
      expect(canAccessRoute('OWNER', '/inventory/movements')).toBe(true);
      expect(canAccessRoute('OWNER', '/inventory/adjustment')).toBe(true);
      // SALES-WEB-001: OWNER can access /sales
      expect(canAccessRoute('OWNER', '/sales')).toBe(true);
      // OWNER can access /sales/<id> via /sales prefix match
      expect(canAccessRoute('OWNER', '/sales/some-uuid')).toBe(true);
    });

    it('CASHIER can access CASHIER-supported routes', () => {
      expect(canAccessRoute('CASHIER', '/dashboard')).toBe(true);
      expect(canAccessRoute('CASHIER', '/inventory')).toBe(true);
    });

    it('CASHIER cannot access OWNER-supported routes', () => {
      expect(canAccessRoute('CASHIER', '/products')).toBe(false);
      expect(canAccessRoute('CASHIER', '/inventory/movements')).toBe(false);
      expect(canAccessRoute('CASHIER', '/inventory/adjustment')).toBe(false);
      // SALES-WEB-002: CASHIER cannot access /sales
      expect(canAccessRoute('CASHIER', '/sales')).toBe(false);
      // SALES-WEB-003: CASHIER cannot access /sales/<id>
      expect(canAccessRoute('CASHIER', '/sales/some-uuid')).toBe(false);
    });

    it('Unknown/unimplemented route is denied for all roles', () => {
      expect(canAccessRoute('OWNER', '/purchasing')).toBe(false);
      expect(canAccessRoute('CASHIER', '/purchasing')).toBe(false);
      expect(canAccessRoute('OWNER', '/finance')).toBe(false);
      expect(canAccessRoute('OWNER', '/reports')).toBe(false);
      expect(canAccessRoute('OWNER', '/administration')).toBe(false);
      expect(canAccessRoute('OWNER', '/some-random-page')).toBe(false);
    });
  });

  describe('getAuthorizedNavigation', () => {
    it('OWNER sees allowed navigation including inventory and sales', () => {
      const nav = getAuthorizedNavigation('OWNER');
      const hrefs = nav.map(item => item.href);
      expect(hrefs).toContain('/dashboard');
      expect(hrefs).toContain('/products');
      expect(hrefs).toContain('/inventory');
      expect(hrefs).toContain('/inventory/movements');
      expect(hrefs).toContain('/inventory/adjustment');
      // SALES-WEB-001: OWNER sees /sales in navigation
      expect(hrefs).toContain('/sales');
      expect(hrefs).not.toContain('/purchasing');
    });

    it('CASHIER does not see OWNER-only navigation', () => {
      const nav = getAuthorizedNavigation('CASHIER');
      const hrefs = nav.map(item => item.href);
      expect(hrefs).toContain('/dashboard');
      expect(hrefs).toContain('/inventory');
      expect(hrefs).not.toContain('/products');
      expect(hrefs).not.toContain('/inventory/movements');
      expect(hrefs).not.toContain('/inventory/adjustment');
      // SALES-WEB-002: CASHIER does not see /sales in navigation
      expect(hrefs).not.toContain('/sales');
    });

    it('Unimplemented modules are absent from navigation', () => {
      const nav = getAuthorizedNavigation('OWNER');
      const hrefs = nav.map(item => item.href);
      expect(hrefs).not.toContain('/purchasing');
      expect(hrefs).not.toContain('/finance');
      expect(hrefs).not.toContain('/reports');
      expect(hrefs).not.toContain('/administration');
    });
  });
});
