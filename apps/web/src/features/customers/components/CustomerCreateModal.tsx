'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { CustomerCreateFormModel, CustomerTier } from '../types';

interface CustomerCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (form: CustomerCreateFormModel) => Promise<void>;
  isSaving?: boolean;
}

export function CustomerCreateModal({
  open,
  onClose,
  onSubmit,
  isSaving = false,
}: CustomerCreateModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tier, setTier] = useState<CustomerTier>('Reguler');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama pelanggan wajib diisi.');
      return;
    }

    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        phone: phone.trim(),
        tier,
      });
      setName('');
      setPhone('');
      setTier('Reguler');
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Gagal mendaftarkan pelanggan.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-card shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="font-display text-base font-bold text-ink">Tambah Pelanggan</h3>
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
            <label className="mb-1.5 block text-xs font-semibold text-ink">Nama Lengkap</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="cth: Sari Rahmawati"
              className="h-10 w-full rounded-xl border border-line bg-paper/30 px-3 text-xs text-ink placeholder:text-fog/70 transition-all focus:border-pine focus:bg-card focus:outline-none focus:ring-1 focus:ring-pine/20"
              autoFocus
            />
          </div>

          <div className="mb-3.5">
            <label className="mb-1.5 block text-xs font-semibold text-ink">No. Telepon</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08xx-xxxx-xxxx"
              className="h-10 w-full rounded-xl border border-line bg-paper/30 px-3 text-xs text-ink placeholder:text-fog/70 transition-all focus:border-pine focus:bg-card focus:outline-none focus:ring-1 focus:ring-pine/20"
            />
          </div>

          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-semibold text-ink">Tier Member</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Reguler', 'Silver', 'Gold'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className={`rounded-xl border py-2 text-xs font-bold transition-all cursor-pointer ${
                    tier === t
                      ? 'border-pine bg-pine-soft text-pine font-bold ring-1 ring-pine'
                      : 'border-line text-fog hover:border-pine/40 hover:text-ink'
                  }`}
                >
                  {t}
                </button>
              ))}
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
