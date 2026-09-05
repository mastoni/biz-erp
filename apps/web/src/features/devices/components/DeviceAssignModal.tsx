import React, { useState } from 'react';
import { X, UserCheck, AlertCircle } from 'lucide-react';
import { DeviceDto, AssignDevicePayload } from '../types';

interface DeviceAssignModalProps {
  device: DeviceDto | null;
  isOpen: boolean;
  onClose: () => void;
  customers?: Array<{ id: string; name: string; phone?: string }>;
  onConfirmAssign: (deviceId: string, payload: AssignDevicePayload) => Promise<void>;
}

export function DeviceAssignModal({
  device,
  isOpen,
  onClose,
  customers = [],
  onConfirmAssign,
}: DeviceAssignModalProps) {
  const [customerId, setCustomerId] = useState('');
  const [installedAddress, setInstalledAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !device) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!customerId) {
      setErrorMessage('Pilih pelanggan yang akan dipasangi perangkat.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmAssign(device.id, {
        customer_id: customerId,
        installed_address: installedAddress.trim() || null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memasang perangkat ke pelanggan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface shadow-2xl overflow-hidden dark:border-ink/20">
        <div className="flex items-center justify-between border-b border-ink/10 px-6 py-4 dark:border-ink/20">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-teal-50 p-2 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-ink">Pasang ke Pelanggan (Assign)</h3>
              <p className="text-xs text-ink/60 font-mono">SN: {device.serial_number}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink/50 hover:bg-ink/5 hover:text-ink cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="mx-6 mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-400">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Information banner */}
          <div className="flex items-start gap-2.5 rounded-xl border border-teal-200 bg-teal-50/50 p-3 text-xs text-teal-800 dark:border-teal-900/40 dark:bg-teal-950/30 dark:text-teal-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-teal-600 dark:text-teal-400" />
            <div>
              Perangkat akan ditandai <span className="font-bold">INSTALLED</span>. Jika perangkat memiliki produk katalog, stok gudang cabang akan otomatis teralokasi (-1 unit).
            </div>
          </div>

          {/* Customer selection */}
          <div>
            <label className="block text-xs font-bold text-ink">
              Pilih Pelanggan <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
            >
              <option value="">-- Pilih Pelanggan --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Installation address */}
          <div>
            <label className="block text-xs font-bold text-ink">Alamat Pemasangan</label>
            <textarea
              rows={2}
              placeholder="Contoh: Jl. Ahmad Yani No. 12, RT 02/05, Lantai 2"
              value={installedAddress}
              onChange={(e) => setInstalledAddress(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-paper p-2.5 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-ink">Catatan Pemasangan</label>
            <input
              type="text"
              placeholder="Misal: Paket Fiber 50Mbps + Router ONT"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-ink/10 dark:border-ink/20">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-ink/20 bg-paper px-4 py-2 text-xs font-semibold text-ink hover:bg-ink/5 dark:bg-slate-900/60 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-700 cursor-pointer"
            >
              {isSubmitting ? 'Memasang...' : 'Konfirmasi Pasang'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
