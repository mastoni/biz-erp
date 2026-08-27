'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { PackageCheck } from 'lucide-react';
import { idr, num } from '../purchase-helpers';
import type { PurchaseReceiveItemInput, PurchaseViewModel } from '../types';

interface PurchaseReceiveModalProps {
  open: boolean;
  purchase: PurchaseViewModel | null;
  onClose: () => void;
  onSubmit: (id: string, items: PurchaseReceiveItemInput[]) => Promise<void>;
  isSaving: boolean;
}

export function PurchaseReceiveModal({
  open,
  purchase,
  onClose,
  onSubmit,
  isSaving,
}: PurchaseReceiveModalProps) {
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (purchase && open) {
      const initial: Record<string, number> = {};
      purchase.items.forEach((it) => {
        initial[it.id] = it.remaining_qty;
      });
      setReceiveQtys(initial);
      setError(null);
    }
  }, [purchase, open]);

  if (!purchase) return null;

  const handleQtyChange = (itemId: string, val: number, maxQty: number) => {
    const clamped = Math.max(0, Math.min(maxQty, val));
    setReceiveQtys((prev) => ({
      ...prev,
      [itemId]: clamped,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const itemsToReceive: PurchaseReceiveItemInput[] = Object.entries(receiveQtys)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => ({
        item_id: itemId,
        receive_qty: qty,
      }));

    if (itemsToReceive.length === 0) {
      setError('Masukkan minimal 1 unit barang yang diterima.');
      return;
    }

    try {
      await onSubmit(purchase.id, itemsToReceive);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gagal memproses penerimaan barang.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Terima Barang — ${purchase.code}`}
      description="Konfirmasi jumlah barang fisik yang tiba di gudang. Stok inventaris akan bertambah otomatis."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line bg-paper/60 text-[11px] font-bold uppercase tracking-wider text-fog">
                <th className="px-3.5 py-2.5">Barang</th>
                <th className="px-3 py-2.5 text-center">Dipesan</th>
                <th className="px-3 py-2.5 text-center">Tiba</th>
                <th className="px-3.5 py-2.5 text-right">Terima Sekarang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60 bg-surface">
              {purchase.items.map((it) => {
                const currentReceive = receiveQtys[it.id] ?? it.remaining_qty;

                return (
                  <tr key={it.id}>
                    <td className="px-3.5 py-2.5">
                      <p className="font-semibold text-ink">{it.product_name}</p>
                      <p className="num text-[11px] text-fog">
                        HPP: {idr(it.unit_cost_minor)}
                      </p>
                    </td>
                    <td className="num px-3 py-2.5 text-center font-medium text-ink">
                      {it.ordered_qty}
                    </td>
                    <td className="num px-3 py-2.5 text-center font-medium text-fog">
                      {it.received_qty}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      {it.remaining_qty === 0 ? (
                        <span className="text-[11px] font-bold text-emerald-700">
                          Sudah Lengkap
                        </span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          max={it.remaining_qty}
                          value={currentReceive}
                          onChange={(e) =>
                            handleQtyChange(it.id, Number(e.target.value) || 0, it.remaining_qty)
                          }
                          className="num h-8 w-20 rounded-lg border border-line bg-card px-2 text-center text-xs font-bold text-ink outline-none transition focus:border-pine focus:ring-1 focus:ring-pine"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Financial info notice */}
        <div className="rounded-xl border border-line bg-paper/40 p-3 text-xs text-fog">
          {purchase.supplier_term === 'Tunai' ? (
            <p>
              <strong className="text-ink">Pembelian Tunai:</strong> Penerimaan barang akan otomatis mencatat pelunasan tunai sesuai nilai barang yang diterima.
            </p>
          ) : (
            <p>
              <strong className="text-ink">Pembelian Tempo ({purchase.supplier_term}):</strong> Penerimaan barang akan menambah stok gudang dan mencatat sisa tagihan yang harus dibayar sebelum tanggal jatuh tempo ({purchase.due_date}).
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line bg-surface px-4 py-2 text-xs font-bold text-ink transition hover:bg-paper cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-xl bg-pine px-4 py-2 text-xs font-bold text-white transition hover:bg-pine-deep disabled:opacity-50 cursor-pointer"
          >
            <PackageCheck width={14} height={14} />
            {isSaving ? 'Menyimpan...' : 'Konfirmasi Penerimaan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
