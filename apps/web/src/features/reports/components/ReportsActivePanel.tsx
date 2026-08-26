'use client';

import React from 'react';
import { Download, AlertCircle } from 'lucide-react';
import { idr, idrShort, num } from '../reports-helpers';
import { REPORT_TABS } from './ReportsTabSelector';
import type {
  ReportTab,
  ReportsRange,
  SalesReportViewModel,
  InventoryReportViewModel,
  ProfitLossViewModel,
} from '../types';

interface ReportsActivePanelProps {
  activeTab: ReportTab;
  range: ReportsRange;
  salesReport: SalesReportViewModel;
  inventoryReport: InventoryReportViewModel;
  profitLoss: ProfitLossViewModel;
  isP1Tab: boolean;
  p1TabUnavailableMessage: string | null;
  businessName?: string;
  onExportCsv: () => void;
}

export function ReportsActivePanel({
  activeTab,
  range,
  salesReport,
  inventoryReport,
  profitLoss,
  isP1Tab,
  p1TabUnavailableMessage,
  businessName = 'SKM Mart',
  onExportCsv,
}: ReportsActivePanelProps) {
  const currentTabConfig = REPORT_TABS.find((t) => t.id === activeTab) || REPORT_TABS[0];
  const rangeDays = range === '7d' ? '7' : '30';

  return (
    <section className="rounded-xl border border-line bg-surface overflow-hidden shadow-sm" data-testid="reports-active-panel">
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper/50 px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{
              background: `${currentTabConfig.color}16`,
              color: currentTabConfig.color,
            }}
          >
            {currentTabConfig.icon}
          </span>
          <div>
            <h3 className="font-display text-[16px] font-bold text-ink leading-tight">
              Laporan {currentTabConfig.label}
            </h3>
            <p className="text-[11.5px] text-fog">
              {currentTabConfig.desc} · periode {rangeDays} hari
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onExportCsv}
          data-testid="export-csv-button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-pine px-3.5 py-2 text-[12.5px] font-bold text-white shadow-sm transition-colors hover:bg-pine-deep cursor-pointer ml-auto"
        >
          <Download className="h-3.5 w-3.5" /> Unduh CSV
        </button>
      </div>

      {/* Tab 1: Penjualan */}
      {activeTab === 'penjualan' && (
        <div className="grid gap-0 lg:grid-cols-[1fr_320px]" data-testid="panel-penjualan">
          {/* Recent Sales Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="bg-paper/60 text-left border-b border-line">
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-fog">No. Struk</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-fog">Waktu</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-fog">Kasir</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-fog">Metode</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-fog text-right">Total</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-fog">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {salesReport.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-xs text-fog">
                      Belum ada struk transaksi untuk periode ini.
                    </td>
                  </tr>
                ) : (
                  salesReport.transactions.slice(0, 10).map((s) => (
                    <tr key={s.id} className="transition-colors hover:bg-paper/50">
                      <td className="px-4 py-3 num text-[12.5px] font-bold text-ink">{s.receipt_number || s.id}</td>
                      <td className="px-4 py-3 num text-[12.5px] text-fog">{s.created_at.slice(0, 16).replace('T', ' ')}</td>
                      <td className="px-4 py-3 text-[13px] text-ink">{s.cashier_id || 'Kasir'}</td>
                      <td className="px-4 py-3 text-[12.5px] text-fog font-medium">{s.payment_method || 'CASH'}</td>
                      <td className="px-4 py-3 num text-right text-[13px] font-bold text-ink">{idr(s.total_minor)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-pine/10 px-2 py-0.5 text-[11px] font-semibold text-pine">
                          Selesai
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Right: Top 5 Products */}
          <div className="border-t border-line bg-paper/40 p-5 lg:border-l lg:border-t-0">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-fog">Produk Terlaris</p>
            {salesReport.top_products.length === 0 ? (
              <p className="text-xs text-fog py-4">Belum ada data penjualan produk.</p>
            ) : (
              <ul className="space-y-3">
                {salesReport.top_products.map((p, i) => (
                  <li key={p.product_id}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="truncate font-semibold text-ink">
                        {i + 1}. {p.product_name}
                      </span>
                      <span className="num shrink-0 font-bold text-pine">
                        {idrShort(p.revenue_minor)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink/8">
                      <div
                        className="h-full rounded-full bg-honey transition-all duration-500"
                        style={{ width: `${p.percentage}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Laba Rugi */}
      {activeTab === 'labarugi' && (
        <div className="mx-auto max-w-xl p-5" data-testid="panel-labarugi">
          <p className="mb-4 text-center text-[11.5px] font-semibold uppercase tracking-[0.16em] text-fog">
            Laporan Laba Rugi · Periode {rangeDays} hari · {businessName}
          </p>
          <dl className="num text-[14px] space-y-1">
            <div className="flex justify-between py-2 font-semibold text-ink border-b border-line/40">
              <dt>Pendapatan Penjualan</dt>
              <dd>{idr(profitLoss.revenue_minor)}</dd>
            </div>
            <div className="flex justify-between py-2 text-clay border-b border-line/40">
              <dt>Harga Pokok Penjualan (HPP)</dt>
              <dd>
                {profitLoss.hpp_minor !== null ? `- ${idr(profitLoss.hpp_minor)}` : 'Data HPP tidak lengkap'}
              </dd>
            </div>
            <div className="flex justify-between border-b border-line/60 py-2.5 font-bold text-ink">
              <dt>Laba Kotor</dt>
              <dd>
                {profitLoss.gross_profit_minor !== null ? idr(profitLoss.gross_profit_minor) : 'Tidak Tersedia'}
              </dd>
            </div>
            <div className="flex justify-between py-2 text-clay border-b border-line/40">
              <dt>Beban Operasional</dt>
              <dd>
                {profitLoss.operating_expense_minor !== null
                  ? `- ${idr(profitLoss.operating_expense_minor)}`
                  : 'Belum ada pembukuan beban'}
              </dd>
            </div>
            <div className="mt-3 flex items-baseline justify-between rounded-lg bg-pine-deep px-4 py-3 text-[#f2efe2]">
              <dt className="font-display text-[15px] font-bold">Laba Bersih</dt>
              <dd className="text-[18px] font-bold text-honey">
                {profitLoss.net_profit_minor !== null ? idr(profitLoss.net_profit_minor) : 'Tidak Tersedia'}
              </dd>
            </div>
            <p className="mt-3 text-center text-[11px] text-fog">
              {profitLoss.net_profit_minor !== null && profitLoss.revenue_minor > 0
                ? `Margin bersih ${((profitLoss.net_profit_minor / profitLoss.revenue_minor) * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}% dari omzet`
                : 'Laba bersih akan dihitung otomatis saat HPP dan beban operasional tercatat.'}
            </p>
          </dl>
        </div>
      )}

      {/* Tab 3: Stok & Inventaris */}
      {activeTab === 'stok' && (
        <div className="grid gap-0 lg:grid-cols-[300px_1fr]" data-testid="panel-stok">
          {/* Valuasi Kategori */}
          <div className="border-b border-line bg-paper/40 p-5 lg:border-b-0 lg:border-r">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-fog">Valuasi per Kategori</p>
            {inventoryReport.categories.length === 0 ? (
              <p className="text-xs text-fog py-4">Belum ada kategori stok.</p>
            ) : (
              <ul className="space-y-3">
                {inventoryReport.categories.map((c) => (
                  <li key={c.category}>
                    <div className="mb-1 flex items-center justify-between text-[12.5px]">
                      <span className="flex items-center gap-2 font-semibold text-ink">
                        <span className="h-2 w-2 rounded-full" style={{ background: c.color || '#68746c' }} />
                        {c.category} <span className="text-fog">({c.sku_count} SKU)</span>
                      </span>
                      <span className="num font-bold text-ink">{idrShort(c.valuation_minor)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink/8">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${c.percentage}%`,
                          background: c.color || '#68746c',
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 rounded-lg bg-pine-deep px-4 py-3 text-[#f2efe2]">
              <p className="text-[10.5px] uppercase tracking-[0.14em] opacity-60">Total Nilai Stok</p>
              <p className="num text-[19px] font-bold text-honey">{idr(inventoryReport.valuation_minor)}</p>
              <p className="text-[11px] opacity-70 mt-0.5">{num(inventoryReport.total_quantity)} unit · {inventoryReport.total_skus} SKU aktif</p>
            </div>
          </div>

          {/* SKU Valuation Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="bg-paper/60 text-left border-b border-line">
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-fog">Kategori</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-fog text-center">SKU</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-fog text-center">Total Stok</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-fog text-right">Valuasi Stok</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {inventoryReport.categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-xs text-fog">
                      Belum ada data inventaris tercatat.
                    </td>
                  </tr>
                ) : (
                  inventoryReport.categories.map((c) => (
                    <tr key={c.category} className="transition-colors hover:bg-paper/50">
                      <td className="px-4 py-3 text-[13px] font-semibold text-ink">{c.category}</td>
                      <td className="px-4 py-3 num text-center text-[12.5px] text-fog">{c.sku_count} SKU</td>
                      <td className="px-4 py-3 num text-center font-bold text-ink">{num(c.quantity)}</td>
                      <td className="px-4 py-3 num text-right font-bold text-ink">{idr(c.valuation_minor)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* P1 Tabs: Pembelian, Hutang Piutang, Layanan Digital */}
      {isP1Tab && (
        <div className="p-8 text-center" data-testid="panel-p1-unavailable">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-honey/15 text-honey mb-3">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h4 className="font-display text-base font-bold text-ink">Modul Belum Terhubung ke Canonical DB</h4>
          <p className="mx-auto mt-1 max-w-md text-xs text-fog">
            {p1TabUnavailableMessage || 'Data canonical untuk modul ini akan terhubung pada fase berikutnya.'}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line bg-paper/50 px-3 py-1.5 text-[11.5px] text-fog font-medium">
            Status: <span className="font-bold text-pine">Terkontrol Pending (No Synthetic Mocks)</span>
          </div>
        </div>
      )}
    </section>
  );
}
