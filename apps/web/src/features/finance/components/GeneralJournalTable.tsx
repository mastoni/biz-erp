'use client';

import React, { useState } from 'react';
import type { JournalEntryDto, JournalStatus } from '../types';
import type { Role } from '@/lib/rbac';
import type { Branch } from '@/features/inventory/types';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  Eye,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Building2,
} from 'lucide-react';

export interface GeneralJournalTableProps {
  journals: JournalEntryDto[];
  total: number;
  isLoading: boolean;
  error: string | null;
  role?: Role | null;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  branchFilter: string;
  onBranchFilterChange: (branchId: string) => void;
  branches: Branch[];
  onRefresh: () => void;
  onViewDetail: (journal: JournalEntryDto) => void;
  onOpenReversal: (journal: JournalEntryDto) => void;
}

export function GeneralJournalTable({
  journals,
  total,
  isLoading,
  error,
  role,
  statusFilter,
  onStatusFilterChange,
  branchFilter,
  onBranchFilterChange,
  branches,
  onRefresh,
  onViewDetail,
  onOpenReversal,
}: GeneralJournalTableProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const isOwner = role === 'OWNER';

  const filteredJournals = journals.filter((j) => {
    const q = searchQuery.toLowerCase();
    return (
      j.description.toLowerCase().includes(q) ||
      (j.reference || '').toLowerCase().includes(q) ||
      j.source_type.toLowerCase().includes(q) ||
      j.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pine/10 text-pine">
              <FileText className="h-4 w-4" />
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Jurnal Umum (General Journal)
            </h1>
          </div>
          <p className="text-xs text-fog mt-0.5">
            Daftar seluruh transaksi ayat jurnal akuntansi yang tercatat di sistem.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink shadow-2xs hover:bg-paper cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-fog ${isLoading ? 'animate-spin' : ''}`} />
          <span>Segarkan</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-2xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fog" />
          <input
            type="text"
            placeholder="Cari referensi, sumber, atau keterangan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-line bg-paper pl-9 pr-3.5 py-2 text-xs font-medium text-ink focus:border-pine focus:outline-none"
          />
        </div>

        {/* Filters: Status & Branch */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-fog" />
            <select
              aria-label="Filter Status Jurnal"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink focus:border-pine focus:outline-none cursor-pointer"
            >
              <option value="">Semua Status</option>
              <option value="posted">Posted (Tercatat)</option>
              <option value="reversed">Reversed (Dibalikkan)</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          {branches.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-fog" />
              <select
                aria-label="Filter Cabang Jurnal"
                value={branchFilter}
                onChange={(e) => onBranchFilterChange(e.target.value)}
                className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink focus:border-pine focus:outline-none cursor-pointer"
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

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="rounded-2xl border border-line bg-surface p-6 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-paper" />
          ))}
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-sm font-bold text-rose-800">Gagal Memuat Jurnal Umum</p>
          <p className="text-xs text-rose-600 mt-1">{error}</p>
        </div>
      )}

      {/* Table Content */}
      {!isLoading && !error && filteredJournals.length === 0 && (
        <div className="rounded-2xl border border-line bg-surface p-12 text-center text-fog">
          <FileText className="h-10 w-10 mx-auto text-fog/50 mb-2" />
          <p className="text-sm font-semibold text-ink">Tidak ada ayat jurnal ditemukan.</p>
          <p className="text-xs text-fog mt-0.5">Coba ubah kata kunci pencarian atau filter status.</p>
        </div>
      )}

      {!isLoading && !error && filteredJournals.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface shadow-2xs overflow-hidden">
          <div className="border-b border-line bg-paper/50 px-5 py-3 flex items-center justify-between text-xs text-fog">
            <span>Menampilkan {filteredJournals.length} dari total {total} jurnal</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-paper/60 text-[11px] font-bold uppercase text-fog">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-3">Sumber &amp; Ref</th>
                  <th className="py-3 px-4">Keterangan</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {filteredJournals.map((journal) => {
                  const isEligibleForReversal =
                    isOwner && journal.status === 'posted' && !journal.reversed_by;

                  return (
                    <tr key={journal.id} className="hover:bg-paper/30 transition">
                      {/* Tanggal */}
                      <td className="py-3 px-4 font-medium text-ink whitespace-nowrap">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <Calendar className="h-3.5 w-3.5 text-fog" />
                          {journal.date}
                        </span>
                      </td>

                      {/* Sumber & Reference */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase bg-paper border border-line text-fog">
                            {journal.source_type}
                          </span>
                          {journal.reference && (
                            <span className="font-mono text-xs text-ink font-medium">
                              {journal.reference}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Keterangan */}
                      <td className="py-3 px-4 text-ink max-w-sm">
                        <p className="font-medium truncate">{journal.description}</p>
                        {journal.reversed_by && (
                          <p className="text-[10px] text-rose-600 font-semibold mt-0.5">
                            Dibalikkan oleh: {journal.reversed_by.slice(0, 8)}...
                          </p>
                        )}
                        {journal.reversal_of && (
                          <p className="text-[10px] text-blue-600 font-semibold mt-0.5">
                            Pembalik dari: {journal.reversal_of.slice(0, 8)}...
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {journal.status === 'posted' && (
                          <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            {journal.reversed_by ? 'Reversed' : 'Posted'}
                          </span>
                        )}
                        {journal.status === 'reversed' && (
                          <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <RotateCcw className="h-3 w-3" />
                            Reversal
                          </span>
                        )}
                        {journal.status === 'draft' && (
                          <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Draft
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onViewDetail(journal)}
                            className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink shadow-2xs hover:bg-paper cursor-pointer"
                            title="Lihat Rincian Ayat Jurnal"
                          >
                            <Eye className="h-3.5 w-3.5 text-fog" />
                            <span>Detail</span>
                          </button>

                          {/* Reversal button: visible ONLY for OWNER */}
                          {isEligibleForReversal && (
                            <button
                              type="button"
                              onClick={() => onOpenReversal(journal)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                              title="Pembalikan Jurnal (Reversal)"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>Balikkan</span>
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
        </div>
      )}
    </div>
  );
}
