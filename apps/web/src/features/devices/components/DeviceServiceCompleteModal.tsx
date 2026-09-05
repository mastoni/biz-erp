import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { DeviceServiceDto, CompleteDeviceServicePayload, DeviceDto } from '../types';

interface DeviceServiceCompleteModalProps {
  service: DeviceServiceDto | null;
  isOpen: boolean;
  onClose: () => void;
  availableReplacementDevices?: DeviceDto[];
  onConfirmComplete: (serviceId: string, payload: CompleteDeviceServicePayload) => Promise<void>;
}

export function DeviceServiceCompleteModal({
  service,
  isOpen,
  onClose,
  availableReplacementDevices = [],
  onConfirmComplete,
}: DeviceServiceCompleteModalProps) {
  const [replacementDeviceId, setReplacementDeviceId] = useState('');
  const [findings, setFindings] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (service) {
      setReplacementDeviceId(service.replacement_device_id || '');
      setFindings(service.findings || '');
      setActionTaken(service.action_taken || '');
      setNotes(service.notes || '');
    }
  }, [service]);

  if (!isOpen || !service) return null;

  const isReplacement = service.service_type === 'REPLACEMENT';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isReplacement && !replacementDeviceId) {
      setErrorMessage('Pilih perangkat pengganti (RMA swap) untuk menyelesaikan penggantian.');
      return;
    }

    if (!actionTaken.trim()) {
      setErrorMessage('Tindakan penanganan wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmComplete(service.id, {
        replacement_device_id: isReplacement ? replacementDeviceId : undefined,
        findings: findings.trim() || null,
        action_taken: actionTaken.trim(),
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyelesaikan work order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface shadow-2xl overflow-hidden dark:border-ink/20">
        <div className="flex items-center justify-between border-b border-ink/10 px-6 py-4 dark:border-ink/20">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-ink">Selesaikan Work Order</h3>
              <p className="text-xs text-ink/60 font-mono">Tipe: {service.service_type}</p>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* RMA Replacement Notice */}
          {isReplacement && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2 dark:border-amber-900/40 dark:bg-amber-950/30">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span>Penggantian Hardware (RMA Swap)</span>
              </div>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                Menyelesaikan work order ini akan secara otomatis menandai perangkat lama sebagai <span className="font-bold">DEFECTIVE</span> dan memasang unit baru ke pelanggan serta mengurangi 1 unit stok inventaris.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-ink mb-1">
                  Unit Pengganti <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={replacementDeviceId}
                  onChange={(e) => setReplacementDeviceId(e.target.value)}
                  className="w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs font-mono text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
                >
                  <option value="">-- Pilih Unit Pengganti dari Gudang --</option>
                  {availableReplacementDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.serial_number} ({d.device_type} - {d.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Findings */}
          <div>
            <label className="block text-xs font-bold text-ink">Hasil Temuan / Diagnosa</label>
            <textarea
              rows={2}
              placeholder="Misal: Optik terbakar akibat petir"
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-paper p-2.5 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
            />
          </div>

          {/* Action Taken (Required) */}
          <div>
            <label className="block text-xs font-bold text-ink">
              Tindakan Penanganan <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              required
              placeholder="Misal: Mengganti router ONT dengan unit baru, redaman -19dBm, internet kembali normal"
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-paper p-2.5 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-ink">Catatan Penyelesaian</label>
            <input
              type="text"
              placeholder="Catatan verifikasi pelanggan / tanda terima"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 cursor-pointer"
            >
              {isSubmitting ? 'Menyelesaikan...' : 'Konfirmasi Selesai'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
