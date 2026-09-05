'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  FileSpreadsheet,
} from 'lucide-react';
import { useBookkeepingViewModel } from '../use-bookkeeping-viewmodel';
import { CashTransactionModal } from './CashTransactionModal';
import { DebtSettlementModal } from './DebtSettlementModal';
import { AgingSummaryCards } from './AgingSummaryCards';
import { ReceivablesAgingTable } from './ReceivablesAgingTable';
import { PayablesAgingTable } from './PayablesAgingTable';
import { DebtAuditHistoryModal } from './DebtAuditHistoryModal';
import type { BookkeepingTab, ReceivableItem, PayableItem } from '../types';
import type { Role } from '@/lib/rbac';
import { formatMinor } from '@/lib/format';
import Link from 'next/link';

interface BookkeepingPageProps {
  businessId?: string;
  branchId?: string;
  role?: Role | null;
}

export function BookkeepingPage({ businessId, branchId, role }: BookkeepingPageProps) {
  const {
    tab,
    setTab,
    search,
    setSearch,
    summary,
    cashflow,
    receivables,
    payables,
    filteredCashflow,
    filteredReceivables,
    filteredPayables,
    isLoading,
    isSaving,
    error,
    cashModalOpen,
    setCashModalOpen,
    settlementModalData,
    setSettlementModalData,
    recordCashTransaction,
    settleReceivable,
    settlePayable,
  } = useBookkeepingViewModel({ businessId, branchId });

  const [auditModal, setAuditModal] = useState<{
    open: boolean;
    kind: 'piutang' | 'hutang';
    item: ReceivableItem | PayableItem | null;
  }>({
    open: false,
    kind: 'piutang',
    item: null,
  });

  const isOwner = role === 'OWNER';

  // Compute period totals
  const totalMasuk = cashflow.reduce((sum, c) => sum + (c.debit_minor > 0 ? c.debit_minor : 0), 0);
  const totalKeluar = cashflow.reduce((sum, c) => sum + (c.credit_minor > 0 ? c.credit_minor : 0), 0);
  const netFlow = totalMasuk - totalKeluar;
  const saldoKas = summary ? summary.total_assets : netFlow;

  const tabs: { id: BookkeepingTab; label: string; badge?: number }[] = [
    { id: 'jurnal', label: 'Jurnal Kas' },
    {
      id: 'piutang',
      label: 'Piutang & AR Aging',
      badge: receivables.filter((r) => r.outstanding_minor > 0).length,
    },
    {
      id: 'hutang',
      label: 'Hutang & AP Aging',
      badge: payables.filter((p) => p.outstanding_minor > 0).length,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pine/10 text-pine">
              <BookOpen className="h-4 w-4" />
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Pembukuan Keuangan &amp; Manajemen Hutang Piutang
            </h1>
          </div>
          <p className="text-xs text-fog mt-0.5">
            Catatan arus kas harian, klasifikasi umur piutang pelanggan, dan kewajiban hutang supplier.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/finance/reports"
            className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink shadow-2xs hover:bg-paper cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-fog" />
            <span>Laporan Keuangan</span>
          </Link>

          {isOwner && (
            <button
              type="button"
              onClick={() => setCashModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-pine px-4 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-pine-deep cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Catat Transaksi Kas</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Saldo Kas Berjalan */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-fog">
            Saldo Kas Berjalan
          </p>
          <p className="num mt-1.5 text-xl font-bold text-ink">
            {formatMinor(saldoKas)}
          </p>
          <p className="mt-1 text-[11px] text-fog">Total kas &amp; bank aktif</p>
        </div>

        {/* Total Kas Masuk */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-fog">
            Total Kas Masuk
          </p>
          <p className="num mt-1.5 text-xl font-bold text-emerald-700">
            +{formatMinor(totalMasuk)}
          </p>
          <p className="mt-1 text-[11px] text-fog">Pemasukan &amp; penerimaan</p>
        </div>

        {/* Total Kas Keluar */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-fog">
            Total Kas Keluar
          </p>
          <p className="num mt-1.5 text-xl font-bold text-rose-700">
            -{formatMinor(totalKeluar)}
          </p>
          <p className="mt-1 text-[11px] text-fog">Pengeluaran &amp; belanja</p>
        </div>

        {/* Arus Kas Bersih */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-fog">
            Arus Kas Bersih
          </p>
          <p className={`num mt-1.5 text-xl font-bold ${netFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {netFlow >= 0 ? `+${formatMinor(netFlow)}` : `-${formatMinor(Math.abs(netFlow))}`}
          </p>
          <p className="mt-1 text-[11px] text-fog">Net flow periode</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex rounded-2xl border border-line bg-surface p-1 shadow-2xs max-w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              tab === t.id
                ? 'bg-pine text-white shadow-2xs'
                : 'text-fog hover:text-ink'
            }`}
          >
            <span>{t.label}</span>
            {t.badge !== undefined && t.badge > 0 && (
              <span
                className={`num rounded-md px-1.5 py-0.2 text-[10px] font-bold ${
                  tab === t.id ? 'bg-white/20 text-white' : 'bg-ink/5 text-ink'
                }`}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab 1: Jurnal Kas */}
      {tab === 'jurnal' && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper/40 px-5 py-3">
            <span className="text-xs font-bold text-ink">Catatan Transaksi Arus Kas</span>
            <div className="relative min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fog" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari transaksi kas..."
                className="w-full rounded-xl border border-line bg-surface py-1.5 pl-8.5 pr-3 text-xs text-ink placeholder:text-fog/60 focus:border-pine focus:outline-hidden"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-paper/60 text-[11px] font-bold uppercase tracking-wider text-fog">
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Keterangan</th>
                  <th className="px-4 py-3">Akun</th>
                  <th className="px-4 py-3">Tipe</th>
                  <th className="px-4 py-3 text-right">Masuk</th>
                  <th className="px-4 py-3 text-right">Keluar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60 bg-surface">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-fog">
                      Memuat data jurnal kas...
                    </td>
                  </tr>
                ) : filteredCashflow.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-fog">
                      Tidak ada catatan kas yang cocok.
                    </td>
                  </tr>
                ) : (
                  filteredCashflow.map((entry, idx) => (
                    <tr key={entry.journal_line_id || idx} className="hover:bg-paper/40 transition">
                      <td className="num px-4 py-3 font-medium text-fog">{entry.date}</td>
                      <td className="px-4 py-3 font-semibold text-ink">
                        {entry.description || 'Transaksi Kas'}
                      </td>
                      <td className="px-4 py-3 text-fog">
                        <span className="rounded-md border border-line bg-paper px-1.5 py-0.5 text-[10.5px]">
                          {entry.account_code} · {entry.account_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 capitalize text-fog">
                        {entry.account_type}
                      </td>
                      <td className="num px-4 py-3 text-right font-bold text-emerald-700">
                        {entry.debit_minor > 0 ? `+${formatMinor(entry.debit_minor)}` : '—'}
                      </td>
                      <td className="num px-4 py-3 text-right font-bold text-rose-700">
                        {entry.credit_minor > 0 ? `-${formatMinor(entry.credit_minor)}` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredCashflow.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-line bg-paper/80 font-bold text-ink">
                    <td colSpan={4} className="px-4 py-3 font-display text-xs">
                      Total Periode
                    </td>
                    <td className="num px-4 py-3 text-right text-emerald-700">
                      +{formatMinor(totalMasuk)}
                    </td>
                    <td className="num px-4 py-3 text-right text-rose-700">
                      -{formatMinor(totalKeluar)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Piutang & AR Aging */}
      {tab === 'piutang' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-fog px-1">
            <span>
              Total Piutang Berjalan: <span className="font-bold text-ink">{formatMinor(receivables.reduce((s, r) => s + (r.outstanding_minor || 0), 0))}</span>
            </span>
          </div>
          <AgingSummaryCards
            title="Ringkasan Umur Piutang Pelanggan (AR Aging)"
            items={receivables}
          />
          <ReceivablesAgingTable
            receivables={receivables}
            isLoading={isLoading}
            error={error}
            role={role}
            onOpenSettlement={(r) =>
              setSettlementModalData({ open: true, kind: 'piutang', item: r })
            }
            onOpenHistory={(r) =>
              setAuditModal({ open: true, kind: 'piutang', item: r })
            }
          />
        </div>
      )}

      {/* Tab 3: Hutang & AP Aging */}
      {tab === 'hutang' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-fog px-1">
            <span>
              Total Hutang Berjalan: <span className="font-bold text-ink">{formatMinor(payables.reduce((s, p) => s + (p.outstanding_minor || 0), 0))}</span>
            </span>
          </div>
          <AgingSummaryCards
            title="Ringkasan Umur Hutang Supplier (AP Aging)"
            items={payables}
          />
          <PayablesAgingTable
            payables={payables}
            isLoading={isLoading}
            error={error}
            role={role}
            onOpenSettlement={(p) =>
              setSettlementModalData({ open: true, kind: 'hutang', item: p })
            }
            onOpenHistory={(p) =>
              setAuditModal({ open: true, kind: 'hutang', item: p })
            }
          />
        </div>
      )}

      {/* Educational Bookkeeping Tips Box */}
      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-line bg-paper/40 p-4">
        <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-pine" />
        <p className="text-xs leading-relaxed text-fog">
          <span className="font-bold text-ink">Tips pembukuan UMKM:</span> Pembelian tunai otomatis memotong kas dan mencatat persediaan di jurnal. Pembelian bertempo (Tempo 14/30) masuk ke tab Hutang dan otomatis memotong kas saat dilunasi. Penjualan POS kredit tercatat di piutang dan dapat dilunasi bertahap melalui tombol Terima Bayar.
        </p>
      </div>

      {/* Modals */}
      <CashTransactionModal
        open={cashModalOpen}
        onClose={() => setCashModalOpen(false)}
        onSubmit={recordCashTransaction}
        isSaving={isSaving}
      />

      <DebtSettlementModal
        open={settlementModalData.open}
        kind={settlementModalData.kind}
        item={settlementModalData.item}
        onClose={() => setSettlementModalData({ open: false, kind: 'piutang', item: null })}
        onSettleReceivable={settleReceivable}
        onSettlePayable={settlePayable}
        isSaving={isSaving}
      />

      <DebtAuditHistoryModal
        open={auditModal.open}
        kind={auditModal.kind}
        item={auditModal.item}
        onClose={() => setAuditModal({ open: false, kind: 'piutang', item: null })}
      />
    </div>
  );
}
