'use client';

import React from 'react';
import { formatMinor } from '@/lib/format';
import type { TrialBalanceReportDto } from '../types';
import { CheckCircle2, AlertTriangle, ShieldCheck, Scale } from 'lucide-react';

export interface TrialBalanceViewProps {
  data: TrialBalanceReportDto | null;
  isLoading: boolean;
  error: string | null;
  fromDate: string;
  toDate: string;
}

export function TrialBalanceView({
  data,
  isLoading,
  error,
  fromDate,
  toDate,
}: TrialBalanceViewProps) {
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
        <p className="text-sm font-bold text-rose-800">Gagal Memuat Laporan Neraca Saldo</p>
        <p className="text-xs text-rose-600 mt-1">{error}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center text-fog">
        <p className="text-sm font-semibold">Tidak ada akun atau saldo pada periode ini.</p>
      </div>
    );
  }

  const totalDebit = data.reduce((sum, item) => sum + (item.debit_total || 0), 0);
  const totalCredit = data.reduce((sum, item) => sum + (item.credit_total || 0), 0);
  const isBalanced = totalDebit === totalCredit;
  const diff = Math.abs(totalDebit - totalCredit);

  return (
    <div className="space-y-5">
      {/* Debit/Credit Equality Verification Status Banner */}
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
                ? 'Neraca Saldo Seimbang (Balanced)'
                : 'Peringatan: Neraca Saldo Tidak Seimbang'}
            </p>
            <p className="text-xs text-fog">
              {isBalanced
                ? 'Total Debit sama persis dengan Total Kredit di seluruh akun.'
                : `Terdapat selisih pembukuan sebesar ${formatMinor(diff)} antara total Debit dan Kredit.`}
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
        {/* Total Debit */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-fog">
            <span className="text-xs font-semibold">Total Debit</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Scale className="h-4 w-4" />
            </span>
          </div>
          <p className="font-display text-xl font-bold tracking-tight text-ink mt-2">
            {formatMinor(totalDebit)}
          </p>
          <p className="text-[11px] text-fog mt-0.5">Akumulasi mutasi debit seluruh akun</p>
        </div>

        {/* Total Credit */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-fog">
            <span className="text-xs font-semibold">Total Kredit</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Scale className="h-4 w-4" />
            </span>
          </div>
          <p className="font-display text-xl font-bold tracking-tight text-ink mt-2">
            {formatMinor(totalCredit)}
          </p>
          <p className="text-[11px] text-fog mt-0.5">Akumulasi mutasi kredit seluruh akun</p>
        </div>

        {/* Total Accounts */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-fog">
            <span className="text-xs font-semibold">Jumlah Akun Aktif</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <Scale className="h-4 w-4" />
            </span>
          </div>
          <p className="font-display text-xl font-bold tracking-tight text-ink mt-2">
            {data.length} Akun
          </p>
          <p className="text-[11px] text-fog mt-0.5">Bagan akun perkiraan (COA)</p>
        </div>
      </div>

      {/* Trial Balance Table */}
      <div className="rounded-2xl border border-line bg-surface shadow-2xs overflow-hidden">
        <div className="border-b border-line bg-paper/50 px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="font-display text-sm font-bold text-ink">
              Neraca Saldo (Trial Balance)
            </h2>
            <p className="text-[11px] text-fog">
              Periode: {fromDate} s/d {toDate} ({data.length} akun terdaftar)
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-paper/60 text-[11px] font-bold uppercase text-fog">
              <tr>
                <th className="py-2.5 px-4">Kode Akun</th>
                <th className="py-2.5 px-3">Nama Akun</th>
                <th className="py-2.5 px-3">Tipe</th>
                <th className="py-2.5 px-3 text-right">Debit Total</th>
                <th className="py-2.5 px-3 text-right">Kredit Total</th>
                <th className="py-2.5 px-4 text-right">Saldo Bersih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {data.map((item) => (
                <tr key={item.account_id} className="hover:bg-paper/30">
                  <td className="py-2.5 px-4 font-bold text-ink whitespace-nowrap">{item.account_code}</td>
                  <td className="py-2.5 px-3 font-medium text-ink">{item.account_name}</td>
                  <td className="py-2.5 px-3">
                    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-paper border border-line text-fog">
                      {item.account_type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-ink">
                    {item.debit_total > 0 ? formatMinor(item.debit_total) : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-ink">
                    {item.credit_total > 0 ? formatMinor(item.credit_total) : '-'}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right font-bold ${
                      item.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {formatMinor(item.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-line bg-paper/40 font-bold">
              <tr>
                <td colSpan={3} className="py-3 px-4 text-ink">Total Keseimbangan</td>
                <td className="py-3 px-3 text-right text-ink font-display text-xs">{formatMinor(totalDebit)}</td>
                <td className="py-3 px-3 text-right text-ink font-display text-xs">{formatMinor(totalCredit)}</td>
                <td
                  className={`py-3 px-4 text-right font-display text-xs ${
                    isBalanced ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {isBalanced ? 'Rp 0 (Seimbang)' : formatMinor(diff)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
