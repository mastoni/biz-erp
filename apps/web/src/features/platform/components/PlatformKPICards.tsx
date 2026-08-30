'use client';

import React from 'react';
import type { PlatformOverviewKPIs } from '../types';
import { formatCurrency } from '../list-helpers';

interface PlatformKPICardsProps {
  kpis: PlatformOverviewKPIs;
  loading?: boolean;
}

export function PlatformKPICards({ kpis, loading }: PlatformKPICardsProps) {
  const stats = [
    {
      label: 'Bisnis Terdaftar',
      value: kpis.total_businesses.toLocaleString('id-ID'),
      sub: 'tenant bisnis terpartisi',
      cls: 'text-ink',
      border: 'border-l-4 border-l-emerald-600',
    },
    {
      label: 'Langganan Aktif',
      value: kpis.active_subscriptions.toLocaleString('id-ID'),
      sub: 'bisnis aktif & masa trial',
      cls: 'text-emerald-700',
      border: 'border-l-4 border-l-sky-600',
    },
    {
      label: 'Estimasi MRR',
      value: formatCurrency(kpis.estimated_mrr_minor, 'IDR'),
      sub: 'pendapatan berulang bulanan',
      cls: 'text-amber-700',
      border: 'border-l-4 border-l-amber-500',
    },
    {
      label: 'Katalog Paket & Modul',
      value: `${kpis.total_plans} Paket · ${kpis.total_modules} Modul`,
      sub: 'fitur platform siap pakai',
      cls: 'text-ink',
      border: 'border-l-4 border-l-slate-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`rounded-2xl border border-line bg-card p-5 shadow-2xs transition-all hover:border-pine/30 ${s.border}`}
        >
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-fog">{s.label}</p>
          {loading ? (
            <div className="mt-2 h-7 w-28 animate-pulse rounded bg-paper" />
          ) : (
            <p className={`num mt-1 text-2xl font-bold tracking-tight ${s.cls}`}>{s.value}</p>
          )}
          <p className="mt-1 text-xs text-fog">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}
