'use client';

import React, { useState, useMemo } from 'react';
import { formatMinor } from '@/lib/format';
import { getAgingBucket, getAgingBucketLabel } from '../api';
import type { PayableItem, AgingBucket } from '../types';
import type { Role } from '@/lib/rbac';
import {
  Search,
  Filter,
  History,
  Clock,
  Calendar,
  Truck,
  CreditCard,
  FileSpreadsheet,
} from 'lucide-react';

export interface PayablesAgingTableProps {
  payables: PayableItem[];
  isLoading: boolean;
  error?: string | null;
  role?: Role | null;
  onOpenSettlement: (payable: PayableItem) => void;
  onOpenHistory: (payable: PayableItem) => void;
  asOfDate?: Date;
}

export function PayablesAgingTable({
  payables,
  isLoading,
  error,
  role,
  onOpenSettlement,
  onOpenHistory,
  asOfDate = new Date(),
}: PayablesAgingTableProps) {
  const [search, setSearch] = useState('');
  const [agingFilter, setAgingFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // RBAC: OWNER & STAFF can settle AP. CASHIER MUST NOT have settlement control.
  const canSettleAP = role === 'OWNER' || role === 'STAFF';

  const filteredItems = useMemo(() => {
    return payables.filter((p) => {
      // Search
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        (p.supplier_name || '').toLowerCase().includes(q) ||
        (p.supplier_id || '').toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q);

      if (!matchSearch) return false;

      // Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'ACTIVE') {
          if (p.outstanding_minor <= 0) return false;
        } else if (p.status !== statusFilter) {
          return false;
        }
      }

      // Aging Filter
      if (agingFilter !== 'all') {
        const bucket = getAgingBucket(p.due_date || p.date, asOfDate);
        if (bucket !== agingFilter) return false;
      }

      return true;
    });
  }, [payables, search, statusFilter, agingFilter, asOfDate]);

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fog" />
          <input
            type="text"
            placeholder="Cari nama supplier, kode PO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-line bg-paper pl-8.5 pr-3 py-1.5 text-xs text-ink placeholder:text-fog/60 focus:border-pine focus:outline-hidden"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Aging Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5 text-fog" />
            <select
              aria-label="Filter Umur Hutang"
              value={agingFilter}
              onChange={(e) => setAgingFilter(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-pine focus:outline-hidden cursor-pointer"
            >
              <option value="all">Semua Umur Hutang</option>
              <option value="0-30">Current / 0–30 Hari</option>
              <option value="31-60">31–60 Hari</option>
              <option value="61-90">61–90 Hari</option>
              <option value=">90">&gt;90 Hari Terlambat</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="h-3.5 w-3.5 text-fog" />
            <select
              aria-label="Filter Status Hutang"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-pine focus:outline-hidden cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="ACTIVE">Masih Berjalan (Belum Lunas)</option>
              <option value="received">Received (Diterima)</option>
              <option value="sent">Sent (Terkirim)</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-2 rounded-2xl border border-line bg-surface p-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-paper" />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-2xs">
          <div className="border-b border-line bg-paper/50 px-5 py-3 flex items-center justify-between text-xs text-fog">
            <span>
              Menampilkan {filteredItems.length} dari total {payables.length} tagihan supplier
            </span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-12 text-center text-fog text-xs">
              <FileSpreadsheet className="h-9 w-9 mx-auto text-fog/40 mb-2" />
              <p className="font-semibold text-ink">Tidak ada kewajiban hutang supplier ditemukan.</p>
              <p className="text-[11px] text-fog mt-0.5">
                Coba ubah kata kunci pencarian atau filter umur hutang.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line bg-paper/60 text-[11px] font-bold uppercase tracking-wider text-fog">
                    <th className="px-4 py-3">No. PO / Tanggal</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Jatuh Tempo</th>
                    <th className="px-4 py-3 text-center">Klasifikasi Umur</th>
                    <th className="px-4 py-3 text-right">Total Tagihan</th>
                    <th className="px-4 py-3 text-right">Terbayar</th>
                    <th className="px-4 py-3 text-right">Sisa Hutang</th>
                    <th className="px-4 py-3 text-center">Term &amp; Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/40 bg-surface">
                  {filteredItems.map((p) => {
                    const bucket = getAgingBucket(p.due_date || p.date, asOfDate);
                    const bucketLabel = getAgingBucketLabel(bucket);

                    return (
                      <tr key={p.id} className="hover:bg-paper/30 transition">
                        {/* No. PO / Tanggal */}
                        <td className="px-4 py-3 font-mono text-xs">
                          <p className="font-bold text-ink">{p.code}</p>
                          <span className="text-[10px] text-fog">{p.date || '-'}</span>
                        </td>

                        {/* Supplier */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Truck className="h-3.5 w-3.5 text-fog shrink-0" />
                            <span className="font-semibold text-ink truncate max-w-[160px]">
                              {p.supplier_name || 'Supplier'}
                            </span>
                          </div>
                        </td>

                        {/* Jatuh Tempo */}
                        <td className="px-4 py-3 text-fog whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-fog" />
                            {p.due_date || '—'}
                          </span>
                        </td>

                        {/* Aging Badge */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-block rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                              bucket === '0-30'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : bucket === '31-60'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : bucket === '61-90'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {bucketLabel}
                          </span>
                        </td>

                        {/* Total Tagihan */}
                        <td className="px-4 py-3 text-right font-medium text-fog">
                          {formatMinor(p.total_minor)}
                        </td>

                        {/* Terbayar */}
                        <td className="px-4 py-3 text-right font-medium text-emerald-700">
                          {formatMinor(p.paid_minor || 0)}
                        </td>

                        {/* Sisa Hutang */}
                        <td className="px-4 py-3 text-right font-bold text-rose-700">
                          {formatMinor(p.outstanding_minor)}
                        </td>

                        {/* Term & Status */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className="inline-block rounded-md border border-line bg-paper px-2 py-0.5 text-[10px] font-semibold text-fog">
                            {p.supplier_term}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Riwayat Pembayaran */}
                            <button
                              type="button"
                              onClick={() => onOpenHistory(p)}
                              className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink shadow-2xs hover:bg-paper cursor-pointer"
                              title="Lihat Riwayat Pelunasan PO"
                            >
                              <History className="h-3.5 w-3.5 text-fog" />
                              <span>Riwayat</span>
                            </button>

                            {/* Lunasi Tagihan (OWNER & STAFF only; HIDDEN for CASHIER) */}
                            {canSettleAP && p.outstanding_minor > 0 && (
                              <button
                                type="button"
                                onClick={() => onOpenSettlement(p)}
                                className="inline-flex items-center gap-1 rounded-lg bg-pine px-2.5 py-1 text-xs font-bold text-white shadow-xs transition hover:bg-pine-deep cursor-pointer"
                                title="Lunasi Tagihan Supplier"
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                                <span>Lunasi Tagihan</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
