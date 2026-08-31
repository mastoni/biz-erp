'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { CreditCard } from 'lucide-react';
import { idr } from '../purchase-helpers';
import type { PaymentMethod, PurchaseViewModel } from '../types';

interface PurchasePaymentModalProps {
  open: boolean;
  purchase: PurchaseViewModel | null;
  onClose: () => void;
  onSubmit: (
    id: string,
    amount_minor: number,
    method: PaymentMethod,
    reference?: string | null
  ) => Promise<void>;
  isSaving: boolean;
}

export function PurchasePaymentModal({
  open,
  purchase,
  onClose,
  onSubmit,
  isSaving,
}: PurchasePaymentModalProps) {
  const [amountMajor, setAmountMajor] = useState<number>(0);
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (purchase && open) {
      // Default to full remaining outstanding balance
      setAmountMajor(purchase.outstanding_minor);
      setMethod('bank_transfer');
      setReference('');
      setError(null);
    }
  }, [purchase, open]);

  if (!purchase) return null;

  const maxMajor = purchase.outstanding_minor;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amount_minor = Math.round(amountMajor);

    if (amount_minor <= 0) {
      setError('Nominal pembayaran harus lebih dari Rp 0.');
      return;
    }

    if (amount_minor > purchase.outstanding_minor) {
      setError(`Nominal melebihi sisa tagihan (${idr(purchase.outstanding_minor)}).`);
      return;
    }

    try {
      await onSubmit(purchase.id, amount_minor, method, reference.trim() || null);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gagal memproses pembayaran tagihan.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Bayar Tagihan Supplier — ${purchase.code}`}
      description="Catat pembayaran pelunasan tagihan tempo ke supplier."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {/* Breakdown box */}
        <div className="rounded-xl border border-line bg-paper/40 p-3 text-xs space-y-1.5 shadow-2xs">
          <div className="flex justify-between">
            <span className="text-fog">Total Pesanan:</span>
            <span className="num font-bold text-ink">{idr(purchase.total_minor)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-fog">Telah Dibayar:</span>
            <span className="num font-medium text-emerald-700">{idr(purchase.paid_minor)}</span>
          </div>
          <div className="flex justify-between border-t border-line/60 pt-1.5">
            <span className="font-bold text-fog">Sisa Tagihan (Maksimal):</span>
            <span className="num font-bold text-clay">{idr(purchase.outstanding_minor)}</span>
          </div>
        </div>

        {/* Nominal input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold uppercase tracking-wider text-fog">
              Nominal Bayar (Rp) <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => setAmountMajor(maxMajor)}
              className="text-[11px] font-bold text-pine hover:underline cursor-pointer"
            >
              Bayar Lunas ({idr(purchase.outstanding_minor)})
            </button>
          </div>
          <input
            type="number"
            min={1}
            max={maxMajor}
            value={amountMajor || ''}
            onChange={(e) => setAmountMajor(Math.max(0, Number(e.target.value) || 0))}
            placeholder="0"
            className="num h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-pine focus:ring-1 focus:ring-pine"
          />
        </div>

        {/* Payment method */}
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-fog">
            Metode Pembayaran <span className="text-rose-500">*</span>
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs font-medium text-ink outline-none transition focus:border-pine focus:ring-1 focus:ring-pine"
          >
            <option value="bank_transfer">Transfer Bank</option>
            <option value="cash">Tunai / Kas</option>
            <option value="debit">Kartu Debit</option>
            <option value="credit">Kartu Kredit</option>
          </select>
        </div>

        {/* Reference */}
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-fog">
            No. Referensi / Bukti Transfer (Opsional)
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="cth: TRF-BCA-992318"
            className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink outline-none transition placeholder:text-fog/70 focus:border-pine focus:ring-1 focus:ring-pine"
          />
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
            <CreditCard width={14} height={14} />
            {isSaving ? 'Menyimpan...' : 'Simpan Pembayaran'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
