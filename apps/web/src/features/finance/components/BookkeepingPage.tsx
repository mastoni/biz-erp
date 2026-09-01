'use client';

import React from 'react';
import {
  BookOpen,
  Plus,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { useBookkeepingViewModel } from '../use-bookkeeping-viewmodel';
import { CashTransactionModal } from './CashTransactionModal';
import { DebtSettlementModal } from './DebtSettlementModal';
import type { BookkeepingTab, ReceivableItem, PayableItem } from '../types';

interface BookkeepingPageProps {
  businessId?: string;
  branchId?: string;
  role?: 'OWNER' | 'CASHIER';
}

function idr(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
}

function num(val: number): string {
  return new Intl.NumberFormat('id-ID').format(val);
}

export function BookkeepingPage({ businessId, branchId, role }: BookkeepingPageProps) {
  const {
    tab,
    setTab,
    search,
    setSearch,
    summary,
    cashflow,
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

  const isOwner = role === 'OWNER';

  // Compute period totals
  const totalMasuk = cashflow.reduce((sum, c) => sum + (c.debit_minor > 0 ? c.debit_minor : 0), 0);
  const totalKeluar = cashflow.reduce((sum, c) => sum + (c.credit_minor > 0 ? c.credit_minor : 0), 0);
  const netFlow = totalMasuk - totalKeluar;
  const saldoKas = summary ? summary.total_assets : netFlow;

  const totalPiutangAktif = filteredReceivables.reduce((sum, r) => sum + (r.outstanding_minor || 0), 0);
  const totalHutangAktif = filteredPayables.reduce((sum, p) => sum + (p.outstanding_minor || 0), 0);

  const tabs: { id: BookkeepingTab; label: string; badge?: number }[] = [
    { id: 'jurnal', label: 'Jurnal Kas' },
    { id: 'piutang', label: 'Piutang Pelanggan', badge: filteredReceivables.filter(r => r.outstanding_minor > 0).length },
    { id: 'hutang', label: 'Hutang Supplier', badge: filteredPayables.filter(p => p.outstanding_minor > 0).length },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Pembukuan Keuangan
          </h1>
          <p className="text-xs text-fog">
            Catatan arus kas harian, piutang pelanggan, dan kewajiban hutang supplier.
          </p>
        </div>

        {isOwner && (
          <button
            onClick={() => setCashModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-pine px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-pine-deep cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Catat Transaksi Kas</span>
          </button>
        )}
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
            {idr(saldoKas)}
          </p>
          <p className="mt-1 text-[11px] text-fog">Total kas & bank aktif</p>
        </div>

        {/* Total Kas Masuk */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-fog">
            Total Kas Masuk
          </p>
          <p className="num mt-1.5 text-xl font-bold text-emerald-700">
            +{idr(totalMasuk)}
          </p>
          <p className="mt-1 text-[11px] text-fog">Pemasukan & penerimaan</p>
        </div>

        {/* Total Kas Keluar */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-fog">
            Total Kas Keluar
          </p>
          <p className="num mt-1.5 text-xl font-bold text-rose-700">
            -{idr(totalKeluar)}
          </p>
          <p className="mt-1 text-[11px] text-fog">Pengeluaran & belanja</p>
        </div>

        {/* Arus Kas Bersih */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-fog">
            Arus Kas Bersih
          </p>
          <p className={`num mt-1.5 text-xl font-bold ${netFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {netFlow >= 0 ? `+${idr(netFlow)}` : `-${idr(Math.abs(netFlow))}`}
          </p>
          <p className="mt-1 text-[11px] text-fog">Net flow periode</p>
        </div>
      </div>

      {/* Main Content Card with Tabs */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-2xs">
        {/* Toolbar & Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper/40 px-5 py-3">
          {/* Tab buttons */}
          <div className="flex rounded-xl border border-line bg-surface p-0.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  tab === t.id
                    ? 'bg-pine text-white shadow-xs'
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

          {/* Search bar */}
          <div className="relative min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fog" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari transaksi..."
              className="w-full rounded-xl border border-line bg-surface py-1.5 pl-8.5 pr-3 text-xs text-ink placeholder:text-fog/60 focus:border-pine focus:outline-hidden"
            />
          </div>
        </div>

        {/* Tab 1: Jurnal Kas */}
        {tab === 'jurnal' && (
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
                        {entry.debit_minor > 0 ? `+${num(entry.debit_minor)}` : '—'}
                      </td>
                      <td className="num px-4 py-3 text-right font-bold text-rose-700">
                        {entry.credit_minor > 0 ? `-${num(entry.credit_minor)}` : '—'}
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
                      +{num(totalMasuk)}
                    </td>
                    <td className="num px-4 py-3 text-right text-rose-700">
                      -{num(totalKeluar)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Tab 2: Piutang */}
        {tab === 'piutang' && (
          <div>
            <div className="flex items-center justify-between border-b border-line bg-paper/30 px-5 py-3 text-xs">
              <span className="text-fog">
                Total Piutang Berjalan: <span className="num font-bold text-ink">{idr(totalPiutangAktif)}</span>
              </span>
              <span className="text-fog">{filteredReceivables.length} debitur terdaftar</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line bg-paper/60 text-[11px] font-bold uppercase tracking-wider text-fog">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Pelanggan</th>
                    <th className="px-4 py-3">Jatuh Tempo</th>
                    <th className="px-4 py-3 text-right">Total Tagihan</th>
                    <th className="px-4 py-3 text-right">Sisa Piutang</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 bg-surface">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-fog">
                        Memuat data piutang...
                      </td>
                    </tr>
                  ) : filteredReceivables.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-fog">
                        Tidak ada piutang pelanggan berjalan.
                      </td>
                    </tr>
                  ) : (
                    filteredReceivables.map((r) => (
                      <tr key={r.id} className="hover:bg-paper/40 transition">
                        <td className="num px-4 py-3 font-bold text-fog">{r.id.slice(0, 8)}</td>
                        <td className="px-4 py-3 font-semibold text-ink">
                          {r.customer_name || r.customer_id || 'Pelanggan'}
                        </td>
                        <td className="num px-4 py-3 text-fog">{r.due_date || '—'}</td>
                        <td className="num px-4 py-3 text-right font-medium text-fog">
                          {idr(r.total_minor)}
                        </td>
                        <td className="num px-4 py-3 text-right font-bold text-rose-700">
                          {idr(r.outstanding_minor)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-md border px-2 py-0.5 text-[10.5px] font-bold ${
                              r.status === 'PAID'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : r.status === 'PARTIAL'
                                ? 'border-amber-200 bg-amber-50 text-amber-800'
                                : 'border-sky-200 bg-sky-50 text-sky-800'
                            }`}
                          >
                            {r.status === 'PAID' ? 'Lunas' : r.status === 'PARTIAL' ? 'Sebagian' : 'Berjalan'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isOwner && r.outstanding_minor > 0 ? (
                            <button
                              onClick={() =>
                                setSettlementModalData({ open: true, kind: 'piutang', item: r })
                              }
                              className="rounded-lg bg-pine px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-pine-deep cursor-pointer"
                            >
                              Terima Pembayaran
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-fog">Selesai</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Hutang */}
        {tab === 'hutang' && (
          <div>
            <div className="flex items-center justify-between border-b border-line bg-paper/30 px-5 py-3 text-xs">
              <span className="text-fog">
                Total Hutang Berjalan: <span className="num font-bold text-ink">{idr(totalHutangAktif)}</span>
              </span>
              <span className="text-fog">{filteredPayables.length} tagihan supplier</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line bg-paper/60 text-[11px] font-bold uppercase tracking-wider text-fog">
                    <th className="px-4 py-3">No. PO</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Jatuh Tempo</th>
                    <th className="px-4 py-3 text-right">Total Nilai</th>
                    <th className="px-4 py-3 text-right">Sisa Hutang</th>
                    <th className="px-4 py-3">Term</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 bg-surface">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-fog">
                        Memuat data hutang...
                      </td>
                    </tr>
                  ) : filteredPayables.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-fog">
                        Tidak ada kewajiban hutang berjalan.
                      </td>
                    </tr>
                  ) : (
                    filteredPayables.map((p) => (
                      <tr key={p.id} className="hover:bg-paper/40 transition">
                        <td className="num px-4 py-3 font-bold text-ink">{p.code}</td>
                        <td className="px-4 py-3 font-semibold text-ink">
                          {p.supplier_name || 'Supplier'}
                        </td>
                        <td className="num px-4 py-3 text-fog">{p.due_date}</td>
                        <td className="num px-4 py-3 text-right font-medium text-fog">
                          {idr(p.total_minor)}
                        </td>
                        <td className="num px-4 py-3 text-right font-bold text-rose-700">
                          {idr(p.outstanding_minor)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-md border border-line bg-paper px-2 py-0.5 text-[10.5px] font-semibold text-fog">
                            {p.supplier_term}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isOwner && p.outstanding_minor > 0 ? (
                            <button
                              onClick={() =>
                                setSettlementModalData({ open: true, kind: 'hutang', item: p })
                              }
                              className="rounded-lg bg-pine px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-pine-deep cursor-pointer"
                            >
                              Lunasi Tagihan
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-fog">Lunas</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Educational Bookkeeping Tips Box */}
      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-line bg-paper/40 p-4">
        <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-pine" />
        <p className="text-xs leading-relaxed text-fog">
          <span className="font-bold text-ink">Tips pembukuan UMKM:</span> Pembelian tunai otomatis memotong kas dan mencatat persediaan di jurnal. Pembelian bertempo (Tempo 14/30) masuk ke tab Hutang dan otomatis memotong kas saat dilunasi. Penjualan POS langsung tercatat di arus kas masuk. Rekonsiliasi kas idealnya dilakukan saat pergantian shift kasir.
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
    </div>
  );
}
