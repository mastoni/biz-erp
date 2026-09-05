import React from 'react';
import Link from 'next/link';
import { Eye, UserCheck, RotateCcw, Edit2, HardDrive } from 'lucide-react';
import { DeviceDto } from '../types';
import { DeviceStatusPill } from './DeviceStatusPill';

interface DeviceTableProps {
  devices: DeviceDto[];
  isLoading: boolean;
  canMutate: boolean;
  onAssign: (device: DeviceDto) => void;
  onUnassign: (device: DeviceDto) => void;
  onEdit: (device: DeviceDto) => void;
}

export function DeviceTable({
  devices,
  isLoading,
  canMutate,
  onAssign,
  onUnassign,
  onEdit,
}: DeviceTableProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-ink/10 bg-surface p-12 text-center dark:border-ink/20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-pine/20 border-t-pine" />
        <p className="mt-3 text-xs text-ink/60">Memuat daftar perangkat hardware...</p>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink/15 bg-surface p-12 text-center dark:border-ink/20">
        <div className="rounded-full bg-ink/5 p-3 dark:bg-ink/10">
          <HardDrive className="h-6 w-6 text-ink/40" />
        </div>
        <h3 className="mt-3 font-display text-sm font-bold text-ink">Tidak ada perangkat ditemukan</h3>
        <p className="mt-1 max-w-sm text-xs text-ink/60">
          Tidak ada data hardware yang sesuai dengan filter pencarian Anda.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm dark:border-ink/20">
      <table className="w-full text-left text-xs text-ink">
        <thead className="border-b border-ink/10 bg-ink/[0.02] text-[11px] font-semibold text-ink/60 uppercase tracking-wider dark:border-ink/20 dark:bg-ink/[0.05]">
          <tr>
            <th className="px-4 py-3">Serial & MAC</th>
            <th className="px-4 py-3">Produk / Model</th>
            <th className="px-4 py-3">Tipe</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Kepemilikan</th>
            <th className="px-4 py-3">Pelanggan Terpasang</th>
            <th className="px-4 py-3">Cabang</th>
            <th className="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/5 dark:divide-ink/10">
          {devices.map((device) => {
            const isAssignable = device.status === 'IN_STOCK' || device.status === 'RESERVED';
            const isUnassignable = device.status === 'INSTALLED';

            return (
              <tr key={device.id} className="transition-colors hover:bg-ink/[0.02] dark:hover:bg-ink/[0.04]">
                {/* Serial & MAC */}
                <td className="px-4 py-3">
                  <div className="font-mono font-bold text-xs text-ink">{device.serial_number}</div>
                  {device.mac_address && (
                    <div className="font-mono text-[10px] text-ink/50">{device.mac_address}</div>
                  )}
                </td>

                {/* Product / Model */}
                <td className="px-4 py-3">
                  <span className="font-medium text-ink">{device.product_name || 'Katalog Umum'}</span>
                </td>

                {/* Type */}
                <td className="px-4 py-3">
                  <span className="inline-block rounded bg-ink/5 px-2 py-0.5 text-[11px] font-medium text-ink/70 dark:bg-ink/15">
                    {device.device_type}
                  </span>
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <DeviceStatusPill status={device.status} />
                </td>

                {/* Ownership */}
                <td className="px-4 py-3">
                  <span className="text-[11px] text-ink/70">
                    {device.ownership_type === 'TENANT_OWNED'
                      ? 'Milik Usaha'
                      : device.ownership_type === 'CUSTOMER_OWNED'
                      ? 'Milik Pelanggan'
                      : 'Sewa/Pinjam'}
                  </span>
                </td>

                {/* Customer */}
                <td className="px-4 py-3">
                  {device.customer_name ? (
                    <div>
                      <div className="font-semibold text-pine dark:text-emerald-400">{device.customer_name}</div>
                      {device.installed_address && (
                        <div className="text-[10px] text-ink/50 truncate max-w-[160px]">
                          {device.installed_address}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-ink/40 italic">-</span>
                  )}
                </td>

                {/* Branch */}
                <td className="px-4 py-3 text-ink/70">
                  {device.branch_name || 'Utama'}
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {/* View Detail Link */}
                    <Link
                      href={`/devices/${device.id}`}
                      className="inline-flex items-center gap-1 rounded-md p-1.5 text-ink/70 transition-colors hover:bg-ink/10 hover:text-ink"
                      title="Lihat Detail"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Link>

                    {/* Operational mutation controls for OWNER and STAFF */}
                    {canMutate && (
                      <>
                        {isAssignable && (
                          <button
                            type="button"
                            onClick={() => onAssign(device)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 bg-teal-50 text-teal-700 text-[11px] font-semibold border border-teal-200 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800/40 cursor-pointer"
                            title="Pasang ke Pelanggan"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>Pasang</span>
                          </button>
                        )}

                        {isUnassignable && (
                          <button
                            type="button"
                            onClick={() => onUnassign(device)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 bg-amber-50 text-amber-700 text-[11px] font-semibold border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40 cursor-pointer"
                            title="Tarik Perangkat (Unassign)"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Tarik</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onEdit(device)}
                          className="inline-flex items-center rounded-md p-1.5 text-ink/70 transition-colors hover:bg-ink/10 hover:text-ink cursor-pointer"
                          title="Ubah Data Perangkat"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
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
