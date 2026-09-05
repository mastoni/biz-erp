'use client';

import React from 'react';
import { formatMinor } from '@/lib/format';
import type { ProfitLossReportDto } from '../types';
import { TrendingUp, ArrowDownRight, ArrowUpRight, DollarSign } from 'lucide-react';

export interface ProfitLossViewProps {
  data: ProfitLossReportDto | null;
  isLoading: boolean;
  error: string | null;
  fromDate: string;
  toDate: string;
}

export function ProfitLossView({
  data,
  isLoading,
  error,
  fromDate,
  toDate,
}: ProfitLossViewProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
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
        <p className="text-sm font-bold text-rose-800">Gagal Memuat Laporan Laba Rugi</p>
        <p className="text-xs text-rose-600 mt-1">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center text-fog">
        <p className="text-sm font-semibold">Tidak ada data untuk periode ini.</p>
      </div>
    );
  }

  const revenue = data.revenue_minor || 0;
  const cogs = data.cogs_minor || 0;
  const grossProfit = revenue - cogs;
  const operatingExpense = data.operating_expense_minor || 0;
  const totalExpense = data.expense_minor || (cogs + operatingExpense);
  const netIncome = data.net_income_minor;
  const netMargin = revenue > 0 ? Math.round((netIncome / revenue) * 100) : 0;
  const isProfitable = netIncome >= 0;

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-fog">
            <span className="text-xs font-semibold">Total Pendapatan</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
          <p className="font-display text-xl font-bold tracking-tight text-ink mt-2">
            {formatMinor(revenue)}
          </p>
          <p className="text-[11px] text-fog mt-0.5">Pendapatan kotor penjualan</p>
        </div>

        {/* Total COGS / HPP */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-fog">
            <span className="text-xs font-semibold">Beban Pokok (HPP)</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <ArrowDownRight className="h-4 w-4" />
            </span>
          </div>
          <p className="font-display text-xl font-bold tracking-tight text-ink mt-2">
            {formatMinor(cogs)}
          </p>
          <p className="text-[11px] text-fog mt-0.5">Biaya modal barang terjual</p>
        </div>

        {/* Operating Expenses */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-fog">
            <span className="text-xs font-semibold">Beban Operasional</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <DollarSign className="h-4 w-4" />
            </span>
          </div>
          <p className="font-display text-xl font-bold tracking-tight text-ink mt-2">
            {formatMinor(operatingExpense)}
          </p>
          <p className="text-[11px] text-fog mt-0.5">Beban umum & operasional</p>
        </div>

        {/* Net Income / Profit */}
        <div
          className={`rounded-2xl border p-4 shadow-2xs ${
            isProfitable
              ? 'border-emerald-200 bg-emerald-50/50'
              : 'border-rose-200 bg-rose-50/50'
          }`}
        >
          <div className="flex items-center justify-between text-fog">
            <span className="text-xs font-semibold text-ink">Laba Bersih</span>
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                isProfitable
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <p
            className={`font-display text-xl font-bold tracking-tight mt-2 ${
              isProfitable ? 'text-emerald-800' : 'text-rose-800'
            }`}
          >
            {formatMinor(netIncome)}
          </p>
          <p className="text-[11px] text-fog mt-0.5">
            Margin: <span className="font-bold text-ink">{`${netMargin}%`}</span>
          </p>
        </div>
      </div>

      {/* Structured Income Statement Table */}
      <div className="rounded-2xl border border-line bg-surface shadow-2xs overflow-hidden">
        <div className="border-b border-line bg-paper/50 px-5 py-3.5">
          <h2 className="font-display text-sm font-bold text-ink">
            Laporan Laba Rugi Komprehensif
          </h2>
          <p className="text-[11px] text-fog">
            Periode: {fromDate} s/d {toDate}
          </p>
        </div>

        <div className="p-5">
          <table className="w-full text-left text-xs">
            <tbody>
              {/* Section 1: Pendapatan */}
              <tr className="border-b border-line/60 bg-paper/30">
                <td colSpan={2} className="py-2.5 font-bold uppercase tracking-wider text-fog text-[11px]">
                  1. Pendapatan Usaha
                </td>
              </tr>
              <tr className="border-b border-line/40 hover:bg-paper/20">
                <td className="py-2 pl-4 text-ink">Penjualan Bersih (Revenue)</td>
                <td className="py-2 text-right font-medium text-ink">{formatMinor(revenue)}</td>
              </tr>
              <tr className="border-b border-line bg-paper/10 font-semibold">
                <td className="py-2.5 pl-2 text-ink">Total Pendapatan</td>
                <td className="py-2.5 text-right text-emerald-700 font-bold">{formatMinor(revenue)}</td>
              </tr>

              {/* Section 2: HPP */}
              <tr className="border-b border-line/60 bg-paper/30">
                <td colSpan={2} className="pt-4 pb-2.5 font-bold uppercase tracking-wider text-fog text-[11px]">
                  2. Harga Pokok Penjualan (HPP)
                </td>
              </tr>
              <tr className="border-b border-line/40 hover:bg-paper/20">
                <td className="py-2 pl-4 text-ink">Beban Pokok Penjualan (COGS)</td>
                <td className="py-2 text-right font-medium text-ink">({formatMinor(cogs)})</td>
              </tr>
              <tr className="border-b border-line bg-paper/10 font-semibold">
                <td className="py-2.5 pl-2 text-ink">Laba Kotor (Gross Profit)</td>
                <td className="py-2.5 text-right font-bold text-ink">{formatMinor(grossProfit)}</td>
              </tr>

              {/* Section 3: Beban Operasional */}
              <tr className="border-b border-line/60 bg-paper/30">
                <td colSpan={2} className="pt-4 pb-2.5 font-bold uppercase tracking-wider text-fog text-[11px]">
                  3. Beban Usaha & Operasional
                </td>
              </tr>
              <tr className="border-b border-line/40 hover:bg-paper/20">
                <td className="py-2 pl-4 text-ink">Beban Operasional & Administrasi</td>
                <td className="py-2 text-right font-medium text-ink">({formatMinor(operatingExpense)})</td>
              </tr>
              <tr className="border-b border-line bg-paper/10 font-semibold">
                <td className="py-2.5 pl-2 text-ink">Total Beban Usaha</td>
                <td className="py-2.5 text-right font-bold text-rose-700">({formatMinor(totalExpense)})</td>
              </tr>

              {/* Bottom: Net Income */}
              <tr className={`border-t-2 ${isProfitable ? 'border-emerald-600 bg-emerald-50/70' : 'border-rose-600 bg-rose-50/70'}`}>
                <td className="py-3.5 pl-2 font-display text-sm font-bold text-ink">
                  Laba (Rugi) Bersih Periode Berjalan
                </td>
                <td className={`py-3.5 text-right font-display text-sm font-bold ${isProfitable ? 'text-emerald-800' : 'text-rose-800'}`}>
                  {formatMinor(netIncome)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
