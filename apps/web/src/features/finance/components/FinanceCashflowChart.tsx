'use client';

import React from 'react';
import type { MonthlyCashflowPoint } from '../types';

interface FinanceCashflowChartProps {
  data: MonthlyCashflowPoint[];
  isLoading?: boolean;
  error?: string | null;
}

function idrShort(val: number): string {
  if (Math.abs(val) >= 1_000_000_000) {
    return `Rp ${(val / 1_000_000_000).toFixed(1)} M`;
  }
  if (Math.abs(val) >= 1_000_000) {
    return `Rp ${(val / 1_000_000).toFixed(1)} jt`;
  }
  if (Math.abs(val) >= 1_000) {
    return `Rp ${(val / 1_000).toFixed(0)} rb`;
  }
  return `Rp ${val}`;
}

export function FinanceCashflowChart({
  data,
  isLoading,
  error,
}: FinanceCashflowChartProps) {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-line bg-surface p-6">
        <p className="text-xs text-fog">Memuat data grafik arus kas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 p-6">
        <p className="text-xs font-semibold text-rose-700">{error}</p>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="font-semibold text-ink text-sm">Belum Ada Riwayat Arus Kas</p>
        <p className="text-xs text-fog mt-1">Transaksi penjualan dan kas operasional akan otomatis ditampilkan di sini.</p>
      </div>
    );
  }

  const maxVal = Math.max(
    ...data.flatMap((d) => [d.inflow_minor, d.outflow_minor]),
    1
  );

  // Find peak month
  const peak = data.reduce((prev, curr) =>
    curr.inflow_minor > prev.inflow_minor ? curr : prev
  , data[0]);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-2xs">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold text-ink">
            Arus Kas Multi-Bulan
          </h3>
          <p className="text-xs text-fog">
            Perbandingan pemasukan vs pengeluaran operasional toko
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-semibold text-fog">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#17593e]" /> Pemasukan
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#d3921f]" /> Pengeluaran
          </span>
        </div>
      </div>

      {/* Pair Bars Visualization */}
      <div className="flex h-48 items-end gap-3 pt-6 pb-2">
        {data.map((pt) => {
          const inPct = Math.max(4, Math.round((pt.inflow_minor / maxVal) * 100));
          const outPct = Math.max(4, Math.round((pt.outflow_minor / maxVal) * 100));

          return (
            <div
              key={pt.month}
              className="group relative flex flex-1 flex-col items-center justify-end h-full"
            >
              {/* Tooltip on hover */}
              <div className="pointer-events-none absolute -top-8 hidden rounded-lg border border-line bg-surface px-2 py-1 text-[10px] font-bold text-ink shadow-md group-hover:block z-10 whitespace-nowrap">
                Masuk: {idrShort(pt.inflow_minor)} | Keluar: {idrShort(pt.outflow_minor)}
              </div>

              {/* Bars Pair */}
              <div className="flex w-full items-end justify-center gap-1.5 h-full">
                {/* Inflow Bar */}
                <div
                  className="w-full max-w-[18px] rounded-t-sm bg-[#17593e] transition-all duration-300 group-hover:brightness-110"
                  style={{ height: `${inPct}%` }}
                />
                {/* Outflow Bar */}
                <div
                  className="w-full max-w-[18px] rounded-t-sm bg-[#d3921f] transition-all duration-300 group-hover:brightness-110"
                  style={{ height: `${outPct}%` }}
                />
              </div>

              {/* Month Label */}
              <p className="num mt-2 text-[11px] font-semibold text-fog">
                {pt.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Commentary Footer */}
      {peak && (
        <p className="mt-4 rounded-xl border border-line bg-paper/60 px-4 py-2.5 text-xs text-fog">
          Bulan <span className="font-bold text-ink">{peak.label}</span> mencatatkan pemasukan tertinggi sebesar{' '}
          <span className="num font-bold text-emerald-700">
            {idrShort(peak.inflow_minor)}
          </span>
          .
        </p>
      )}
    </div>
  );
}
