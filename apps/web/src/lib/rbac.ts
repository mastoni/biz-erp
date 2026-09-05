import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  Users,
  FileText,
  UserCog,
  Sliders,
  BookOpen,
  Truck,
  Wallet,
  HardDrive,
  Wrench,
  RefreshCw,
  LucideIcon,
} from 'lucide-react';

export type Role = 'OWNER' | 'STAFF' | 'CASHIER';

export const ROUTE_PERMISSIONS: Record<string, Role[]> = {
  '/dashboard': ['OWNER', 'STAFF', 'CASHIER'],
  '/pos': ['OWNER', 'STAFF', 'CASHIER'],
  '/products': ['OWNER', 'STAFF'],
  '/inventory': ['OWNER', 'STAFF', 'CASHIER'],
  '/inventory/movements': ['OWNER', 'STAFF'],
  '/inventory/adjustment': ['OWNER', 'STAFF'],
  '/sales': ['OWNER', 'STAFF'],
  '/purchases': ['OWNER', 'STAFF', 'CASHIER'],
  '/customers': ['OWNER', 'STAFF', 'CASHIER'],
  '/customers/new': ['OWNER', 'STAFF'],
  '/suppliers': ['OWNER', 'STAFF', 'CASHIER'],
  '/billing': ['OWNER', 'STAFF', 'CASHIER'],
  '/billing/subscriptions': ['OWNER', 'STAFF', 'CASHIER'],
  '/billing/invoices': ['OWNER', 'STAFF', 'CASHIER'],
  '/finance/bookkeeping': ['OWNER', 'STAFF', 'CASHIER'],
  '/finance/reports': ['OWNER', 'STAFF'],
  '/finance/accounts': ['OWNER', 'STAFF'],
  '/finance/journals': ['OWNER', 'STAFF'],
  '/finance': ['OWNER', 'STAFF', 'CASHIER'],
  '/users': ['OWNER'],
  '/reports': ['OWNER', 'STAFF', 'CASHIER'],
  '/settings': ['OWNER', 'STAFF', 'CASHIER'],
  '/devices': ['OWNER', 'STAFF', 'CASHIER'],
  '/device-services': ['OWNER', 'STAFF'],
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
  { name: 'Perangkat Hardware', href: '/devices', icon: HardDrive },
  { name: 'Layanan Servis', href: '/device-services', icon: Wrench },
  { name: 'Langganan & Tagihan', href: '/billing', icon: RefreshCw },
  { name: 'Sales', href: '/sales', icon: ShoppingCart },
  { name: 'Pembelian', href: '/purchases', icon: Truck },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Supplier', href: '/suppliers', icon: Users },
  { name: 'Pembukuan', href: '/finance/bookkeeping', icon: BookOpen },
  { name: 'Laporan Keuangan', href: '/finance', icon: Wallet },
  { name: 'Users', href: '/users', icon: UserCog },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Pengaturan', href: '/settings', icon: Sliders },
];

export function getAuthorizedNavigation(role: Role | null): NavigationItem[] {
  if (!role) return [];
  return NAVIGATION_ITEMS.filter((item) => canAccessRoute(role, item.href));
}
