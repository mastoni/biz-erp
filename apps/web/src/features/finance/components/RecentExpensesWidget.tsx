'use client';

import React from 'react';
import { Wallet } from 'lucide-react';
import type { RecentExpenseItem } from '../types';

interface RecentExpensesWidgetProps {
  expenses: RecentExpenseItem[];
  isLoading?: boolean;
}

function idr(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
}

export function RecentExpensesWidget({
  expenses,
  isLoading,
}: RecentExpensesWidgetProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h3 className="font-display text-base font-bold text-ink">
          Pengeluaran Terkini
        </h3>
        <span className="rounded-md border border-line bg-paper px-2 py-0.5 text-[11px] font-bold text-fog">
          {expenses.length} catatan
        </span>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="p-6 text-center text-xs text-fog">
          Memuat data pengeluaran...
        </div>
      ) : expenses.length === 0 ? (
        <div className="p-6 text-center text-xs text-fog">
          Belum ada catatan pengeluaran operasional.
        </div>
      ) : (
        <ul className="divide-y divide-line/60">
          {expenses.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-3 px-5 py-3 transition hover:bg-paper/40"
            >
              {/* Icon */}
              <span className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Wallet className="h-4 w-4" />
              </span>

              {/* Description & Category */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-ink leading-tight">
                  {e.description || 'Pengeluaran Toko'}
                </p>
                <p className="num mt-0.5 text-[10.5px] text-fog">
                  {e.date} · {e.category || 'Operasional'}
                </p>
              </div>

              {/* Amount & Status */}
              <div className="text-right">
                <p className="num text-xs font-bold text-ink">{idr(e.amount_minor)}</p>
                <p className="text-[10px] font-semibold text-emerald-700 capitalize">
                  {e.status === 'posted' ? 'Lunas' : e.status}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
