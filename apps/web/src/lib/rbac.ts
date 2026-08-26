import { LayoutDashboard, Package, Boxes, ShoppingCart, Users, FileText, UserCog, Sliders, LucideIcon } from 'lucide-react';

export type Role = 'OWNER' | 'CASHIER';

export const ROUTE_PERMISSIONS: Record<string, Role[]> = {
  '/dashboard': ['OWNER', 'CASHIER'],
  '/pos': ['OWNER', 'CASHIER'],
  '/products': ['OWNER'],
  '/inventory': ['OWNER', 'CASHIER'],
  '/inventory/movements': ['OWNER'],
  '/inventory/adjustment': ['OWNER'],
  '/sales': ['OWNER'],
  '/customers': ['OWNER', 'CASHIER'],
  '/customers/new': ['OWNER'],
  '/users': ['OWNER'],
  '/reports': ['OWNER', 'CASHIER'],
  '/settings': ['OWNER', 'CASHIER'],
};

export function canAccessRoute(role: Role | null, pathname: string): boolean {
  if (!role) return false;

  // Find the most-specific matching route (longest prefix wins) so that
  // /inventory/movements is evaluated before /inventory for a CASHIER.
  const allRoutes = Object.keys(ROUTE_PERMISSIONS);
  const candidates = allRoutes.filter(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (candidates.length === 0) return false;

  // Pick the longest matching route key (most specific)
  const matchedRoute = candidates.reduce((a, b) => (a.length >= b.length ? a : b));

  return ROUTE_PERMISSIONS[matchedRoute].includes(role);
}

export interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Kasir', href: '/pos', icon: ShoppingCart },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Inventory', href: '/inventory', icon: Boxes },
  { name: 'Movement History', href: '/inventory/movements', icon: Boxes },
  { name: 'Stock Adjustment', href: '/inventory/adjustment', icon: Boxes },
  { name: 'Sales', href: '/sales', icon: ShoppingCart },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Users', href: '/users', icon: UserCog },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Pengaturan', href: '/settings', icon: Sliders },
];

export function getAuthorizedNavigation(role: Role | null): NavigationItem[] {
  if (!role) return [];
  return NAVIGATION_ITEMS.filter((item) => canAccessRoute(role, item.href));
}
