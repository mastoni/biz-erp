'use client';

import React from 'react';
import type { SupplierSummaryKPI, SupplierViewModel } from '../types';
import { num } from '../supplier-helpers';

interface SuppliersKPICardsProps {
  summary: SupplierSummaryKPI;
  isOwner: boolean;
  onAddClick?: () => void;
}

export function SuppliersKPICards({ summary, isOwner, onAddClick }: SuppliersKPICardsProps) {
  const stats = [
    {
      label: 'Supplier Aktif',
      value: num(summary.active_suppliers),
      cls: 'text-ink',
      available: true,
    },
    {
      label: 'Hutang Supplier',
      value: '—',
      cls: 'text-fog',
      available: false,
    },
    {
      label: 'PO Bulan Ini',
      value: '—',
      cls: 'text-fog',
      available: false,
    },
    {
      label: 'Rating Rata-rata',
      value: '—',
      cls: 'text-fog',
      available: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-2xl border border-line bg-card p-4 shadow-sm transition-all hover:border-pine/30"
        >
          <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-fog">{s.label}</p>
          {s.available ? (
            <p className={`num mt-1 text-xl font-bold ${s.cls}`}>{s.value}</p>
          ) : (
            <p className={`num mt-1 text-xl font-bold ${s.cls}`}>
              Belum tersedia
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
