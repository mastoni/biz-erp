'use client';

import React, { useState } from 'react';
import { ChevronDown, Trash2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AxiosError } from 'axios';
import type { SupplierViewModel } from '../types';
import { getSupplierTermTone, getSupplierStatusTone } from '../supplier-helpers';

interface SuppliersTableProps {
  suppliers: SupplierViewModel[];
  isLoading?: boolean;
  isOwner: boolean;
  onDelete: (id: string) => Promise<void>;
  onStatusToggle: (supplier: SupplierViewModel) => void;
  defaultExpandedId?: string;
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
      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
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
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Hutang Berjalan</th>
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
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
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
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Hutang Berjalan</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {suppliers.map((s) => {
              const isOpen = expanded === s.id;
              const termTone = getSupplierTermTone(s.term);
              const statusTone = getSupplierStatusTone(s.status);

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
                        <span className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pine-deep text-[11px] font-bold text-honey">
                          {s.code_badge}
                        </span>
                        <div>
                          <p className="font-semibold leading-tight text-ink">{s.name}</p>
                          <p className="num text-[10.5px] text-fog">{s.id} · order terakhir —</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant="neutral" size="sm">{s.category}</Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-[12.5px] font-semibold leading-tight text-ink">{s.contact}</p>
                      <p className="num text-[10.5px] text-fog">{s.phone}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={termTone === 'pine' ? 'pine' : 'ocean'} size="sm">{s.term}</Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-[12.5px] text-fog">Belum ada</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="num text-[12.5px] text-fog">—</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={statusTone === 'pine' ? 'pine' : 'neutral'} size="sm">
                        {s.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr className="bg-paper/40">
                      <td colSpan={8} className="px-6 pb-5 pt-1">
                        <div className="row-in grid gap-4 md:grid-cols-[1fr_260px]">
                          <div className="rounded-lg border border-line bg-surface">
                            <p className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-fog">
                              Riwayat Purchase Order
                            </p>
                            <p className="px-4 py-5 text-center text-[12.5px] text-fog">
                              Belum ada pesanan ke supplier ini.
                            </p>
                          </div>
                          <div className="space-y-2.5">
                            <div className="rounded-lg border border-line bg-surface px-3.5 py-3">
                              <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-fog">Email Order</p>
                              <p className="num text-[12.5px] font-semibold break-all text-ink">
                                {s.email || '—'}
                              </p>
                            </div>
                            <div className="rounded-lg border border-line bg-surface px-3.5 py-3">
                              <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-fog">Termin Pembayaran</p>
                              <p className="text-[12.5px] font-semibold">
                                {s.term === 'Tunai'
                                  ? 'Bayar saat barang datang'
                                  : `Pembayaran ${s.term.replace('Tempo ', '')} hari setelah terima barang`}
                              </p>
                            </div>
                            {isOwner && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStatusToggle(s);
                                }}
                                className="btn-outline w-full py-2 text-[12.5px]"
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
          <svg width="22" height="22" className="mx-auto mb-2 text-fog" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M2 7l10 10 10-10" />
          </svg>
          <p className="text-sm font-semibold text-ink">Supplier tidak ditemukan</p>
        </div>
      )}
    </div>
  );
}
