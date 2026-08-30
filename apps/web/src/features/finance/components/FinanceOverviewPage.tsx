'use client';

import React from 'react';
import { Download, CalendarClock } from 'lucide-react';
import { useFinanceOverviewViewModel } from '../use-finance-overview-viewmodel';
import { FinanceKPICards } from './FinanceKPICards';
import { FinanceCashflowChart } from './FinanceCashflowChart';
import { RecentExpensesWidget } from './RecentExpensesWidget';

interface FinanceOverviewPageProps {
  businessId?: string;
  branchId?: string;
  role?: 'OWNER' | 'CASHIER';
}

function idr(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
}

export function FinanceOverviewPage({
  businessId,
  branchId,
  role,
}: FinanceOverviewPageProps) {
  const {
    kpis,
    monthlyCashflow,
    recentExpenses,
    isLoading,
    error,
    exportRekeningKoran,
  } = useFinanceOverviewViewModel({ businessId, branchId });

  const isOwner = role === 'OWNER';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Keuangan
          </h1>
          <p className="text-xs text-fog">
            Arus kas, pengeluaran, dan kewajiban toko bulan ini.
          </p>
        </div>

        <button
          onClick={exportRekeningKoran}
          className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-bold text-ink shadow-2xs transition hover:bg-paper cursor-pointer"
        >
          <Download className="h-4 w-4 text-fog" />
          <span>Rekening Koran</span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* 4 Executive KPI Cards */}
      <FinanceKPICards kpis={kpis} isLoading={isLoading} />

      {/* Main Grid: Chart + Recent Expenses */}
      <div className="grid grid-cols-12 gap-5">
        {/* Left 8 Cols: Multi-Month Cashflow Chart */}
        <div className="col-span-12 lg:col-span-8">
          <FinanceCashflowChart
            data={monthlyCashflow}
            isLoading={isLoading}
            error={error}
          />
        </div>

        {/* Right 4 Cols: Recent Expenses & Schedule */}
        <div className="col-span-12 lg:col-span-4 space-y-5">
          {/* Recent Expenses */}
          <RecentExpensesWidget
            expenses={recentExpenses}
            isLoading={isLoading}
          />

          {/* Jadwal Terdekat */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-2xs">
            <div className="flex items-center gap-2 mb-3.5">
              <CalendarClock className="h-4 w-4 text-pine" />
              <h3 className="font-display text-sm font-bold text-ink">
                Jadwal & Komitmen Rutin
              </h3>
            </div>
            <ul className="space-y-3">
              {[
                { d: '15', b: 'Bln Ini', label: 'Sewa gudang / tempat', val: 2500000 },
                { d: '20', b: 'Bln Ini', label: 'Listrik & air operasional', val: 1250000 },
                { d: '25', b: 'Bln Ini', label: 'Internet & konektivitas kasir', val: 350000 },
              ].map((s) => (
                <li key={s.label} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-paper text-center leading-none">
                    <span className="num text-xs font-bold text-ink">{s.d}</span>
                    <span className="text-[8px] font-bold uppercase text-fog">{s.b}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink">{s.label}</p>
                    <p className="num text-[11px] font-bold text-fog">{idr(s.val)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
