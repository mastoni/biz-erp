import React, { useState, useEffect } from 'react';
import { X, Edit2 } from 'lucide-react';
import { DeviceServiceDto, DeviceServiceStatus, UpdateDeviceServicePayload } from '../types';

interface DeviceServiceUpdateModalProps {
  service: DeviceServiceDto | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmUpdate: (serviceId: string, patch: UpdateDeviceServicePayload) => Promise<void>;
}

export function DeviceServiceUpdateModal({
  service,
  isOpen,
  onClose,
  onConfirmUpdate,
}: DeviceServiceUpdateModalProps) {
  const [status, setStatus] = useState<DeviceServiceStatus>('PENDING');
  const [technicianName, setTechnicianName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [findings, setFindings] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (service) {
      setStatus(service.status);
      setTechnicianName(service.technician_name || '');
      setScheduledAt(
        service.scheduled_at ? new Date(service.scheduled_at).toISOString().slice(0, 16) : ''
      );
      setFindings(service.findings || '');
      setActionTaken(service.action_taken || '');
      setNotes(service.notes || '');
    }
  }, [service]);

  if (!isOpen || !service) return null;

  // Allowed transitions
  const allowedTransitions: Record<DeviceServiceStatus, DeviceServiceStatus[]> = {
    PENDING: ['PENDING', 'SCHEDULED', 'IN_PROGRESS', 'CANCELLED'],
    SCHEDULED: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    IN_PROGRESS: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'SCHEDULED'],
    COMPLETED: ['COMPLETED'],
    CANCELLED: ['CANCELLED'],
  };

  const statusOptions = allowedTransitions[service.status] || [service.status];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    setIsSubmitting(true);
    try {
      await onConfirmUpdate(service.id, {
        status: status !== service.status ? status : undefined,
        technician_name: technicianName.trim() || null,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        findings: findings.trim() || null,
        action_taken: actionTaken.trim() || null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memperbarui data work order');
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
              <h3 className="font-display text-base font-bold text-ink">Update Work Order Servis</h3>
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
          {/* Status Selection */}
          <div>
            <label className="block text-xs font-bold text-ink">Status Work Order</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as DeviceServiceStatus)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
            >
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === 'PENDING'
                    ? 'Menunggu (PENDING)'
                    : opt === 'SCHEDULED'
                    ? 'Dijadwalkan (SCHEDULED)'
                    : opt === 'IN_PROGRESS'
                    ? 'Sedang Dikerjakan (IN_PROGRESS)'
                    : opt === 'COMPLETED'
                    ? 'Selesai (COMPLETED)'
                    : 'Dibatalkan (CANCELLED)'}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Technician Name */}
            <div>
              <label className="block text-xs font-bold text-ink">Teknisi Penanggung Jawab</label>
              <input
                type="text"
                placeholder="Nama Teknisi"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
              />
            </div>

            {/* Scheduled Date */}
            <div>
              <label className="block text-xs font-bold text-ink">Jadwal Pelaksanaan</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
              />
            </div>
          </div>

          {/* Findings */}
          <div>
            <label className="block text-xs font-bold text-ink">Temuan / Diagnosa</label>
            <textarea
              rows={2}
              placeholder="Hasil pengecekan teknis di lapangan"
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-paper p-2.5 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
            />
          </div>

          {/* Action Taken */}
          <div>
            <label className="block text-xs font-bold text-ink">Tindakan yang Dilakukan</label>
            <textarea
              rows={2}
              placeholder="Langkah perbaikan / penanganan yang telah dilakukan"
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-paper p-2.5 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-ink">Catatan</label>
            <input
              type="text"
              placeholder="Catatan tambahan"
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
