import React from 'react';
import { RefreshCw, Wallet, AlertCircle, CalendarClock, CheckCircle, PauseCircle } from 'lucide-react';
import { formatMinor } from '@/lib/format';
import { BillingDashboardKPI } from '../types';

interface BillingKPICardsProps {
  kpi: BillingDashboardKPI | null;
  isLoading: boolean;
}

export function BillingKPICards({ kpi, isLoading }: BillingKPICardsProps) {
  if (isLoading || !kpi) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="flex h-28 animate-pulse flex-col justify-between rounded-xl border border-ink/10 bg-surface p-4 shadow-sm dark:border-ink/20"
          >
            <div className="h-4 w-20 rounded bg-ink/10 dark:bg-ink/20" />
            <div className="h-7 w-28 rounded bg-ink/10 dark:bg-ink/20" />
            <div className="h-3 w-16 rounded bg-ink/10 dark:bg-ink/20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {/* 1. Active Subscriptions */}
      <div className="flex flex-col justify-between rounded-xl border border-ink/10 bg-surface p-4 shadow-sm dark:border-ink/20">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-ink/60 uppercase tracking-wider">Langganan Aktif</span>
          <div className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <RefreshCw className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <span className="font-display text-2xl font-bold text-ink">{kpi.activeSubscriptionsCount}</span>
          <p className="text-[11px] text-ink/50 mt-0.5">dari {kpi.totalSubscriptionsCount} total langganan</p>
        </div>
      </div>

      {/* 2. Monthly Recurring Revenue */}
      <div className="flex flex-col justify-between rounded-xl border border-ink/10 bg-surface p-4 shadow-sm dark:border-ink/20">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-ink/60 uppercase tracking-wider">MRR Est.</span>
          <div className="rounded-lg bg-indigo-500/10 p-1.5 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
            <Wallet className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <span className="font-display text-lg font-bold text-ink">
            {formatMinor(kpi.monthlyRecurringRevenueMinor)}
          </span>
          <p className="text-[11px] text-ink/50 mt-0.5">pendapatan berulang / bln</p>
        </div>
      </div>

      {/* 3. Overdue Invoices */}
      <div className="flex flex-col justify-between rounded-xl border border-ink/10 bg-surface p-4 shadow-sm dark:border-ink/20">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-ink/60 uppercase tracking-wider">Jatuh Tempo</span>
          <div className="rounded-lg bg-rose-500/10 p-1.5 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
            <AlertCircle className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <span className="font-display text-2xl font-bold text-rose-600 dark:text-rose-400">
            {kpi.overdueInvoicesCount}
          </span>
          <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-0.5 font-medium">
            {formatMinor(kpi.overdueInvoicesAmountMinor)}
          </p>
        </div>
      </div>

      {/* 4. Total Outstanding Receivables */}
      <div className="flex flex-col justify-between rounded-xl border border-ink/10 bg-surface p-4 shadow-sm dark:border-ink/20">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-ink/60 uppercase tracking-wider">Total Piutang</span>
          <div className="rounded-lg bg-amber-500/10 p-1.5 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <Wallet className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <span className="font-display text-lg font-bold text-ink">
            {formatMinor(kpi.totalOutstandingReceivablesMinor)}
          </span>
          <p className="text-[11px] text-ink/50 mt-0.5">belum lunas (AR)</p>
        </div>
      </div>

      {/* 5. Upcoming Billing (7 Days) */}
      <div className="flex flex-col justify-between rounded-xl border border-ink/10 bg-surface p-4 shadow-sm dark:border-ink/20">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-ink/60 uppercase tracking-wider">7 Hari Mendatang</span>
          <div className="rounded-lg bg-sky-500/10 p-1.5 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
            <CalendarClock className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <span className="font-display text-2xl font-bold text-ink">{kpi.upcomingBillingCount}</span>
          <p className="text-[11px] text-ink/50 mt-0.5">{formatMinor(kpi.upcomingBillingAmountMinor)}</p>
        </div>
      </div>

      {/* 6. Paid this Month */}
      <div className="flex flex-col justify-between rounded-xl border border-ink/10 bg-surface p-4 shadow-sm dark:border-ink/20">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-ink/60 uppercase tracking-wider">Lunas Bulan Ini</span>
          <div className="rounded-lg bg-teal-500/10 p-1.5 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
            <CheckCircle className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <span className="font-display text-lg font-bold text-teal-600 dark:text-teal-400">
            {formatMinor(kpi.totalPaidThisMonthMinor)}
          </span>
          <p className="text-[11px] text-ink/50 mt-0.5">pembayaran kas masuk</p>
        </div>
      </div>
    </div>
  );
}
