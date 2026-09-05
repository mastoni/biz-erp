import React from 'react';
import Link from 'next/link';
import {
  Wrench,
  HardDrive,
  User,
  MapPin,
  Clock,
  CheckCircle2,
  Edit2,
  ArrowLeft,
  RotateCw,
  FileText,
} from 'lucide-react';
import { DeviceServiceDetailDto } from '../types';
import { DeviceServiceStatusPill } from './DeviceStatusPill';

interface DeviceServiceDetailViewProps {
  service: DeviceServiceDetailDto;
  canMutate: boolean;
  onUpdate: () => void;
  onComplete: () => void;
}

export function DeviceServiceDetailView({
  service,
  canMutate,
  onUpdate,
  onComplete,
}: DeviceServiceDetailViewProps) {
  const isPendingOrActive = service.status !== 'COMPLETED' && service.status !== 'CANCELLED';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/device-services"
            className="rounded-xl border border-ink/15 bg-paper p-2.5 text-ink/70 hover:bg-ink/5 hover:text-ink transition-colors dark:border-ink/20 dark:bg-slate-900/60"
            title="Kembali ke Daftar Layanan Servis"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
                Work Order: {service.service_type}
              </h1>
              <DeviceServiceStatusPill status={service.status} />
            </div>
            <p className="text-xs text-ink/60 mt-0.5 font-mono">
              ID: {service.id} • Dibuat:{' '}
              {new Date(service.created_at).toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        {/* Action Controls for OWNER/STAFF */}
        {canMutate && isPendingOrActive && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onUpdate}
              className="inline-flex items-center gap-1.5 rounded-xl border border-ink/20 bg-paper px-3.5 py-2 text-xs font-semibold text-ink hover:bg-ink/5 dark:bg-slate-900/60 cursor-pointer"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>Update Data / Status</span>
            </button>

            <button
              type="button"
              onClick={onComplete}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Selesaikan Work Order</span>
            </button>
          </div>
        )}
      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Target Device & Replacement Info */}
        <div className="rounded-xl border border-ink/10 bg-surface p-5 shadow-sm space-y-3 dark:border-ink/20">
          <div className="flex items-center gap-2 border-b border-ink/5 pb-2.5 dark:border-ink/10">
            <HardDrive className="h-4 w-4 text-pine dark:text-emerald-400" />
            <h2 className="font-display text-sm font-bold text-ink">Informasi Hardware</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-ink/50 text-[11px] block">Perangkat Target:</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono font-bold text-ink text-sm">
                  {service.device_serial || 'Hardware'}
                </span>
                <span className="rounded bg-ink/5 px-2 py-0.5 text-[10px] font-medium text-ink/70">
                  {service.device_type}
                </span>
                <Link
                  href={`/devices/${service.device_id}`}
                  className="text-[11px] font-semibold text-pine hover:underline dark:text-emerald-400 ml-1"
                >
                  Lihat Aset →
                </Link>
              </div>
            </div>

            {service.replacement_device_id && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-300">
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>Perangkat Pengganti (RMA Unit):</span>
                </div>
                <div className="font-mono font-bold text-ink text-xs mt-1">
                  {service.replacement_serial || service.replacement_device_id}
                </div>
                <Link
                  href={`/devices/${service.replacement_device_id}`}
                  className="text-[11px] font-semibold text-pine hover:underline dark:text-emerald-400 mt-1 inline-block"
                >
                  Lihat Unit Pengganti →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Customer & Technician */}
        <div className="rounded-xl border border-ink/10 bg-surface p-5 shadow-sm space-y-3 dark:border-ink/20">
          <div className="flex items-center gap-2 border-b border-ink/5 pb-2.5 dark:border-ink/10">
            <User className="h-4 w-4 text-pine dark:text-emerald-400" />
            <h2 className="font-display text-sm font-bold text-ink">Pelanggan & Teknisi</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-ink/50 text-[11px] block">Pelanggan:</span>
              <span className="font-bold text-ink text-sm">
                {service.customer_name || '-'}
              </span>
              {service.customer_phone && (
                <span className="text-[11px] text-ink/60 block">{service.customer_phone}</span>
              )}
            </div>

            <div>
              <span className="text-ink/50 text-[11px] block">Teknisi Penanggung Jawab:</span>
              <span className="font-semibold text-ink text-sm">
                {service.technician_name || 'Belum Ditugaskan'}
              </span>
            </div>

            <div>
              <span className="text-ink/50 text-[11px] block">Jadwal Pelaksanaan:</span>
              <span className="font-medium text-ink">
                {service.scheduled_at
                  ? new Date(service.scheduled_at).toLocaleString('id-ID')
                  : 'Belum dijadwalkan'}
              </span>
            </div>

            <div>
              <span className="text-ink/50 text-[11px] block">Waktu Selesai:</span>
              <span className="font-medium text-ink">
                {service.completed_at
                  ? new Date(service.completed_at).toLocaleString('id-ID')
                  : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Findings & Action Taken */}
        <div className="rounded-xl border border-ink/10 bg-surface p-5 shadow-sm space-y-3 dark:border-ink/20 md:col-span-2">
          <div className="flex items-center gap-2 border-b border-ink/5 pb-2.5 dark:border-ink/10">
            <FileText className="h-4 w-4 text-pine dark:text-emerald-400" />
            <h2 className="font-display text-sm font-bold text-ink">Catatan Diagnosa & Tindakan Teknis</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="rounded-lg bg-ink/[0.02] p-3.5 dark:bg-ink/[0.04]">
              <span className="font-bold text-ink block text-[11px] mb-1">Hasil Temuan / Gejala:</span>
              <p className="text-ink/80 whitespace-pre-wrap leading-relaxed">
                {service.findings || 'Tidak ada catatan temuan.'}
              </p>
            </div>

            <div className="rounded-lg bg-ink/[0.02] p-3.5 dark:bg-ink/[0.04]">
              <span className="font-bold text-ink block text-[11px] mb-1">Tindakan Penanganan:</span>
              <p className="text-ink/80 whitespace-pre-wrap leading-relaxed">
                {service.action_taken || 'Belum ada tindakan yang dicatat.'}
              </p>
            </div>
          </div>

          {service.notes && (
            <div className="text-xs text-ink/70 pt-2 border-t border-ink/5 dark:border-ink/10">
              <span className="font-semibold">Catatan Tambahan:</span> {service.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
