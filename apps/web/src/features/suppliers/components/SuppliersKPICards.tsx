'use client';

import React from 'react';
import type { SupplierSummaryKPI } from '../types';
import { num, idrShort } from '../supplier-helpers';

interface SuppliersKPICardsProps {
  summary: SupplierSummaryKPI;
  isOwner: boolean;
  onAddClick?: () => void;
}

export function SuppliersKPICards({ summary }: SuppliersKPICardsProps) {
  const stats = [
    {
      label: 'Supplier Aktif',
      value: num(summary.active_suppliers),
      sub: `${summary.total_suppliers} total terdaftar`,
      cls: 'text-ink',
    },
    {
      label: 'Hutang Supplier',
      value: idrShort(summary.total_outstanding_minor),
      sub: 'kewajiban belum dilunasi',
      cls: summary.total_outstanding_minor > 0 ? 'text-rose-700' : 'text-emerald-700',
    },
    {
      label: 'PO Bulan Ini',
      value: num(summary.po_count_this_month),
      sub: 'pesanan periode berjalan',
      cls: 'text-sky-700',
    },
    {
      label: 'Rating Rata-rata',
      value: '—',
      sub: 'dari penilaian pengiriman',
      cls: 'text-fog',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-2xl border border-line bg-card p-4 shadow-2xs transition-all hover:border-pine/30"
        >
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-fog">{s.label}</p>
          <p className={`num mt-1.5 text-xl font-bold ${s.cls}`}>{s.value}</p>
          <p className="mt-1 text-[11px] text-fog">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}
