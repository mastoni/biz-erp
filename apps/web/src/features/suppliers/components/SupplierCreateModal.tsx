'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { SupplierCreateFormModel, SupplierTerm } from '../types';
import { SUPPLIER_CATEGORY_OPTIONS } from '../supplier-helpers';

interface SupplierCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (form: SupplierCreateFormModel) => Promise<void>;
  isSaving?: boolean;
  error?: string | null;
}

export function SupplierCreateModal({
  open,
  onClose,
  onSubmit,
  isSaving = false,
  error: errorProp = null,
}: SupplierCreateModalProps) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('Sembako');
  const [term, setTerm] = useState<SupplierTerm>('Tempo 14');
  const [error, setError] = useState<string | null>(errorProp);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama supplier wajib diisi.');
      return;
    }

    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        contact: contact.trim(),
        phone: phone.trim(),
        email: email.trim(),
        category,
        term,
      });
      setName('');
      setContact('');
      setPhone('');
      setEmail('');
      setCategory('Sembako');
      setTerm('Tempo 14');
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Gagal mendaftarkan supplier.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-card shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="font-display text-base font-bold text-ink">Tambah Supplier</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-fog transition-colors hover:bg-paper hover:text-ink"
          >
            <X width={16} height={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5">
          {error && (
            <div className="mb-4 rounded-xl border border-brick/30 bg-brick/10 px-3.5 py-2 text-xs font-medium text-brick">
              {error}
            </div>
          )}

          <div className="mb-3.5">
            <label className="mb-1.5 block text-xs font-semibold text-ink">Nama Perusahaan</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="cth: UD Sumber Rejeki"
              className="h-10 w-full rounded-xl border border-line bg-paper/30 px-3 text-xs text-ink placeholder:text-fog/70 transition-all focus:border-pine focus:bg-card focus:outline-none focus:ring-1 focus:ring-pine/20"
              autoFocus
            />
          </div>

          <div className="mb-3.5 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink">Nama Kontak</label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="cth: Pak Budi"
                className="h-10 w-full rounded-xl border border-line bg-paper/30 px-3 text-xs text-ink placeholder:text-fog/70 transition-all focus:border-pine focus:bg-card focus:outline-none focus:ring-1 focus:ring-pine/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink">Telepon</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08xx-xxxx-xxxx"
                className="h-10 w-full rounded-xl border border-line bg-paper/30 px-3 text-xs text-ink placeholder:text-fog/70 transition-all focus:border-pine focus:bg-card focus:outline-none focus:ring-1 focus:ring-pine/20"
              />
            </div>
          </div>

          <div className="mb-3.5">
            <label className="mb-1.5 block text-xs font-semibold text-ink">Email Order</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="order@supplier.id"
              className="h-10 w-full rounded-xl border border-line bg-paper/30 px-3 text-xs text-ink placeholder:text-fog/70 transition-all focus:border-pine focus:bg-card focus:outline-none focus:ring-1 focus:ring-pine/20"
            />
          </div>

          <div className="mb-3.5 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink">Kategori Pasokan</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-paper/30 px-3 text-xs text-ink transition-all focus:border-pine focus:bg-card focus:outline-none focus:ring-1 focus:ring-pine/20"
              >
                {SUPPLIER_CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink">Termin Pembayaran</label>
              <select
                value={term}
                onChange={(e) => setTerm(e.target.value as SupplierTerm)}
                className="h-10 w-full rounded-xl border border-line bg-paper/30 px-3 text-xs text-ink transition-all focus:border-pine focus:bg-card focus:outline-none focus:ring-1 focus:ring-pine/20"
              >
                {['Tunai', 'Tempo 14', 'Tempo 30'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 rounded-xl border border-line py-2.5 text-xs font-bold text-ink transition-colors hover:bg-paper/70 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 rounded-xl bg-pine py-2.5 text-xs font-bold text-white transition-colors hover:bg-pine-deep disabled:opacity-50"
            >
              {isSaving ? 'Menyimpan...' : 'Daftarkan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
