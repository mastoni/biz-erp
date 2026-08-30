'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Plus, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { PaymentMethod } from '../types';

interface CashTransactionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    type: 'masuk' | 'keluar',
    data: {
      description: string;
      category?: string;
      method: PaymentMethod;
      amount_minor: number;
    }
  ) => Promise<void>;
  isSaving: boolean;
}

const CATEGORIES_MASUK = [
  'Pemasukan Lainnya',
  'Komisi Agen',
  'Pendapatan Jasa',
  'Pendapatan Bunga',
  'Penjualan Non-Kasir',
];

const CATEGORIES_KELUAR = [
  'Operasional',
  'Utilitas (Listrik & Air)',
  'Gaji Karyawan',
  'Sewa Tempat',
  'Plastik & Kemasan',
  'Perbaikan & Servis',
  'Lainnya',
];

export function CashTransactionModal({
  open,
  onClose,
  onSubmit,
  isSaving,
}: CashTransactionModalProps) {
  const [type, setType] = useState<'masuk' | 'keluar'>('keluar');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Operasional');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleTypeChange = (newType: 'masuk' | 'keluar') => {
    setType(newType);
    setCategory(newType === 'masuk' ? CATEGORIES_MASUK[0] : CATEGORIES_KELUAR[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseInt(amount.replace(/\D/g, ''), 10);
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Nominal transaksi harus lebih dari 0.');
      return;
    }

    if (!description.trim()) {
      setError('Keterangan transaksi wajib diisi.');
      return;
    }

    try {
      await onSubmit(type, {
        description: description.trim(),
        category,
        method,
        amount_minor: parsedAmount,
      });
      // Reset form
      setDescription('');
      setAmount('');
      setError(null);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Gagal menyimpan transaksi.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Catat Transaksi Kas"
      description="Catat mutasi pemasukan atau pengeluaran kas operasional toko."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {/* Toggle Pemasukan / Pengeluaran */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleTypeChange('masuk')}
            className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition-all cursor-pointer ${
              type === 'masuk'
                ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-2xs'
                : 'border-line bg-surface text-fog hover:border-emerald-300'
            }`}
          >
            <ArrowDownRight className="h-4 w-4 text-emerald-600" />
            <span>Pemasukan</span>
          </button>

          <button
            type="button"
            onClick={() => handleTypeChange('keluar')}
            className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition-all cursor-pointer ${
              type === 'keluar'
                ? 'border-rose-600 bg-rose-50 text-rose-800 shadow-2xs'
                : 'border-line bg-surface text-fog hover:border-rose-300'
            }`}
          >
            <ArrowUpRight className="h-4 w-4 text-rose-600" />
            <span>Pengeluaran</span>
          </button>
        </div>

        {/* Keterangan */}
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-fog">
            Keterangan
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={type === 'masuk' ? 'cth: Komisi PPOB harian' : 'cth: Listrik & Air toko'}
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs text-ink placeholder:text-fog/60 focus:border-pine focus:outline-hidden"
          />
        </div>

        {/* Kategori & Metode */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-fog">
              Kategori
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-pine focus:outline-hidden"
            >
              {(type === 'masuk' ? CATEGORIES_MASUK : CATEGORIES_KELUAR).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-fog">
              Metode
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-pine focus:outline-hidden"
            >
              <option value="cash">Kas Tunai</option>
              <option value="bank_transfer">Transfer Bank</option>
              <option value="debit">Kartu Debit</option>
              <option value="credit">Kartu Kredit</option>
            </select>
          </div>
        </div>

        {/* Nominal */}
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-fog">
            Nominal (Rp)
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
            {isSaving ? 'Menyimpan...' : 'Simpan Catatan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
