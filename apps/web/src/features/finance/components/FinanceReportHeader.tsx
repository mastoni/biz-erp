'use client';

import React from 'react';
import {
  FileText,
  TrendingUp,
  Scale,
  DollarSign,
  BookOpen,
  ListChecks,
  Download,
  Printer,
  RefreshCw,
  Building2,
  Calendar,
} from 'lucide-react';
import type { Branch } from '@/features/inventory/types';

export type ReportTab = 'labarugi' | 'neraca' | 'aruskas' | 'bukubesar' | 'neracasaldo';
export type PeriodPreset = 'bulan-ini' | 'bulan-lalu' | 'ytd' | 'kustom';

export interface FinanceReportHeaderProps {
  activeTab: ReportTab;
  onTabChange: (tab: ReportTab) => void;
  preset: PeriodPreset;
  onPresetChange: (preset: PeriodPreset) => void;
  fromDate: string;
  toDate: string;
  asOfDate: string;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
  onAsOfDateChange: (date: string) => void;
  branches: Branch[];
  selectedBranchId: string;
  onBranchChange: (branchId: string) => void;
  onExportCsv: () => void;
  onPrint: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  dateError?: string | null;
}

export const REPORT_TABS_CONFIG: Array<{
  id: ReportTab;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'labarugi',
    label: 'Laba Rugi',
    desc: 'Pendapatan, HPP, & Beban Usaha',
    icon: TrendingUp,
  },
  {
    id: 'neraca',
    label: 'Neraca',
    desc: 'Posisi Aset, Kewajiban, & Ekuitas',
    icon: Scale,
  },
  {
    id: 'aruskas',
    label: 'Arus Kas',
    desc: 'Penerimaan & Pengeluaran Kas/Bank',
    icon: DollarSign,
  },
  {
    id: 'bukubesar',
    label: 'Buku Besar',
    desc: 'Mutasi Terperinci Seluruh Akun',
    icon: BookOpen,
  },
  {
    id: 'neracasaldo',
    label: 'Neraca Saldo',
    desc: 'Ringkasan Saldo Debit & Kredit Akun',
    icon: ListChecks,
  },
];

export function FinanceReportHeader({
  activeTab,
  onTabChange,
  preset,
  onPresetChange,
  fromDate,
  toDate,
  asOfDate,
  onFromDateChange,
  onToDateChange,
  onAsOfDateChange,
  branches,
  selectedBranchId,
  onBranchChange,
  onExportCsv,
  onPrint,
  onRefresh,
  isLoading,
  dateError,
}: FinanceReportHeaderProps) {
  const isBalanceSheet = activeTab === 'neraca';

  return (
    <div className="space-y-4 print:hidden">
      {/* Title & Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pine/10 text-pine">
              <FileText className="h-4 w-4" />
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Laporan Keuangan
            </h1>
          </div>
          <p className="text-xs text-fog mt-0.5">
            Laporan keuangan standar akuntansi untuk pemantauan performa bisnis.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink shadow-2xs transition hover:bg-paper cursor-pointer disabled:opacity-50"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-fog ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={onPrint}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink shadow-2xs transition hover:bg-paper cursor-pointer"
            title="Cetak Laporan"
          >
            <Printer className="h-3.5 w-3.5 text-fog" />
            <span>Cetak</span>
          </button>

          <button
            type="button"
            onClick={onExportCsv}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl bg-pine px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-pine-deep cursor-pointer disabled:opacity-50"
            title="Unduh file CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 border-b border-line pb-2">
        {REPORT_TABS_CONFIG.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex items-start gap-2.5 rounded-xl p-3 text-left transition cursor-pointer border ${
                isActive
                  ? 'border-pine bg-pine/5 text-pine shadow-2xs'
                  : 'border-transparent bg-surface text-ink hover:border-line hover:bg-paper'
              }`}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  isActive ? 'bg-pine text-white' : 'bg-paper text-fog'
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate">{tab.label}</p>
                <p className="text-[10px] text-fog truncate">{tab.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-2xs">
        {/* Left: Preset Selector */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-fog mr-1 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            Periode:
          </span>
          {(
            [
              { id: 'bulan-ini', label: 'Bulan Ini' },
              { id: 'bulan-lalu', label: 'Bulan Lalu' },
              { id: 'ytd', label: 'Tahun Berjalan (YTD)' },
              { id: 'kustom', label: 'Kustom' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPresetChange(p.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                preset === p.id
                  ? 'bg-pine text-white shadow-2xs'
                  : 'bg-paper text-ink hover:bg-line/40'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Right: Date Pickers & Branch Filter */}
        <div className="flex flex-wrap items-center gap-3">
          {isBalanceSheet ? (
            <div className="flex items-center gap-1.5">
              <label htmlFor="asOfInput" className="text-xs font-medium text-fog">
                Per Tanggal:
              </label>
              <input
                id="asOfInput"
                type="date"
                value={asOfDate}
                onChange={(e) => onAsOfDateChange(e.target.value)}
                className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink focus:border-pine focus:outline-none"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <label htmlFor="fromInput" className="text-xs font-medium text-fog">
                  Dari:
                </label>
                <input
                  id="fromInput"
                  type="date"
                  value={fromDate}
                  onChange={(e) => onFromDateChange(e.target.value)}
                  className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink focus:border-pine focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label htmlFor="toInput" className="text-xs font-medium text-fog">
                  Sampai:
                </label>
                <input
                  id="toInput"
                  type="date"
                  value={toDate}
                  onChange={(e) => onToDateChange(e.target.value)}
                  className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink focus:border-pine focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Branch selector if multiple branches exist */}
          {branches.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-fog" />
              <select
                aria-label="Filter Cabang"
                value={selectedBranchId}
                onChange={(e) => onBranchChange(e.target.value)}
                className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink focus:border-pine focus:outline-none cursor-pointer"
              >
                <option value="">Semua Cabang</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Date Validation Error Feedback */}
      {dateError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          {dateError}
        </div>
      )}
    </div>
  );
}
