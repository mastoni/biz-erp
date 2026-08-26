'use client';

import React from 'react';
import type { CustomerSummaryKPI } from '../types';
import { idrShort, num } from '../customer-helpers';

interface CustomersKPICardsProps {
  summary: CustomerSummaryKPI;
}

export function CustomersKPICards({ summary }: CustomersKPICardsProps) {
  const stats = [
    {
      label: 'Total Pelanggan',
      value: num(summary.total_customers),
      cls: 'text-ink',
    },
    {
      label: 'Member Gold',
      value: num(summary.gold_members),
      cls: 'text-[#8a5f10]',
    },
    {
      label: 'Member Silver',
      value: num(summary.silver_members),
      cls: 'text-tide',
    },
    {
      label: 'Belanja Bulan Ini',
      value: idrShort(summary.monthly_spend_minor),
      cls: 'text-pine font-bold',
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
          <p className={`num mt-1 text-xl font-bold ${s.cls}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}
