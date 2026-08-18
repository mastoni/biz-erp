import { LayoutDashboard, Package, LucideIcon } from 'lucide-react';

export type Role = 'OWNER' | 'CASHIER';

export const ROUTE_PERMISSIONS: Record<string, Role[]> = {
  '/dashboard': ['OWNER', 'CASHIER'],
  '/products': ['OWNER'],
};

export function canAccessRoute(role: Role | null, pathname: string): boolean {
  if (!role) return false;

  // Exact match or prefix match (e.g. /products/new)
  const matchedRoute = Object.keys(ROUTE_PERMISSIONS).find(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (!matchedRoute) {
    // Deny access to unknown or unimplemented routes
    return false;
  }

  return ROUTE_PERMISSIONS[matchedRoute].includes(role);
}

export interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Products', href: '/products', icon: Package },
];

export function getAuthorizedNavigation(role: Role | null): NavigationItem[] {
  if (!role) return [];
  return NAVIGATION_ITEMS.filter((item) => canAccessRoute(role, item.href));
}
