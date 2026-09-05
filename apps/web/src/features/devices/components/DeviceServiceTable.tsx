import React from 'react';
import Link from 'next/link';
import { Eye, CheckCircle2, Edit2, Wrench } from 'lucide-react';
import { DeviceServiceDto } from '../types';
import { DeviceServiceStatusPill } from './DeviceStatusPill';

interface DeviceServiceTableProps {
  services: DeviceServiceDto[];
  isLoading: boolean;
  canMutate: boolean;
  onUpdate: (service: DeviceServiceDto) => void;
  onComplete: (service: DeviceServiceDto) => void;
}

export function DeviceServiceTable({
  services,
  isLoading,
  canMutate,
  onUpdate,
  onComplete,
}: DeviceServiceTableProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-ink/10 bg-surface p-12 text-center dark:border-ink/20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-pine/20 border-t-pine" />
        <p className="mt-3 text-xs text-ink/60">Memuat daftar tiket servis & work order...</p>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink/15 bg-surface p-12 text-center dark:border-ink/20">
        <div className="rounded-full bg-ink/5 p-3 dark:bg-ink/10">
          <Wrench className="h-6 w-6 text-ink/40" />
        </div>
        <h3 className="mt-3 font-display text-sm font-bold text-ink">Tidak ada work order ditemukan</h3>
        <p className="mt-1 max-w-sm text-xs text-ink/60">
          Tidak ada tiket layanan teknis yang cocok dengan kriteria filter saat ini.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm dark:border-ink/20">
      <table className="w-full text-left text-xs text-ink">
        <thead className="border-b border-ink/10 bg-ink/[0.02] text-[11px] font-semibold text-ink/60 uppercase tracking-wider dark:border-ink/20 dark:bg-ink/[0.05]">
          <tr>
            <th className="px-4 py-3">Perangkat Target</th>
            <th className="px-4 py-3">Tipe Servis</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Pelanggan</th>
            <th className="px-4 py-3">Teknisi</th>
            <th className="px-4 py-3">Jadwal / Waktu</th>
            <th className="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/5 dark:divide-ink/10">
          {services.map((svc) => {
            const isPendingOrActive = svc.status !== 'COMPLETED' && svc.status !== 'CANCELLED';

            return (
              <tr key={svc.id} className="transition-colors hover:bg-ink/[0.02] dark:hover:bg-ink/[0.04]">
                {/* Target Device */}
                <td className="px-4 py-3">
                  <div className="font-mono font-bold text-xs text-ink">{svc.device_serial || 'Perangkat'}</div>
                  <div className="text-[10px] text-ink/50">{svc.device_type || 'Hardware'}</div>
                </td>

                {/* Service Type */}
                <td className="px-4 py-3">
                  <span className="inline-block rounded bg-ink/5 px-2 py-0.5 text-[11px] font-bold text-ink dark:bg-ink/15">
                    {svc.service_type}
                  </span>
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <DeviceServiceStatusPill status={svc.status} />
                </td>

                {/* Customer */}
                <td className="px-4 py-3 font-medium text-ink">
                  {svc.customer_name || '-'}
                </td>

                {/* Technician */}
                <td className="px-4 py-3 text-ink/70">
                  {svc.technician_name || <span className="text-ink/40 italic">Belum ditugaskan</span>}
                </td>

                {/* Scheduled / Time */}
                <td className="px-4 py-3 text-ink/70 text-[11px]">
                  {svc.completed_at ? (
                    <div>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">Selesai:</span>{' '}
                      {new Date(svc.completed_at).toLocaleDateString('id-ID')}
                    </div>
                  ) : svc.scheduled_at ? (
                    <div>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">Jadwal:</span>{' '}
                      {new Date(svc.scheduled_at).toLocaleDateString('id-ID')}
                    </div>
                  ) : (
                    <div>Dibuat: {new Date(svc.created_at).toLocaleDateString('id-ID')}</div>
                  )}
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Link
                      href={`/device-services/${svc.id}`}
                      className="inline-flex items-center gap-1 rounded-md p-1.5 text-ink/70 transition-colors hover:bg-ink/10 hover:text-ink"
                      title="Lihat Detail Work Order"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Link>

                    {canMutate && isPendingOrActive && (
                      <>
                        <button
                          type="button"
                          onClick={() => onUpdate(svc)}
                          className="inline-flex items-center rounded-md p-1.5 text-ink/70 transition-colors hover:bg-ink/10 hover:text-ink cursor-pointer"
                          title="Update Status / Teknisi"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onComplete(svc)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40 cursor-pointer"
                          title="Selesaikan Work Order"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Selesaikan</span>
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
