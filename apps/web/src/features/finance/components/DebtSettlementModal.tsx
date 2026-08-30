'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import type { ReceivableItem, PayableItem, PaymentMethod } from '../types';

interface DebtSettlementModalProps {
  open: boolean;
  kind: 'piutang' | 'hutang';
  item: ReceivableItem | PayableItem | null;
  onClose: () => void;
  onSettleReceivable: (
    id: string,
    amount_minor: number,
    method: PaymentMethod,
    reference?: string | null
  ) => Promise<void>;
  onSettlePayable: (
    id: string,
    expected_server_version: number,
    amount_minor: number,
    method: PaymentMethod,
    reference?: string | null
  ) => Promise<void>;
  isSaving: boolean;
}

function idr(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
}

export function DebtSettlementModal({
  open,
  kind,
  item,
  onClose,
  onSettleReceivable,
  onSettlePayable,
  isSaving,
}: DebtSettlementModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item && open) {
      setAmount(item.outstanding_minor ? item.outstanding_minor.toLocaleString('id-ID') : '');
      setReference('');
      setError(null);
    }
  }, [item, open]);

  if (!item) return null;

  const isPiutang = kind === 'piutang';
  const partyName = isPiutang
    ? (item as ReceivableItem).customer_name || 'Pelanggan'
    : (item as PayableItem).supplier_name || (item as PayableItem).code || 'Supplier';

  const maxPayable = item.outstanding_minor;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseInt(amount.replace(/\D/g, ''), 10);
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Nominal pembayaran harus lebih dari 0.');
      return;
    }

    if (parsedAmount > maxPayable) {
      setError(`Nominal pembayaran tidak boleh melebihi sisa kewajiban (${idr(maxPayable)}).`);
      return;
    }

    try {
      if (isPiutang) {
        await onSettleReceivable(item.id, parsedAmount, method, reference.trim() || null);
      } else {
        const payItem = item as PayableItem;
        await onSettlePayable(
          payItem.id,
          payItem.server_version,
          parsedAmount,
          method,
          reference.trim() || null
        );
      }
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Gagal memproses pembayaran.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isPiutang ? 'Terima Pembayaran Piutang' : 'Pelunasan Tagihan Hutang'}
      description={
        isPiutang
          ? `Pencatatan penerimaan pelunasan piutang dari ${partyName}.`
          : `Pencatatan pembayaran hutang pembelian ke ${partyName}.`
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {/* Info Box */}
        <div className="rounded-xl border border-line bg-paper/60 p-3.5 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-fog">{isPiutang ? 'Pelanggan' : 'Supplier'}</span>
            <span className="font-bold text-ink">{partyName}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-fog">Sisa Kewajiban</span>
            <span className="num font-bold text-rose-700">{idr(maxPayable)}</span>
          </div>
        </div>

        {/* Nominal Bayar */}
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-fog">
            Nominal Dibayar (Rp)
          </label>
          <input
            type="text"
            value={amount}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              setAmount(val ? Number(val).toLocaleString('id-ID') : '');
            }}
            placeholder="0"
            className="num w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-base font-bold text-ink focus:border-pine focus:outline-hidden"
          />
        </div>

        {/* Metode Pembayaran */}
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-fog">
            Metode Pembayaran
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs text-ink focus:border-pine focus:outline-hidden"
          >
            <option value="cash">Kas Tunai</option>
            <option value="bank_transfer">Transfer Bank</option>
            <option value="debit">Kartu Debit</option>
            <option value="credit">Kartu Kredit</option>
          </select>
        </div>

        {/* Referensi */}
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-fog">
            Nomor Referensi / Catatan (Opsional)
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="cth: TRF-BCA-88219"
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs text-ink placeholder:text-fog/60 focus:border-pine focus:outline-hidden"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-line bg-surface py-2.5 text-xs font-bold text-fog transition hover:bg-paper cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 rounded-xl bg-pine py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-pine-deep disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? 'Memproses...' : isPiutang ? 'Terima Pembayaran' : 'Lunasi Tagihan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
