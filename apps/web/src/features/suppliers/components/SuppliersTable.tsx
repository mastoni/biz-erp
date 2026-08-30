'use client';

import React, { useState } from 'react';
import { ChevronDown, Trash2, Loader2, Package, Calendar, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AxiosError } from 'axios';
import type { SupplierViewModel, LinkedPurchaseOrder } from '../types';
import { getSupplierTermTone, getSupplierStatusTone, idr } from '../supplier-helpers';

interface SuppliersTableProps {
  suppliers: SupplierViewModel[];
  isLoading?: boolean;
  isOwner: boolean;
  onDelete: (id: string) => Promise<void>;
  onStatusToggle: (supplier: SupplierViewModel) => void;
  defaultExpandedId?: string;
}

function getPOStatusBadge(status: LinkedPurchaseOrder['status']) {
  switch (status) {
    case 'received':
      return <span className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Diterima</span>;
    case 'partial':
      return <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">Sebagian</span>;
    case 'sent':
      return <span className="inline-flex rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800">Dikirim</span>;
    case 'cancelled':
      return <span className="inline-flex rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800">Dibatalkan</span>;
    default:
      return <span className="inline-flex rounded-md border border-line bg-paper px-2 py-0.5 text-[10px] font-bold text-fog">Draft</span>;
  }
}

export function SuppliersTable({
  suppliers,
  isLoading = false,
  isOwner,
  onDelete,
  onStatusToggle,
  defaultExpandedId,
}: SuppliersTableProps) {
  const [expanded, setExpanded] = useState<string | null>(defaultExpandedId ?? null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<SupplierViewModel | null>(null);

  const handleDeleteClick = (supplier: SupplierViewModel) => {
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!supplierToDelete) return;
    setDeletingId(supplierToDelete.id);
    try {
      await onDelete(supplierToDelete.id);
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    } catch (err) {
      let msg = 'Gagal menghapus supplier.';
      if (err instanceof AxiosError) {
        msg = err.response?.data?.message || msg;
      }
      console.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-line bg-paper/60">
                <th className="px-4 py-3 text-left"></th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Supplier</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Kategori</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Kontak</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Termin</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Rating</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-fog">Hutang Berjalan</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Status</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-line/60">
                  <td colSpan={8} className="px-4 py-4">
                    <div className="h-5 w-full animate-pulse rounded bg-paper/70" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr className="border-b border-line bg-paper/60">
              <th className="w-8 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-fog"></th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Supplier</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Kategori</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Kontak</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Termin</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Rating</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-fog">Hutang Berjalan</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {suppliers.map((s) => {
              const isOpen = expanded === s.id;
              const termTone = getSupplierTermTone(s.term);
              const statusTone = getSupplierStatusTone(s.status);
              const hasDebt = s.outstanding_balance_minor > 0;
              const poList = s.purchase_orders || [];

              return (
                <React.Fragment key={s.id}>
                  <tr
                    className="cursor-pointer transition-colors hover:bg-paper/60"
                    onClick={() => setExpanded(isOpen ? null : s.id)}
                  >
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <ChevronDown
                        width={14}
                        height={14}
                        className={`text-fog transition-transform duration-200 ${isOpen ? 'rotate-180 text-pine' : ''}`}
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pine text-[11px] font-bold text-white shadow-2xs">
                          {s.code_badge}
                        </span>
                        <div>
                          <p className="font-semibold leading-tight text-ink">{s.name}</p>
                          <p className="num text-[10.5px] text-fog">{s.id} · {poList.length} pesanan</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-md border border-line bg-paper px-2 py-0.5 text-xs text-ink">{s.category}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-xs font-semibold leading-tight text-ink">{s.contact}</p>
                      <p className="num text-[10.5px] text-fog">{s.phone}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                        termTone === 'pine' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-sky-50 text-sky-800 border-sky-200'
                      }`}>
                        {s.term}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-fog">Belum ada</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`num text-xs font-bold ${hasDebt ? 'text-rose-700' : 'text-ink'}`}>
                        {idr(s.outstanding_balance_minor)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10.5px] font-bold ${
                        statusTone === 'pine' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-paper text-fog border-line'
                      }`}>
                        {s.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr className="bg-paper/40">
                      <td colSpan={8} className="px-6 pb-5 pt-2">
                        <div className="grid gap-4 md:grid-cols-[1fr_280px]">
                          {/* Left: Linked PO History */}
                          <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
                            <p className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-fog">
                              <span>Riwayat Purchase Order ({poList.length})</span>
                              {hasDebt && (
                                <span className="text-rose-700">Hutang: {idr(s.outstanding_balance_minor)}</span>
                              )}
                            </p>

                            {poList.length === 0 ? (
                              <p className="py-6 text-center text-xs text-fog">
                                Belum ada pesanan yang diterbitkan ke supplier ini.
                              </p>
                            ) : (
                              <div className="divide-y divide-line/60">
                                {poList.map((po) => (
                                  <div key={po.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="num font-bold text-ink">{po.code}</span>
                                        {getPOStatusBadge(po.status)}
                                      </div>
                                      <p className="num text-[11px] text-fog mt-0.5">
                                        Tgl: {po.date} {po.due_date ? `· Jatuh Tempo: ${po.due_date}` : ''}
                                      </p>
                                      <p className="text-[11px] text-fog/80 truncate max-w-sm">
                                        {po.items_summary}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="num font-bold text-ink">{idr(po.total_minor)}</p>
                                      {po.outstanding_minor > 0 && (
                                        <p className="num text-[11px] font-semibold text-rose-700">
                                          Sisa: {idr(po.outstanding_minor)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Right: Info & Controls */}
                          <div className="space-y-3">
                            <div className="rounded-2xl border border-line bg-surface p-3.5 space-y-1">
                              <p className="text-[10.5px] font-bold uppercase tracking-wider text-fog">Email Order</p>
                              <p className="num text-xs font-semibold break-all text-ink">
                                {s.email || '—'}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-line bg-surface p-3.5 space-y-1">
                              <p className="text-[10.5px] font-bold uppercase tracking-wider text-fog">Termin Pembayaran</p>
                              <p className="text-xs font-semibold text-ink">
                                {s.term === 'Tunai'
                                  ? 'Bayar tunai saat barang datang'
                                  : `Pembayaran ${s.term.replace('Tempo ', '')} hari setelah terima barang`}
                              </p>
                            </div>

                            {isOwner && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStatusToggle(s);
                                }}
                                className="w-full rounded-xl border border-line bg-surface py-2 text-xs font-bold text-ink transition hover:bg-paper cursor-pointer"
                              >
                                {s.status === 'aktif' ? 'Nonaktifkan Supplier' : 'Aktifkan Kembali'}
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {suppliers.length === 0 && (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-semibold text-ink">Supplier tidak ditemukan</p>
          <p className="text-xs text-fog mt-1">Belum ada mitra pemasok yang cocok dengan filter pencarian.</p>
        </div>
      )}
    </div>
  );
}
