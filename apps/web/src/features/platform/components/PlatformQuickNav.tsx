'use client';

import React from 'react';
import Link from 'next/link';
import { Building2, Package, Layers, Boxes, CreditCard, ChevronRight } from 'lucide-react';

export function PlatformQuickNav() {
  const sections = [
    {
      name: 'Manajemen Bisnis',
      href: '/platform/businesses',
      desc: 'Pantau seluruh tenant bisnis terdaftar, tanggal pembuatan, dan status operasional.',
      icon: Building2,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    {
      name: 'Katalog Modul',
      href: '/platform/modules',
      desc: 'Daftar modul fungsional inti (POS, Inventory, Finance, CCTV) dan status ketersediaan.',
      icon: Layers,
      color: 'text-sky-700 bg-sky-50 border-sky-200',
    },
    {
      name: 'Paket Langganan',
      href: '/platform/plans',
      desc: 'Konfigurasi tier paket langganan, siklus tagihan, dan batas penggunaan.',
      icon: CreditCard,
      color: 'text-amber-700 bg-amber-50 border-amber-200',
    },
    {
      name: 'Bundle Solusi',
      href: '/platform/bundles',
      desc: 'Kumpulan paket terpadu untuk segmen bisnis ritel, grosir, dan multi-cabang.',
      icon: Boxes,
      color: 'text-purple-700 bg-purple-50 border-purple-200',
    },
    {
      name: 'Langganan Aktif',
      href: '/platform/subscriptions',
      desc: 'Riwayat kontrak langganan aktif, harga akhir, dan masa berlaku per tenant.',
      icon: Package,
      color: 'text-slate-700 bg-slate-50 border-slate-200',
    },
  ];

  return (
    <div className="rounded-2xl border border-line bg-card p-6 shadow-2xs">
      <h3 className="text-base font-bold text-ink">Navigasi Kontrol Platform</h3>
      <p className="text-xs text-fog mt-0.5">Akses cepat menuju modul administrasi dan manajemen data platform</p>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((sec) => {
          const Icon = sec.icon;
          return (
            <Link
              key={sec.href}
              href={sec.href}
              className="group flex flex-col justify-between rounded-xl border border-line bg-surface p-4 transition-all hover:border-pine/40 hover:shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${sec.color}`}>
                    <Icon width={18} height={18} />
                  </div>
                  <ChevronRight width={16} height={16} className="text-fog transition-transform group-hover:translate-x-0.5 group-hover:text-pine" />
                </div>
                <h4 className="mt-3 text-sm font-bold text-ink group-hover:text-pine">{sec.name}</h4>
                <p className="mt-1 text-xs text-fog leading-relaxed line-clamp-2">{sec.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
