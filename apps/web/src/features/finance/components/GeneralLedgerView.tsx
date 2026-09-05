'use client';

import React from 'react';
import { formatMinor } from '@/lib/format';
import type { GeneralLedgerReportDto, AccountDto } from '../types';
import { BookOpen, ArrowDownUp, Filter } from 'lucide-react';

export interface GeneralLedgerViewProps {
  data: GeneralLedgerReportDto | null;
  isLoading: boolean;
  error: string | null;
  fromDate: string;
  toDate: string;
  accounts?: AccountDto[];
  selectedAccountId?: string;
  onAccountSelect?: (accountId: string) => void;
}

export function GeneralLedgerView({
  data,
  isLoading,
  error,
  fromDate,
  toDate,
  accounts = [],
  selectedAccountId = '',
  onAccountSelect,
}: GeneralLedgerViewProps) {
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
        <p className="text-sm font-bold text-rose-800">Gagal Memuat Laporan Buku Besar</p>
        <p className="text-xs text-rose-600 mt-1">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center text-fog">
        <p className="text-sm font-semibold">Tidak ada data buku besar untuk periode ini.</p>
      </div>
    );
  }

  const openingBalance = data.opening_balance || 0;
  const periodMovements = data.period_movements || 0;
  const closingBalance = data.closing_balance || 0;
  const entries = data.entries || [];

  return (
    <div className="space-y-5">
      {/* 3 Overview KPI Cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {/* Opening Balance */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-fog">
            <span className="text-xs font-semibold">Saldo Awal (Opening)</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <BookOpen className="h-4 w-4" />
            </span>
          </div>
          <p className="font-display text-xl font-bold tracking-tight text-ink mt-2">
            {formatMinor(openingBalance)}
          </p>
          <p className="text-[11px] text-fog mt-0.5">Saldo sebelum tanggal {fromDate}</p>
        </div>

        {/* Period Movements */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-fog">
            <span className="text-xs font-semibold">Mutasi Periode</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <ArrowDownUp className="h-4 w-4" />
            </span>
          </div>
          <p className="font-display text-xl font-bold tracking-tight text-ink mt-2">
            {formatMinor(periodMovements)}
          </p>
          <p className="text-[11px] text-fog mt-0.5">Perubahan bersih selama periode</p>
        </div>

        {/* Closing Balance */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-fog">
            <span className="text-xs font-semibold">Saldo Akhir (Closing)</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <BookOpen className="h-4 w-4" />
            </span>
          </div>
          <p className="font-display text-xl font-bold tracking-tight text-emerald-700 mt-2">
            {formatMinor(closingBalance)}
          </p>
          <p className="text-[11px] text-fog mt-0.5">Posisi saldo per {toDate}</p>
        </div>
      </div>

      {/* Entries Table */}
      <div className="rounded-2xl border border-line bg-surface shadow-2xs overflow-hidden">
        <div className="border-b border-line bg-paper/50 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-bold text-ink">
              Rincian Jurnal Buku Besar
            </h2>
            <p className="text-[11px] text-fog">
              Periode: {fromDate} s/d {toDate} ({entries.length} mutasi)
            </p>
          </div>

          {/* Account Filter */}
          {accounts.length > 0 && onAccountSelect && (
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-fog" />
              <select
                aria-label="Filter Akun"
                value={selectedAccountId}
                onChange={(e) => onAccountSelect(e.target.value)}
                className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink focus:border-pine focus:outline-none cursor-pointer"
              >
                <option value="">Semua Akun Perkiraan</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {`${acc.code} — ${acc.name}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {entries.length === 0 ? (
          <div className="p-8 text-center text-fog">
            <p className="text-xs font-semibold">Tidak ada jurnal transaksi pada periode ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-paper/60 text-[11px] font-bold uppercase text-fog">
                <tr>
                  <th className="py-2.5 px-4">Tanggal</th>
                  <th className="py-2.5 px-3">Akun</th>
                  <th className="py-2.5 px-3">Sumber</th>
                  <th className="py-2.5 px-3">Keterangan</th>
                  <th className="py-2.5 px-3 text-right">Debit</th>
                  <th className="py-2.5 px-3 text-right">Kredit</th>
                  <th className="py-2.5 px-4 text-right">Saldo Berjalan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {entries.map((entry, idx) => (
                  <tr key={`${entry.journal_entry_id}-${entry.account_id}-${idx}`} className="hover:bg-paper/30">
                    <td className="py-2.5 px-4 font-medium text-ink whitespace-nowrap">{entry.date}</td>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-ink">{entry.account_name}</p>
                      <p className="text-[10px] text-fog">{entry.account_code}</p>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase bg-paper border border-line text-fog">
                        {entry.source_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-ink max-w-xs truncate">{entry.description || '-'}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-ink">
                      {entry.debit_minor > 0 ? formatMinor(entry.debit_minor) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-ink">
                      {entry.credit_minor > 0 ? formatMinor(entry.credit_minor) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-ink whitespace-nowrap">
                      {formatMinor(entry.running_balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
