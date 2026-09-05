'use client';

import React from 'react';
import { formatMinor } from '@/lib/format';
import type { CashflowStatementReportDto } from '../types';
import { ArrowUpRight, ArrowDownRight, DollarSign, Wallet } from 'lucide-react';

export interface CashflowReportViewProps {
  data: CashflowStatementReportDto | null;
  isLoading: boolean;
  error: string | null;
  fromDate: string;
  toDate: string;
}

export function CashflowReportView({
  data,
  isLoading,
  error,
  fromDate,
  toDate,
}: CashflowReportViewProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
        <p className="text-sm font-bold text-rose-800">Gagal Memuat Laporan Arus Kas</p>
        <p className="text-xs text-rose-600 mt-1">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center text-fog">
        <p className="text-sm font-semibold">Tidak ada data arus kas untuk periode ini.</p>
      </div>
    );
  }

  const totalInflow = data.total_inflow || 0;
  const totalOutflow = data.total_outflow || 0;
  const netCashFlow = data.net_cash_flow;
  const isPositive = netCashFlow >= 0;
  const entries = data.entries || [];

  return (
    <div className="space-y-5">
      {/* 3 Overview KPI Cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {/* Total Inflow */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-fog">
            <span className="text-xs font-semibold">Total Kas Masuk (Inflow)</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
          <p className="font-display text-xl font-bold tracking-tight text-emerald-700 mt-2">
            {formatMinor(totalInflow)}
          </p>
          <p className="text-[11px] text-fog mt-0.5">Penerimaan dari penjualan & kas</p>
        </div>

        {/* Total Outflow */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-fog">
            <span className="text-xs font-semibold">Total Kas Keluar (Outflow)</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <ArrowDownRight className="h-4 w-4" />
            </span>
          </div>
          <p className="font-display text-xl font-bold tracking-tight text-rose-700 mt-2">
            {formatMinor(totalOutflow)}
          </p>
          <p className="text-[11px] text-fog mt-0.5">Pengeluaran beban & hutang</p>
        </div>

        {/* Net Cash Flow */}
        <div
          className={`rounded-2xl border p-4 shadow-2xs ${
            isPositive
              ? 'border-emerald-200 bg-emerald-50/50'
              : 'border-rose-200 bg-rose-50/50'
          }`}
        >
          <div className="flex items-center justify-between text-fog">
            <span className="text-xs font-semibold text-ink">Arus Kas Bersih (Net Flow)</span>
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                isPositive
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              <DollarSign className="h-4 w-4" />
            </span>
          </div>
          <p
            className={`font-display text-xl font-bold tracking-tight mt-2 ${
              isPositive ? 'text-emerald-800' : 'text-rose-800'
            }`}
          >
            {formatMinor(netCashFlow)}
          </p>
          <p className="text-[11px] text-fog mt-0.5">
            {isPositive ? 'Surplus kas periode berjalan' : 'Defisit kas periode berjalan'}
          </p>
        </div>
      </div>

      {/* Cashflow Movements Table */}
      <div className="rounded-2xl border border-line bg-surface shadow-2xs overflow-hidden">
        <div className="border-b border-line bg-paper/50 px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="font-display text-sm font-bold text-ink flex items-center gap-2">
              <Wallet className="h-4 w-4 text-pine" />
              Detail Mutasi Kas & Bank
            </h2>
            <p className="text-[11px] text-fog">
              Periode: {fromDate} s/d {toDate} ({entries.length} transaksi)
            </p>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="p-8 text-center text-fog">
            <p className="text-xs font-semibold">Tidak ada transaksi kas atau bank pada rentang tanggal ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-paper/60 text-[11px] font-bold uppercase text-fog">
                <tr>
                  <th className="py-2.5 px-4">Tanggal</th>
                  <th className="py-2.5 px-3">Akun Kas / Bank</th>
                  <th className="py-2.5 px-3">Keterangan</th>
                  <th className="py-2.5 px-3 text-right">Kas Masuk (Dr)</th>
                  <th className="py-2.5 px-3 text-right">Kas Keluar (Cr)</th>
                  <th className="py-2.5 px-4 text-right">Arus Bersih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {entries.map((entry, idx) => (
                  <tr key={entry.journal_line_id || `${entry.journal_entry_id}-${idx}`} className="hover:bg-paper/30">
                    <td className="py-2.5 px-4 font-medium text-ink whitespace-nowrap">{entry.date}</td>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-ink">{entry.account_name}</p>
                      <p className="text-[10px] text-fog">{entry.account_code} ({entry.account_type})</p>
                    </td>
                    <td className="py-2.5 px-3 text-ink max-w-xs truncate">
                      {entry.description || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-emerald-700">
                      {entry.debit_minor > 0 ? formatMinor(entry.debit_minor) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-rose-700">
                      {entry.credit_minor > 0 ? formatMinor(entry.credit_minor) : '-'}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-bold ${
                        entry.net_flow >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {formatMinor(entry.net_flow)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-line bg-paper/40 font-bold">
                <tr>
                  <td colSpan={3} className="py-3 px-4 text-ink">Total Kas Masuk / Keluar</td>
                  <td className="py-3 px-3 text-right text-emerald-700">{formatMinor(totalInflow)}</td>
                  <td className="py-3 px-3 text-right text-rose-700">{formatMinor(totalOutflow)}</td>
                  <td
                    className={`py-3 px-4 text-right ${
                      isPositive ? 'text-emerald-800' : 'text-rose-800'
                    }`}
                  >
                    {formatMinor(netCashFlow)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
