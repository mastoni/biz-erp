'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Plus, Trash2, Truck } from 'lucide-react';
import { getSuppliers } from '@/features/suppliers/api';
import { fetchProducts } from '@/features/products/api';
import { idr, num } from '../purchase-helpers';
import type { Supplier } from '@/features/suppliers/types';
import type { ProductViewModel } from '@/features/products/types';
import type { PurchaseCreateInput, PurchaseCreateItemInput } from '../types';

interface PurchaseCreateModalProps {
  open: boolean;
  businessId: string;
  branchId?: string;
  onClose: () => void;
  onSubmit: (input: Omit<PurchaseCreateInput, 'business_id' | 'branch_id'> & { branch_id?: string }) => Promise<void>;
  isSaving: boolean;
  error: string | null;
}

interface DraftLineItem {
  productId: string;
  productName: string;
  qty: number;
  costMinor: number;
}

export function PurchaseCreateModal({
  open,
  businessId,
  branchId,
  onClose,
  onSubmit,
  isSaving,
  error,
}: PurchaseCreateModalProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProductViewModel[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [note, setNote] = useState<string>('');

  // Add Item Line state
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [qty, setQty] = useState<number>(10);
  const [draftLines, setDraftLines] = useState<DraftLineItem[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Load active suppliers & products when modal opens
  useEffect(() => {
    if (!open || !businessId) return;

    let isMounted = true;

    async function loadMasterData() {
      try {
        const [supRes, prodRes] = await Promise.allSettled([
          getSuppliers(businessId, 100, 0),
          fetchProducts({ business_id: businessId, limit: 100, offset: 0 }),
        ]);

        if (isMounted) {
          if (supRes.status === 'fulfilled') {
            const activeSups = (supRes.value.items || []).filter((s) => s.status === 'aktif');
            setSuppliers(activeSups);
            if (activeSups.length > 0 && !selectedSupplierId) {
              setSelectedSupplierId(activeSups[0].id);
            }
          }
          if (prodRes.status === 'fulfilled') {
            const activeProds = (prodRes.value.items || []).filter((p) => p.is_active);
            setProducts(activeProds);
            if (activeProds.length > 0 && !selectedProductId) {
              setSelectedProductId(activeProds[0].id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load master data for PO create modal', err);
      }
    }

    loadMasterData();

    return () => {
      isMounted = false;
    };
  }, [open, businessId]);

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleAddItem = () => {
    if (!selectedProduct) return;
    if (qty <= 0) {
      setFormError('Jumlah pesanan minimal 1 unit.');
      return;
    }

    setFormError(null);
    setDraftLines((prev) => {
      const existingIdx = prev.findIndex((l) => l.productId === selectedProduct.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].qty += qty;
        return updated;
      }
      return [
        ...prev,
        {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          qty,
          costMinor: selectedProduct.cost_minor || 0,
        },
      ];
    });
  };

  const handleRemoveItem = (productId: string) => {
    setDraftLines((prev) => prev.filter((l) => l.productId !== productId));
  };

  const draftTotalMinor = draftLines.reduce((s, l) => s + l.qty * l.costMinor, 0);

  const resetForm = () => {
    setDraftLines([]);
    setNote('');
    setQty(10);
    setFormError(null);
  };

  const handleSave = async (initialStatus: 'draft' | 'sent') => {
    if (!selectedSupplierId) {
      setFormError('Pilih supplier terlebih dahulu.');
      return;
    }
    if (draftLines.length === 0) {
      setFormError('Tambahkan minimal satu item barang ke pesanan.');
      return;
    }

    const items: PurchaseCreateItemInput[] = draftLines.map((l) => ({
      product_id: l.productId,
      ordered_qty: l.qty,
    }));

    try {
      await onSubmit({
        id: crypto.randomUUID(),
        supplier_id: selectedSupplierId,
        branch_id: branchId,
        status: initialStatus,
        items,
        note: note.trim() || null,
      });

      resetForm();
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Gagal menyimpan pesanan pembelian.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title="Buat Purchase Order"
      description="Buat pesanan pembelian barang ke supplier. Saat barang tiba, stok inventaris bertambah otomatis."
      maxWidth="2xl"
    >
      <div className="space-y-4 pt-1">
        {/* Error message */}
        {(error || formError) && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            {formError || error}
          </div>
        )}

        {/* Top Supplier & Termin Grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-fog">
              Supplier <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs font-medium text-ink outline-none transition focus:border-pine focus:ring-1 focus:ring-pine"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-fog">
              Termin Pembayaran
            </label>
            <div className="flex h-10 items-center rounded-xl border border-line bg-paper/60 px-3 text-xs font-bold text-fog">
              {selectedSupplier ? `${selectedSupplier.term}` : '—'}
            </div>
          </div>
        </div>

        {/* Item Picker Box */}
        <div className="rounded-xl border border-dashed border-line-dark bg-paper/30 p-3.5 space-y-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-fog">
            Tambah Item Barang
          </p>

          <div className="flex flex-wrap gap-2">
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="h-10 min-w-[200px] flex-1 rounded-xl border border-line bg-surface px-3 text-xs font-medium text-ink outline-none transition focus:border-pine focus:ring-1 focus:ring-pine"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · HPP: {idr(p.cost_minor)}
                </option>
              ))}
            </select>

            <input
              type="number"
              min={1}
              value={qty || ''}
              onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))}
              placeholder="Qty"
              className="num h-10 w-24 rounded-xl border border-line bg-surface px-3 text-center text-xs font-bold text-ink outline-none transition focus:border-pine focus:ring-1 focus:ring-pine"
            />

            <button
              type="button"
              onClick={handleAddItem}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 text-xs font-bold text-ink transition hover:bg-paper cursor-pointer"
            >
              <Plus width={14} height={14} />
              Tambah
            </button>
          </div>

          {selectedProduct && (
            <p className="num text-[11px] text-fog">
              Harga beli: <span className="font-bold text-pine">{idr(selectedProduct.cost_minor)}</span> / unit · Subtotal preview: {idr((selectedProduct.cost_minor || 0) * (qty || 0))}
            </p>
          )}
        </div>

        {/* Added Items List */}
        {draftLines.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="bg-paper/60 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-fog">
              Daftar Barang Dipesan ({draftLines.length})
            </div>
            <ul className="divide-y divide-line/60">
              {draftLines.map((line) => (
                <li
                  key={line.productId}
                  className="flex items-center justify-between gap-3 bg-surface px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0 flex-1 truncate">
                    <p className="font-semibold text-ink">{line.productName}</p>
                    <p className="num text-fog">
                      {line.qty} unit × {idr(line.costMinor)}
                    </p>
                  </div>
                  <span className="num font-bold text-ink">
                    {idr(line.qty * line.costMinor)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(line.productId)}
                    className="rounded-md p-1 text-fog transition hover:bg-rose-50 hover:text-clay cursor-pointer"
                    aria-label="Hapus item"
                  >
                    <Trash2 width={14} height={14} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between bg-paper/60 px-3.5 py-2.5">
              <span className="text-xs font-bold text-ink">Estimasi Total PO</span>
              <span className="num text-sm font-bold text-pine">
                {idr(draftTotalMinor)}
              </span>
            </div>
          </div>
        )}

        {/* Note */}
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-fog">
            Catatan untuk Supplier (Opsional)
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="cth: Kirim sebelum akhir pekan..."
            className="w-full rounded-xl border border-line bg-surface p-3 text-xs text-ink outline-none transition placeholder:text-fog/70 focus:border-pine focus:ring-1 focus:ring-pine"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => handleSave('draft')}
            disabled={isSaving || draftLines.length === 0}
            className="flex-1 rounded-xl border border-line bg-surface py-2.5 text-xs font-bold text-ink transition hover:bg-paper disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Draft'}
          </button>
          <button
            type="button"
            onClick={() => handleSave('sent')}
            disabled={isSaving || draftLines.length === 0}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-pine py-2.5 text-xs font-bold text-white transition hover:bg-pine-deep disabled:opacity-50 cursor-pointer"
          >
            <Truck width={14} height={14} />
            {isSaving ? 'Mengirim...' : 'Kirim Sekarang'}
          </button>
        </div>

        {selectedSupplier && selectedSupplier.term !== 'Tunai' && (
          <p className="text-center text-[11px] text-fog">
            Termin {selectedSupplier.term} — saat barang tiba & diterima, otomatis tercatat sebagai tagihan hutang usaha.
          </p>
        )}
      </div>
    </Modal>
  );
}
