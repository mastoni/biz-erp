import React, { useState } from 'react';
import { X, RotateCcw, AlertTriangle } from 'lucide-react';
import { DeviceDto, UnassignDevicePayload } from '../types';

interface DeviceUnassignModalProps {
  device: DeviceDto | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmUnassign: (deviceId: string, payload: UnassignDevicePayload) => Promise<void>;
}

export function DeviceUnassignModal({
  device,
  isOpen,
  onClose,
  onConfirmUnassign,
}: DeviceUnassignModalProps) {
  const [returnStatus, setReturnStatus] = useState<'IN_STOCK' | 'DEFECTIVE' | 'RETURNED' | 'DECOMMISSIONED'>('IN_STOCK');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !device) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    setIsSubmitting(true);
    try {
      await onConfirmUnassign(device.id, {
        return_status: returnStatus,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menarik perangkat');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface shadow-2xl overflow-hidden dark:border-ink/20">
        <div className="flex items-center justify-between border-b border-ink/10 px-6 py-4 dark:border-ink/20">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-ink">Tarik Perangkat (Unassign)</h3>
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
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              Perangkat akan dilepas dari pelanggan <span className="font-bold">{device.customer_name || 'terkait'}</span>.
            </div>
          </div>

          {/* Return Status destination */}
          <div>
            <label className="block text-xs font-bold text-ink">
              Status Tujuan Penarikan <span className="text-rose-500">*</span>
            </label>
            <select
              value={returnStatus}
              onChange={(e) =>
                setReturnStatus(
                  e.target.value as 'IN_STOCK' | 'DEFECTIVE' | 'RETURNED' | 'DECOMMISSIONED'
                )
              }
              className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
            >
              <option value="IN_STOCK">Kembalikan ke Gudang (IN_STOCK, Stok Inventaris +1)</option>
              <option value="DEFECTIVE">Tandai Rusak / Perlu Servis (DEFECTIVE)</option>
              <option value="RETURNED">Kembalikan ke Pemilik (RETURNED)</option>
              <option value="DECOMMISSIONED">Afkir / Nonaktifkan (DECOMMISSIONED)</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-ink">Alasan / Catatan Penarikan</label>
            <textarea
              rows={2}
              placeholder="Contoh: Berhenti berlangganan / upgrade perangkat baru"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-paper p-2.5 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700 cursor-pointer"
            >
              {isSubmitting ? 'Memproses...' : 'Konfirmasi Penarikan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
