'use client';

import React from 'react';
import type { FinanceOverviewKPIs } from '../types';

interface FinanceKPICardsProps {
  kpis: FinanceOverviewKPIs;
  isLoading?: boolean;
}

function idr(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
}

export function FinanceKPICards({ kpis, isLoading }: FinanceKPICardsProps) {
  const cards = [
    {
      label: 'Kas & Bank',
      value: kpis.kas_bank_minor,
      note: 'Rekening utama + laci kasir',
      accent: '#17593e',
      valueClass: 'text-ink',
    },
    {
      label: 'Piutang',
      value: kpis.piutang_minor,
      note: 'Total piutang pelanggan berjalan',
      accent: '#35657f',
      valueClass: 'text-[#35657f]',
    },
    {
      label: 'Hutang',
      value: kpis.hutang_minor,
      note: 'Kewajiban supplier & operasional',
      accent: '#bc4b2f',
      valueClass: 'text-[#bc4b2f]',
    },
    {
      label: 'Laba Bersih Bulan Ini',
      value: kpis.laba_bersih_minor,
      note: `Margin ${kpis.margin_percent}% dari omzet`,
      accent: '#d3921f',
      valueClass: kpis.laba_bersih_minor >= 0 ? 'text-emerald-700' : 'text-rose-700',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="relative overflow-hidden rounded-2xl border border-line bg-surface p-4.5 shadow-2xs transition hover:shadow-xs"
        >
          <span
            className="absolute inset-y-0 left-0 w-[4px]"
            style={{ background: c.accent }}
          />
          <div className="flex items-center justify-between">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-fog">
              {c.label}
            </p>
          </div>

          <p className={`num mt-2 text-xl font-bold leading-tight ${c.valueClass}`}>
            {isLoading ? '...' : idr(c.value)}
          </p>

          <p className="mt-1.5 text-[11px] text-fog">{c.note}</p>
        </div>
      ))}
    </div>
  );
}
