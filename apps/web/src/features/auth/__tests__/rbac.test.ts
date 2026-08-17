import { describe, it, expect } from 'vitest';
import { canAccessRoute, getAuthorizedNavigation } from '../../../lib/rbac';

describe('Web ERP RBAC', () => {
  describe('canAccessRoute', () => {
    it('OWNER can access OWNER-supported routes', () => {
      expect(canAccessRoute('OWNER', '/dashboard')).toBe(true);
      expect(canAccessRoute('OWNER', '/products')).toBe(true);
      expect(canAccessRoute('OWNER', '/products/new')).toBe(true);
    });

    it('CASHIER can access CASHIER-supported routes', () => {
      expect(canAccessRoute('CASHIER', '/dashboard')).toBe(true);
    });

    it('CASHIER cannot access OWNER-supported routes', () => {
      expect(canAccessRoute('CASHIER', '/products')).toBe(false);
    });

    it('Unknown/unimplemented route is denied for all roles', () => {
      expect(canAccessRoute('OWNER', '/inventory')).toBe(false);
      expect(canAccessRoute('OWNER', '/sales')).toBe(false);
      expect(canAccessRoute('CASHIER', '/purchasing')).toBe(false);
      expect(canAccessRoute('OWNER', '/finance')).toBe(false);
      expect(canAccessRoute('OWNER', '/reports')).toBe(false);
      expect(canAccessRoute('OWNER', '/administration')).toBe(false);
      expect(canAccessRoute('OWNER', '/some-random-page')).toBe(false);
    });
  });

  describe('getAuthorizedNavigation', () => {
    it('OWNER sees allowed navigation', () => {
      const nav = getAuthorizedNavigation('OWNER');
      const hrefs = nav.map(item => item.href);
      expect(hrefs).toContain('/dashboard');
      expect(hrefs).toContain('/products');
      expect(hrefs).not.toContain('/sales');
    });

    it('CASHIER does not see OWNER-only navigation', () => {
      const nav = getAuthorizedNavigation('CASHIER');
      const hrefs = nav.map(item => item.href);
      expect(hrefs).toContain('/dashboard');
      expect(hrefs).not.toContain('/products');
    });

    it('Unimplemented modules are absent from navigation', () => {
      const nav = getAuthorizedNavigation('OWNER');
      const hrefs = nav.map(item => item.href);
      expect(hrefs).not.toContain('/inventory');
      expect(hrefs).not.toContain('/purchasing');
      expect(hrefs).not.toContain('/finance');
      expect(hrefs).not.toContain('/reports');
      expect(hrefs).not.toContain('/administration');
    });
  });
});
