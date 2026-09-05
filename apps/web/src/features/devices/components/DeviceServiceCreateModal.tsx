import React, { useState } from 'react';
import { X, Wrench, AlertCircle } from 'lucide-react';
import {
  CreateDeviceServicePayload,
  DeviceServiceType,
  DeviceDto,
} from '../types';

interface DeviceServiceCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices?: DeviceDto[];
  customers?: Array<{ id: string; name: string; phone?: string }>;
  preselectedDeviceId?: string;
  initialDeviceId?: string;
  initialCustomerId?: string;
  onSubmit: (payload: CreateDeviceServicePayload) => Promise<void>;
}

export function DeviceServiceCreateModal({
  isOpen,
  onClose,
  devices = [],
  customers = [],
  preselectedDeviceId,
  initialDeviceId,
  initialCustomerId,
  onSubmit,
}: DeviceServiceCreateModalProps) {
  const effectiveDeviceId = preselectedDeviceId || initialDeviceId || '';
  const [deviceId, setDeviceId] = useState(effectiveDeviceId);
  const [customerId, setCustomerId] = useState(initialCustomerId || '');
  const [serviceType, setServiceType] = useState<DeviceServiceType>('MAINTENANCE');
  const [technicianName, setTechnicianName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [replacementDeviceId, setReplacementDeviceId] = useState('');
  const [findings, setFindings] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Selected device
  const selectedDev = devices.find((d) => d.id === (deviceId || preselectedDeviceId));
  // Available replacement devices (must be IN_STOCK or RESERVED, and not the same device)
  const availableReplacements = devices.filter(
    (d) => (d.status === 'IN_STOCK' || d.status === 'RESERVED') && d.id !== deviceId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const targetDevId = deviceId || preselectedDeviceId;
    if (!targetDevId) {
      setErrorMessage('Pilih perangkat target untuk work order ini.');
      return;
    }

    if (serviceType === 'REPLACEMENT' && !replacementDeviceId) {
      setErrorMessage('Pilih perangkat pengganti (RMA) yang tersedia.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        device_id: targetDevId,
        customer_id: customerId || selectedDev?.customer_id || null,
        service_type: serviceType,
        technician_name: technicianName.trim() || null,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        replacement_device_id: serviceType === 'REPLACEMENT' ? replacementDeviceId || null : null,
        findings: findings.trim() || null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal membuat work order servis');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-ink/10 bg-surface shadow-2xl overflow-hidden dark:border-ink/20">
        <div className="flex items-center justify-between border-b border-ink/10 px-6 py-4 dark:border-ink/20">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-pine/10 p-2 text-pine dark:bg-emerald-950/40 dark:text-emerald-400">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-ink">Buat Work Order / Tiket Servis</h3>
              <p className="text-xs text-ink/60">Tugaskan teknisi dan catat layanan operasional hardware.</p>
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
          {/* Target Device Selection */}
          <div>
            <label className="block text-xs font-bold text-ink">
              Perangkat Target <span className="text-rose-500">*</span>
            </label>
            <select
              required
              disabled={!!preselectedDeviceId}
              value={deviceId || preselectedDeviceId || ''}
              onChange={(e) => setDeviceId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs font-mono text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
            >
              <option value="">-- Pilih Perangkat Target --</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.serial_number} ({d.device_type} - {d.status})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Service Type */}
            <div>
              <label className="block text-xs font-bold text-ink">Tipe Layanan</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as DeviceServiceType)}
                className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
              >
                <option value="INSTALLATION">Pemasangan Baru (INSTALLATION)</option>
                <option value="MAINTENANCE">Cek Rutin / Maintenance (MAINTENANCE)</option>
                <option value="REPAIR">Perbaikan / Trouble Ticket (REPAIR)</option>
                <option value="REPLACEMENT">Penggantian / RMA Swap (REPLACEMENT)</option>
                <option value="DECOMMISSION">Tarik / Decommission (DECOMMISSION)</option>
              </select>
            </div>

            {/* Customer */}
            <div>
              <label className="block text-xs font-bold text-ink">Pelanggan Terkait</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
              >
                <option value="">-- Gunakan Pelanggan Perangkat --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Replacement device selection if REPLACEMENT */}
          {serviceType === 'REPLACEMENT' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-2 dark:border-amber-900/40 dark:bg-amber-950/30">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span>Pilih Perangkat Pengganti (RMA Swap Unit)</span>
              </div>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                Saat work order selesai, perangkat target akan ditandai DEFECTIVE dan unit pengganti akan ditandai INSTALLED di pelanggan.
              </p>
              <select
                required
                value={replacementDeviceId}
                onChange={(e) => setReplacementDeviceId(e.target.value)}
                className="w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs font-mono text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
              >
                <option value="">-- Pilih Unit Pengganti dari Gudang --</option>
                {availableReplacements.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.serial_number} ({d.device_type} - {d.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Technician Name */}
            <div>
              <label className="block text-xs font-bold text-ink">Nama Teknisi</label>
              <input
                type="text"
                placeholder="Misal: Teknisi Budi"
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

          {/* Findings / Keluhan */}
          <div>
            <label className="block text-xs font-bold text-ink">Gejala / Temuan Awal</label>
            <textarea
              rows={2}
              placeholder="Contoh: Lampu PON berkedip merah, redaman optik drop"
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-paper p-2.5 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-ink">Catatan Tambahan</label>
            <input
              type="text"
              placeholder="Instruksi untuk teknisi lapangan"
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-pine px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-pine-deep cursor-pointer"
            >
              {isSubmitting ? 'Menyimpan...' : 'Buat Work Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
