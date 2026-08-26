'use client';

import React from 'react';
import { idrShort, pct } from '../reports-helpers';
import type { ReportsExecutiveKPI } from '../types';

interface ReportsExecutiveKPICardsProps {
  kpi: ReportsExecutiveKPI;
}

export function ReportsExecutiveKPICards({ kpi }: ReportsExecutiveKPICardsProps) {
  const hasGrossProfit = kpi.gross_profit_minor !== null;
  const hasExpense = kpi.operating_expense_minor !== null;
  const hasNetProfit = kpi.net_profit_minor !== null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="executive-kpi-cards">
      {/* 1. Omzet */}
      <div className="rounded-xl border border-line bg-surface px-4 py-3.5 shadow-sm transition-all hover:border-pine/30 hover:shadow-md">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-fog">Omzet</p>
        <p className="num mt-1 text-xl font-bold text-pine" data-testid="kpi-revenue">
          {idrShort(kpi.revenue_minor)}
        </p>
      </div>

      {/* 2. Laba Kotor */}
      <div className="rounded-xl border border-line bg-surface px-4 py-3.5 shadow-sm transition-all hover:border-pine/30 hover:shadow-md">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-fog">Laba Kotor</p>
        <p className="num mt-1 text-xl font-bold text-ink" data-testid="kpi-gross-profit">
          {hasGrossProfit ? idrShort(kpi.gross_profit_minor) : 'Tidak Tersedia'}
        </p>
        <p className="text-[11px] text-fog">
          {hasGrossProfit && kpi.gross_margin_percent !== null
            ? `margin ${Math.round(kpi.gross_margin_percent)}%`
            : 'Data HPP belum lengkap'}
        </p>
      </div>

      {/* 3. Beban Operasional */}
      <div className="rounded-xl border border-line bg-surface px-4 py-3.5 shadow-sm transition-all hover:border-pine/30 hover:shadow-md">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-fog">Beban Operasional</p>
        <p className="num mt-1 text-xl font-bold text-clay" data-testid="kpi-operating-expense">
          {hasExpense ? idrShort(kpi.operating_expense_minor) : 'Tidak Tersedia'}
        </p>
        <p className="text-[11px] text-fog">
          {hasExpense ? 'Beban tercatat' : 'Buku beban belum terhubung'}
        </p>
      </div>

      {/* 4. Laba Bersih */}
      <div className="rounded-xl border border-pine/30 bg-pine-soft/40 px-4 py-3.5 shadow-sm transition-all hover:border-pine/50 hover:shadow-md">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-pine/70">Laba Bersih</p>
        <p className="num mt-1 text-xl font-bold text-pine" data-testid="kpi-net-profit">
          {hasNetProfit ? idrShort(kpi.net_profit_minor) : 'Tidak Tersedia'}
        </p>
        <p className="text-[11px] text-pine/70">
          {hasNetProfit ? 'Setelah HPP & beban' : 'Menunggu data beban'}
        </p>
      </div>
    </div>
  );
}
