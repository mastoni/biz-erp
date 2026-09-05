import React from 'react';
import { DeviceStatus, DeviceServiceStatus } from '../types';

export function DeviceStatusPill({ status }: { status: DeviceStatus }) {
  const config: Record<DeviceStatus, { label: string; className: string }> = {
    IN_STOCK: {
      label: 'Tersedia di Gudang',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40',
    },
    RESERVED: {
      label: 'Dipesan (Reserved)',
      className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/40',
    },
    INSTALLED: {
      label: 'Terpasang di Pelanggan',
      className: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800/40',
    },
    IN_REPAIR: {
      label: 'Dalam Perbaikan',
      className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40',
    },
    DEFECTIVE: {
      label: 'Rusak (Defective)',
      className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40',
    },
    RETURNED: {
      label: 'Dikembalikan',
      className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/40',
    },
    DECOMMISSIONED: {
      label: 'Nonaktif (Decommissioned)',
      className: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/60 dark:text-slate-400 dark:border-slate-800',
    },
  };

  const item = config[status] || { label: status, className: 'bg-gray-100 text-gray-700 border-gray-200' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${item.className}`}>
      {item.label}
    </span>
  );
}

export function DeviceServiceStatusPill({ status }: { status: DeviceServiceStatus }) {
  const config: Record<DeviceServiceStatus, { label: string; className: string }> = {
    PENDING: {
      label: 'Menunggu (Pending)',
      className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800',
    },
    SCHEDULED: {
      label: 'Dijadwalkan',
      className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/40',
    },
    IN_PROGRESS: {
      label: 'Sedang Dikerjakan',
      className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40',
    },
    COMPLETED: {
      label: 'Selesai (Completed)',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40',
    },
    CANCELLED: {
      label: 'Dibatalkan',
      className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40',
    },
  };

  const item = config[status] || { label: status, className: 'bg-gray-100 text-gray-700 border-gray-200' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${item.className}`}>
      {item.label}
    </span>
  );
}
