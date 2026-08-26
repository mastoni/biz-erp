'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMinor } from '@/lib/format';
import type { SalesKPIViewModel } from '../types';

interface SalesKPICardsProps {
  kpi: SalesKPIViewModel | null;
  isLoading: boolean;
}

export function SalesKPICards({ kpi, isLoading }: SalesKPICardsProps) {
  if (isLoading || !kpi) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="sales-kpi-loading">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4 sm:p-5 border border-line bg-card">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="mt-2 h-7 w-20 rounded" />
            <Skeleton className="mt-2 h-3 w-28 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const refundDisplay = kpi.refund_count === null ? '-' : kpi.refund_count.toLocaleString('id-ID');

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="sales-kpi-cards">
      {/* 1. Transaksi Tercatat */}
      <div className="card card-hover px-4 py-3.5 border border-line bg-card rounded-lg">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-fog">Transaksi Tercatat</p>
        <p className="num mt-1 text-xl font-bold text-ink" data-testid="kpi-total-sales">
          {kpi.total_sales.toLocaleString('id-ID')}
        </p>
        <p className="text-[11px] text-fog mt-0.5">sejak toko buka</p>
      </div>

      {/* 2. Nilai Tercatat */}
      <div className="card card-hover px-4 py-3.5 border border-line bg-card rounded-lg">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-fog">Nilai Tercatat</p>
        <p className="num mt-1 text-xl font-bold text-pine" data-testid="kpi-total-revenue">
          {formatMinor(kpi.total_revenue_minor)}
        </p>
        <p className="text-[11px] text-fog mt-0.5">di luar proyeksi pesanan</p>
      </div>

      {/* 3. Rata-rata Struk */}
      <div className="card card-hover px-4 py-3.5 border border-line bg-card rounded-lg">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-fog">Rata-rata Struk</p>
        <p className="num mt-1 text-xl font-bold text-ink" data-testid="kpi-average-order">
          {formatMinor(kpi.average_order_value_minor)}
        </p>
        <p className="text-[11px] text-fog mt-0.5">per transaksi selesai</p>
      </div>

      {/* 4. Refund */}
      <div className="card card-hover px-4 py-3.5 border border-line bg-card rounded-lg">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-fog">Refund</p>
        <p className="num mt-1 text-xl font-bold text-clay" data-testid="kpi-refund">
          {refundDisplay}
        </p>
        <p className="text-[11px] text-fog mt-0.5">perlu pengecekan stok</p>
      </div>
    </div>
  );
}
