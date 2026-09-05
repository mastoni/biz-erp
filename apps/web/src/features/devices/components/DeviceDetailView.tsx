import React from 'react';
import Link from 'next/link';
import {
  HardDrive,
  UserCheck,
  RotateCcw,
  Wrench,
  Edit2,
  Calendar,
  ShieldCheck,
  MapPin,
  Package,
  Layers,
  Clock,
  ArrowLeft,
} from 'lucide-react';
import { DeviceDetailDto } from '../types';
import { DeviceStatusPill, DeviceServiceStatusPill } from './DeviceStatusPill';

interface DeviceDetailViewProps {
  device: DeviceDetailDto;
  canMutate: boolean;
  onAssign: () => void;
  onUnassign: () => void;
  onEdit: () => void;
  onCreateService: () => void;
}

export function DeviceDetailView({
  device,
  canMutate,
  onAssign,
  onUnassign,
  onEdit,
  onCreateService,
}: DeviceDetailViewProps) {
  const isAssignable = device.status === 'IN_STOCK' || device.status === 'RESERVED';
  const isUnassignable = device.status === 'INSTALLED';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/devices"
            className="rounded-xl border border-ink/15 bg-paper p-2.5 text-ink/70 hover:bg-ink/5 hover:text-ink transition-colors dark:border-ink/20 dark:bg-slate-900/60"
            title="Kembali ke Daftar Perangkat"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink font-mono">
                {device.serial_number}
              </h1>
              <DeviceStatusPill status={device.status} />
            </div>
            <p className="text-xs text-ink/60 mt-0.5">
              Tipe: <span className="font-semibold text-ink">{device.device_type}</span> • Cabang:{' '}
              <span className="font-semibold text-ink">{device.branch_name || 'Utama'}</span>
            </p>
          </div>
        </div>

        {/* Action Controls for OWNER/STAFF */}
        {canMutate && (
          <div className="flex items-center gap-2 flex-wrap">
            {isAssignable && (
              <button
                type="button"
                onClick={onAssign}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-700 cursor-pointer"
              >
                <UserCheck className="h-4 w-4" />
                <span>Pasang ke Pelanggan</span>
              </button>
            )}

            {isUnassignable && (
              <button
                type="button"
                onClick={onUnassign}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Tarik Perangkat</span>
              </button>
            )}

            <button
              type="button"
              onClick={onCreateService}
              className="inline-flex items-center gap-1.5 rounded-xl border border-ink/20 bg-paper px-3.5 py-2 text-xs font-bold text-ink shadow-sm hover:bg-ink/5 dark:bg-slate-900/60 cursor-pointer"
            >
              <Wrench className="h-4 w-4 text-pine dark:text-emerald-400" />
              <span>Buat Tiket Servis</span>
            </button>

            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-xl border border-ink/20 bg-paper px-3 py-2 text-xs font-semibold text-ink hover:bg-ink/5 dark:bg-slate-900/60 cursor-pointer"
              title="Edit Data"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Grid of Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Identity & Technical Info */}
        <div className="rounded-xl border border-ink/10 bg-surface p-5 shadow-sm space-y-3 dark:border-ink/20">
          <div className="flex items-center gap-2 border-b border-ink/5 pb-2.5 dark:border-ink/10">
            <HardDrive className="h-4 w-4 text-pine dark:text-emerald-400" />
            <h2 className="font-display text-sm font-bold text-ink">Identitas Hardware</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-ink/50 text-[11px] block">Nomor Seri:</span>
              <span className="font-mono font-bold text-ink text-sm">{device.serial_number}</span>
            </div>
            <div>
              <span className="text-ink/50 text-[11px] block">MAC Address:</span>
              <span className="font-mono text-ink">{device.mac_address || '-'}</span>
            </div>
            <div>
              <span className="text-ink/50 text-[11px] block">Tipe Perangkat:</span>
              <span className="font-semibold text-ink">{device.device_type}</span>
            </div>
            <div>
              <span className="text-ink/50 text-[11px] block">Kepemilikan:</span>
              <span className="font-semibold text-ink">
                {device.ownership_type === 'TENANT_OWNED'
                  ? 'Milik Usaha / Tenant'
                  : device.ownership_type === 'CUSTOMER_OWNED'
                  ? 'Milik Pelanggan'
                  : 'Sewa / Pinjam (Leased)'}
              </span>
            </div>
          </div>

          {device.notes && (
            <div className="mt-2 rounded-lg bg-ink/[0.02] p-2.5 text-xs text-ink/70 dark:bg-ink/[0.05]">
              <span className="font-bold text-ink/80 block text-[11px]">Catatan:</span>
              {device.notes}
            </div>
          )}
        </div>

        {/* Product Catalog & Warranty */}
        <div className="rounded-xl border border-ink/10 bg-surface p-5 shadow-sm space-y-3 dark:border-ink/20">
          <div className="flex items-center gap-2 border-b border-ink/5 pb-2.5 dark:border-ink/10">
            <Package className="h-4 w-4 text-pine dark:text-emerald-400" />
            <h2 className="font-display text-sm font-bold text-ink">Produk & Garansi</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-ink/50 text-[11px] block">Model Katalog Produk:</span>
              <span className="font-semibold text-ink">{device.product_name || 'Tanpa Relasi Produk'}</span>
            </div>
            <div>
              <span className="text-ink/50 text-[11px] block">Cabang Gudang:</span>
              <span className="font-semibold text-ink">{device.branch_name || 'Utama'}</span>
            </div>
            <div>
              <span className="text-ink/50 text-[11px] block">Durasi Garansi:</span>
              <span className="font-semibold text-ink">
                {device.warranty_months !== null ? `${device.warranty_months} Bulan` : '-'}
              </span>
            </div>
            <div>
              <span className="text-ink/50 text-[11px] block">Kadaluarsa Garansi:</span>
              <span className="font-semibold text-ink">
                {device.warranty_expires_at
                  ? new Date(device.warranty_expires_at).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Installation & Customer Info */}
        <div className="rounded-xl border border-ink/10 bg-surface p-5 shadow-sm space-y-3 dark:border-ink/20 md:col-span-2">
          <div className="flex items-center gap-2 border-b border-ink/5 pb-2.5 dark:border-ink/10">
            <MapPin className="h-4 w-4 text-pine dark:text-emerald-400" />
            <h2 className="font-display text-sm font-bold text-ink">Status Instalasi & Pelanggan</h2>
          </div>

          {device.customer_id ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-ink/50 text-[11px] block">Pelanggan Terpasang:</span>
                <span className="font-bold text-pine text-sm dark:text-emerald-400">
                  {device.customer_name || 'Pelanggan'}
                </span>
                {device.customer_phone && (
                  <span className="text-[11px] text-ink/60 block">{device.customer_phone}</span>
                )}
              </div>
              <div>
                <span className="text-ink/50 text-[11px] block">Waktu Terpasang:</span>
                <span className="font-semibold text-ink">
                  {device.installed_at
                    ? new Date(device.installed_at).toLocaleString('id-ID')
                    : '-'}
                </span>
              </div>
              <div>
                <span className="text-ink/50 text-[11px] block">Alamat Pemasangan:</span>
                <span className="text-ink font-medium">{device.installed_address || '-'}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-ink/[0.02] p-4 text-center text-xs text-ink/60 dark:bg-ink/[0.04]">
              Perangkat saat ini tidak terpasang di pelanggan manapun (berada di gudang/stok).
            </div>
          )}
        </div>
      </div>

      {/* Service / Work Order History */}
      <div className="rounded-xl border border-ink/10 bg-surface p-5 shadow-sm space-y-4 dark:border-ink/20">
        <div className="flex items-center justify-between border-b border-ink/5 pb-3 dark:border-ink/10">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-pine dark:text-emerald-400" />
            <h2 className="font-display text-sm font-bold text-ink">Riwayat Tiket Servis & Work Order</h2>
          </div>
          <span className="text-xs text-ink/50">
            {device.services?.length ?? 0} catatan
          </span>
        </div>

        {!device.services || device.services.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink/50">
            Belum ada riwayat layanan servis atau work order untuk perangkat ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-ink">
              <thead className="border-b border-ink/10 bg-ink/[0.02] text-[11px] font-semibold text-ink/60 uppercase dark:border-ink/20 dark:bg-ink/[0.05]">
                <tr>
                  <th className="px-3 py-2.5">Tipe Servis</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Teknisi</th>
                  <th className="px-3 py-2.5">Jadwal / Selesai</th>
                  <th className="px-3 py-2.5">Temuan & Tindakan</th>
                  <th className="px-3 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5 dark:divide-ink/10">
                {device.services.map((svc) => (
                  <tr key={svc.id} className="hover:bg-ink/[0.02] dark:hover:bg-ink/[0.04]">
                    <td className="px-3 py-2.5 font-semibold text-ink">{svc.service_type}</td>
                    <td className="px-3 py-2.5">
                      <DeviceServiceStatusPill status={svc.status} />
                    </td>
                    <td className="px-3 py-2.5 text-ink/70">{svc.technician_name || '-'}</td>
                    <td className="px-3 py-2.5 text-ink/70">
                      {svc.completed_at
                        ? `Selesai: ${new Date(svc.completed_at).toLocaleDateString('id-ID')}`
                        : svc.scheduled_at
                        ? `Jadwal: ${new Date(svc.scheduled_at).toLocaleDateString('id-ID')}`
                        : new Date(svc.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-3 py-2.5 max-w-xs">
                      {svc.findings && (
                        <div className="text-[11px] text-ink/60 truncate">
                          <span className="font-semibold">Temuan:</span> {svc.findings}
                        </div>
                      )}
                      {svc.action_taken && (
                        <div className="text-[11px] text-ink/80 truncate">
                          <span className="font-semibold">Tindakan:</span> {svc.action_taken}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link
                        href={`/device-services/${svc.id}`}
                        className="inline-flex items-center text-xs font-semibold text-pine hover:underline dark:text-emerald-400"
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
