import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ShoppingCart, PackagePlus, ArrowLeftRight, FileText, Zap } from 'lucide-react';
import Link from 'next/link';

export function QuickActions() {
  const actions = [
    {
      title: 'POS Kasir',
      description: 'Buka terminal penjualan',
      href: '/pos',
      icon: <ShoppingCart className="h-4 w-4 text-pine" />,
      badgeBg: 'bg-pine-soft border-pine/20',
    },
    {
      title: 'Kelola Produk',
      description: 'Katalog & harga produk',
      href: '/inventory',
      icon: <PackagePlus className="h-4 w-4 text-ocean" />,
      badgeBg: 'bg-ocean-soft border-ocean/20',
    },
    {
      title: 'Stok Masuk / Keluar',
      description: 'Penyesuaian stok cabang',
      href: '/inventory',
      icon: <ArrowLeftRight className="h-4 w-4 text-honey" />,
      badgeBg: 'bg-honey-soft border-honey/20',
    },
    {
      title: 'Laporan Penjualan',
      description: 'Ringkasan omset & analitik',
      href: '/reports',
      icon: <FileText className="h-4 w-4 text-ink" />,
      badgeBg: 'bg-surface-soft border-line',
    },
  ];

  return (
    <Card className="border border-line bg-card shadow-[0_1px_3px_rgba(26,29,26,0.04)]">
      <CardHeader className="pb-3 border-b border-line/60">
        <CardTitle className="text-sm font-bold font-heading text-ink flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-pine-soft border border-pine/20 flex items-center justify-center text-pine">
            <Zap className="h-3.5 w-3.5" />
          </div>
          <span>Aksi Cepat & Pintasan</span>
        </CardTitle>
        <p className="text-xs text-fog">Pintasan navigasi modul operasional harian</p>
      </CardHeader>

      <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
        {actions.map((act) => (
          <Link
            key={act.title}
            href={act.href}
            className="flex items-center gap-3 p-3 rounded-lg border border-line/70 bg-surface hover:bg-surface-soft transition-all duration-200 shadow-xs hover:shadow-sm hover:border-line group"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg border shrink-0 ${act.badgeBg} group-hover:scale-105 transition-transform`}>
              {act.icon}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-ink truncate group-hover:text-pine transition-colors">{act.title}</p>
              <p className="text-[11px] text-fog truncate">{act.description}</p>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
