'use client';

import React, { useMemo } from 'react';
import { formatMinor } from '@/lib/format';
import { getAgingBucket } from '../api';
import type { AgingBucket } from '../types';
import { Clock, AlertTriangle, ShieldCheck, AlertCircle } from 'lucide-react';

export interface AgingSummaryItem {
  outstanding_minor: number;
  due_date?: string | null;
  date?: string;
  created_at?: string;
}

export interface AgingSummaryCardsProps {
  items: AgingSummaryItem[];
  title?: string;
  asOfDate?: Date;
}

export function AgingSummaryCards({
  items,
  title,
  asOfDate = new Date(),
}: AgingSummaryCardsProps) {
  const summary = useMemo(() => {
    let current_0_30 = 0;
    let days_31_60 = 0;
    let days_61_90 = 0;
    let days_over_90 = 0;
    let totalOutstanding = 0;

    let count_0_30 = 0;
    let count_31_60 = 0;
    let count_61_90 = 0;
    let count_over_90 = 0;

    for (const item of items) {
      const outstanding = item.outstanding_minor || 0;
      if (outstanding <= 0) continue;

      totalOutstanding += outstanding;
      const bucket: AgingBucket = getAgingBucket(
        item.due_date || item.date || item.created_at,
        asOfDate
      );

      switch (bucket) {
        case '0-30':
          current_0_30 += outstanding;
          count_0_30 += 1;
          break;
        case '31-60':
          days_31_60 += outstanding;
          count_31_60 += 1;
          break;
        case '61-90':
          days_61_90 += outstanding;
          count_61_90 += 1;
          break;
        case '>90':
          days_over_90 += outstanding;
          count_over_90 += 1;
          break;
      }
    }

    return {
      current_0_30,
      days_31_60,
      days_61_90,
      days_over_90,
      totalOutstanding,
      count_0_30,
      count_31_60,
      count_61_90,
      count_over_90,
      totalCount: count_0_30 + count_31_60 + count_61_90 + count_over_90,
    };
  }, [items, asOfDate]);

  return (
    <div className="space-y-2.5">
      {title && (
        <div className="flex items-center justify-between text-xs font-semibold text-fog px-0.5">
          <span>{title}</span>
          <span>Total Tagihan Aktif: {summary.totalCount}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {/* Total Outstanding */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-fog">
            Total Outstanding
          </p>
          <p className="num mt-1 text-lg font-bold text-ink">
            {formatMinor(summary.totalOutstanding)}
          </p>
          <p className="mt-0.5 text-[11px] text-fog">
            {summary.totalCount} kewajiban berjalan
          </p>
        </div>

        {/* Current / 0-30 Hari */}
        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Current / 0–30 Hari
            </p>
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <p className="num mt-1 text-lg font-bold text-emerald-700">
            {formatMinor(summary.current_0_30)}
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-800/80">
            {summary.count_0_30} transaksi lancar
          </p>
        </div>

        {/* 31-60 Hari */}
        <div className="rounded-2xl border border-blue-200/70 bg-blue-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
              31–60 Hari
            </p>
            <Clock className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <p className="num mt-1 text-lg font-bold text-blue-700">
            {formatMinor(summary.days_31_60)}
          </p>
          <p className="mt-0.5 text-[11px] text-blue-800/80">
            {summary.count_31_60} tempo menengah
          </p>
        </div>

        {/* 61-90 Hari */}
        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
              61–90 Hari
            </p>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <p className="num mt-1 text-lg font-bold text-amber-700">
            {formatMinor(summary.days_61_90)}
          </p>
          <p className="mt-0.5 text-[11px] text-amber-800/80">
            {summary.count_61_90} perlu penagihan
          </p>
        </div>

        {/* >90 Hari Terlambat */}
        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-rose-200/70 bg-rose-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
              &gt;90 Hari Terlambat
            </p>
            <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
          </div>
          <p className="num mt-1 text-lg font-bold text-rose-700">
            {formatMinor(summary.days_over_90)}
          </p>
          <p className="mt-0.5 text-[11px] text-rose-800/80">
            {summary.count_over_90} tunggakan kritis
          </p>
        </div>
      </div>
    </div>
  );
}
