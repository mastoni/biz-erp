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
  TrendingUp,
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
  '/wallet': ['OWNER'],
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
  group: string;
}

export interface NavigationGroup {
  title: string;
  items: NavigationItem[];
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  // 1. RINGKASAN & KASIR
  { name: 'Dasbor', href: '/dashboard', icon: LayoutDashboard, group: 'Ringkasan & Kasir' },
  { name: 'Kasir', href: '/pos', icon: ShoppingCart, group: 'Ringkasan & Kasir' },
  { name: 'Penjualan', href: '/sales', icon: ShoppingCart, group: 'Ringkasan & Kasir' },

  // 2. PRODUK & STOK
  { name: 'Katalog Produk', href: '/products', icon: Package, group: 'Produk & Stok' },
  { name: 'Stok Barang', href: '/inventory', icon: Boxes, group: 'Produk & Stok' },
  { name: 'Riwayat Stok', href: '/inventory/movements', icon: Boxes, group: 'Produk & Stok' },
  { name: 'Penyesuaian Stok', href: '/inventory/adjustment', icon: Boxes, group: 'Produk & Stok' },

  // 3. PEMBELIAN & KONTAK
  { name: 'Pembelian', href: '/purchases', icon: Truck, group: 'Pembelian & Kontak' },
  { name: 'Pelanggan', href: '/customers', icon: Users, group: 'Pembelian & Kontak' },
  { name: 'Supplier', href: '/suppliers', icon: Users, group: 'Pembelian & Kontak' },

  // 4. KEUANGAN & DOMPET
  { name: 'Laporan Keuangan', href: '/finance', icon: TrendingUp, group: 'Keuangan & Dompet' },
  { name: 'Pembukuan', href: '/finance/bookkeeping', icon: BookOpen, group: 'Keuangan & Dompet' },
  { name: 'Digital Wallet', href: '/wallet', icon: Wallet, group: 'Keuangan & Dompet' },

  // 5. LAPORAN & PENGATURAN
  { name: 'Laporan', href: '/reports', icon: FileText, group: 'Laporan & Pengaturan' },
  { name: 'Kelola Pengguna', href: '/users', icon: UserCog, group: 'Laporan & Pengaturan' },
  { name: 'Pengaturan', href: '/settings', icon: Sliders, group: 'Laporan & Pengaturan' },
  { name: 'Perangkat Hardware', href: '/devices', icon: HardDrive, group: 'Laporan & Pengaturan' },
  { name: 'Layanan Servis', href: '/device-services', icon: Wrench, group: 'Laporan & Pengaturan' },
  { name: 'Langganan & Tagihan', href: '/billing', icon: RefreshCw, group: 'Laporan & Pengaturan' },
];

export function getAuthorizedNavigation(role: Role | null): NavigationItem[] {
  if (!role) return [];
  return NAVIGATION_ITEMS.filter((item) => canAccessRoute(role, item.href));
}

export function getGroupedAuthorizedNavigation(role: Role | null): NavigationGroup[] {
  const authorizedItems = getAuthorizedNavigation(role);
  const groupOrder = [
    'Ringkasan & Kasir',
    'Produk & Stok',
    'Pembelian & Kontak',
    'Keuangan & Dompet',
    'Laporan & Pengaturan',
  ];

  const groupMap = new Map<string, NavigationItem[]>();
  groupOrder.forEach((g) => groupMap.set(g, []));

  authorizedItems.forEach((item) => {
    const list = groupMap.get(item.group) || [];
    list.push(item);
    groupMap.set(item.group, list);
  });

  const groups: NavigationGroup[] = [];
  groupOrder.forEach((title) => {
    const items = groupMap.get(title) || [];
    if (items.length > 0) {
      groups.push({ title, items });
    }
  });

  return groups;
}
