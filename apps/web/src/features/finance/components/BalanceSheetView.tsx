'use client';

import React from 'react';
import { formatMinor } from '@/lib/format';
import type { BalanceSheetReportDto } from '../types';
import { CheckCircle2, AlertTriangle, ShieldCheck, Landmark } from 'lucide-react';

export interface BalanceSheetViewProps {
  data: BalanceSheetReportDto | null;
  isLoading: boolean;
  error: string | null;
  asOfDate: string;
}

export function BalanceSheetView({
  data,
  isLoading,
  error,
  asOfDate,
}: BalanceSheetViewProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-line bg-surface p-4"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl border border-line bg-surface p-4" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
        <p className="text-sm font-bold text-rose-800">Gagal Memuat Laporan Neraca</p>
        <p className="text-xs text-rose-600 mt-1">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center text-fog">
        <p className="text-sm font-semibold">Tidak ada data neraca untuk tanggal ini.</p>
      </div>
    );
  }

  const totalAssets = data.total_assets_minor || 0;
  const totalLiabilities = data.total_liabilities_minor || 0;
  const totalEquity = data.total_equity_minor || 0;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  const isBalanced = totalAssets === totalLiabilitiesAndEquity;
  const diff = Math.abs(totalAssets - totalLiabilitiesAndEquity);

  return (
    <div className="space-y-5">
      {/* Balancing Verification Status Banner */}
      <div
        className={`flex items-center justify-between gap-3 rounded-2xl border p-4 shadow-2xs ${
          isBalanced
            ? 'border-emerald-200 bg-emerald-50/80 text-emerald-900'
            : 'border-amber-200 bg-amber-50/80 text-amber-900'
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${
              isBalanced
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-600 text-white'
            }`}
          >
            {isBalanced ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </span>
          <div>
            <p className="font-display text-sm font-bold">
              {isBalanced
                ? 'Neraca Keuangan Seimbang'
                : 'Peringatan: Neraca Tidak Seimbang'}
            </p>
            <p className="text-xs text-fog">
              {isBalanced
                ? 'Total Aset sama persis dengan Total Liabilitas + Ekuitas (Aset = Kewajiban + Modal).'
                : `Terdapat selisih pembukuan sebesar ${formatMinor(diff)} antara Aset dan Pasiva.`}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold ${
              isBalanced
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {isBalanced ? 'Status: Balanced' : 'Status: Unbalanced'}
          </span>
        </div>
      </div>

      {/* 3 Overview KPI Cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {/* Total Assets */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-fog">
            <span className="text-xs font-semibold">Total Aset (Aktiva)</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Landmark className="h-4 w-4" />
            </span>
          </div>
          <p className="font-display text-xl font-bold tracking-tight text-ink mt-2">
            {formatMinor(totalAssets)}
          </p>
          <p className="text-[11px] text-fog mt-0.5">Kas, bank, piutang, dan stok</p>
        </div>

        {/* Total Liabilities */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-fog">
            <span className="text-xs font-semibold">Total Kewajiban (Hutang)</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Landmark className="h-4 w-4" />
            </span>
          </div>
          <p className="font-display text-xl font-bold tracking-tight text-ink mt-2">
            {formatMinor(totalLiabilities)}
          </p>
          <p className="text-[11px] text-fog mt-0.5">Hutang usaha & operasional</p>
        </div>

        {/* Total Equity */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-fog">
            <span className="text-xs font-semibold">Total Ekuitas (Modal)</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Landmark className="h-4 w-4" />
            </span>
          </div>
          <p className="font-display text-xl font-bold tracking-tight text-ink mt-2">
            {formatMinor(totalEquity)}
          </p>
          <p className="text-[11px] text-fog mt-0.5">Modal pemilik & laba ditahan</p>
        </div>
      </div>

      {/* Detailed Balance Sheet Tables: Two Columns (Aktiva vs Pasiva) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Column: Aktiva (Aset) */}
        <div className="rounded-2xl border border-line bg-surface shadow-2xs overflow-hidden">
          <div className="border-b border-line bg-paper/50 px-5 py-3.5">
            <h2 className="font-display text-sm font-bold text-ink">
              Aktiva / Aset
            </h2>
            <p className="text-[11px] text-fog">Per Tanggal: {asOfDate}</p>
          </div>

          <div className="p-5">
            <table className="w-full text-left text-xs">
              <tbody>
                <tr className="border-b border-line/60 bg-paper/30">
                  <td colSpan={2} className="py-2.5 font-bold uppercase tracking-wider text-fog text-[11px]">
                    Aset Lancar & Aset Usaha
                  </td>
                </tr>
                <tr className="border-b border-line/40 hover:bg-paper/20">
                  <td className="py-2.5 pl-4 text-ink">Total Nilai Aset Usaha</td>
                  <td className="py-2.5 text-right font-medium text-ink">{formatMinor(totalAssets)}</td>
                </tr>
                <tr className="border-t-2 border-line bg-paper/20 font-bold">
                  <td className="py-3.5 pl-2 font-display text-sm text-ink">Total Aktiva (Aset)</td>
                  <td className="py-3.5 text-right font-display text-sm text-emerald-700">{formatMinor(totalAssets)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Pasiva (Kewajiban & Ekuitas) */}
        <div className="rounded-2xl border border-line bg-surface shadow-2xs overflow-hidden">
          <div className="border-b border-line bg-paper/50 px-5 py-3.5">
            <h2 className="font-display text-sm font-bold text-ink">
              Pasiva (Kewajiban & Ekuitas)
            </h2>
            <p className="text-[11px] text-fog">Per Tanggal: {asOfDate}</p>
          </div>

          <div className="p-5">
            <table className="w-full text-left text-xs">
              <tbody>
                {/* Kewajiban */}
                <tr className="border-b border-line/60 bg-paper/30">
                  <td colSpan={2} className="py-2.5 font-bold uppercase tracking-wider text-fog text-[11px]">
                    1. Kewajiban (Liabilitas)
                  </td>
                </tr>
                <tr className="border-b border-line/40 hover:bg-paper/20">
                  <td className="py-2 pl-4 text-ink">Total Hutang Usaha & Kewajiban</td>
                  <td className="py-2 text-right font-medium text-ink">{formatMinor(totalLiabilities)}</td>
                </tr>

                {/* Ekuitas */}
                <tr className="border-b border-line/60 bg-paper/30">
                  <td colSpan={2} className="pt-4 pb-2.5 font-bold uppercase tracking-wider text-fog text-[11px]">
                    2. Ekuitas (Modal)
                  </td>
                </tr>
                <tr className="border-b border-line/40 hover:bg-paper/20">
                  <td className="py-2 pl-4 text-ink">Modal Pemilik & Laba Ditahan</td>
                  <td className="py-2 text-right font-medium text-ink">{formatMinor(totalEquity)}</td>
                </tr>

                {/* Total Pasiva */}
                <tr className="border-t-2 border-line bg-paper/20 font-bold">
                  <td className="py-3.5 pl-2 font-display text-sm text-ink">Total Pasiva (Kewajiban + Modal)</td>
                  <td className="py-3.5 text-right font-display text-sm text-ink">{formatMinor(totalLiabilitiesAndEquity)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
