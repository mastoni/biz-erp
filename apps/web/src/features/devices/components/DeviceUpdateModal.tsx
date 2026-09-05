import React, { useState, useEffect } from 'react';
import { X, Edit2 } from 'lucide-react';
import { DeviceDto, UpdateDevicePayload } from '../types';

interface DeviceUpdateModalProps {
  device: DeviceDto | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmUpdate: (deviceId: string, patch: UpdateDevicePayload) => Promise<void>;
}

export function DeviceUpdateModal({
  device,
  isOpen,
  onClose,
  onConfirmUpdate,
}: DeviceUpdateModalProps) {
  const [macAddress, setMacAddress] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState<number>(12);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (device) {
      setMacAddress(device.mac_address || '');
      setWarrantyMonths(device.warranty_months ?? 12);
      setNotes(device.notes || '');
    }
  }, [device]);

  if (!isOpen || !device) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    setIsSubmitting(true);
    try {
      await onConfirmUpdate(device.id, {
        mac_address: macAddress.trim() || null,
        warranty_months: Number(warrantyMonths) || 0,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memperbarui data perangkat');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface shadow-2xl overflow-hidden dark:border-ink/20">
        <div className="flex items-center justify-between border-b border-ink/10 px-6 py-4 dark:border-ink/20">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-ink/10 p-2 text-ink">
              <Edit2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-ink">Edit Perangkat Hardware</h3>
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
          <div>
            <label className="block text-xs font-bold text-ink">MAC Address</label>
            <input
              type="text"
              placeholder="AA:BB:CC:DD:EE:FF"
              value={macAddress}
              onChange={(e) => setMacAddress(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs font-mono text-ink uppercase focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink">Durasi Garansi (Bulan)</label>
            <input
              type="number"
              min="0"
              value={warrantyMonths}
              onChange={(e) => setWarrantyMonths(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink">Catatan Perangkat</label>
            <textarea
              rows={3}
              placeholder="Catatan teknis / spesifikasi tambahan"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-paper p-2.5 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
            />
          </div>

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
              className="inline-flex items-center gap-1.5 rounded-lg bg-pine px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-pine-deep cursor-pointer"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
