import React from 'react';
import { Plus, Search, Filter, Wrench } from 'lucide-react';
import { DeviceServiceFilterModel, DeviceServiceType, DeviceServiceStatus } from '../types';

interface DeviceServiceToolbarProps {
  filters: DeviceServiceFilterModel;
  onFilterChange: (patch: Partial<DeviceServiceFilterModel>) => void;
  canMutate: boolean;
  onOpenCreate: () => void;
}

export function DeviceServiceToolbar({
  filters,
  onFilterChange,
  canMutate,
  onOpenCreate,
}: DeviceServiceToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-surface p-4 shadow-sm dark:border-ink/20">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40" />
          <input
            type="text"
            placeholder="Cari nama teknisi, nomor tiket..."
            value={filters.technician_name ?? ''}
            onChange={(e) => onFilterChange({ technician_name: e.target.value || undefined, offset: 0 })}
            className="w-full rounded-lg border border-ink/15 bg-paper pl-10 pr-4 py-2 text-xs text-ink placeholder:text-ink/40 focus:border-pine focus:outline-none focus:ring-1 focus:ring-pine dark:border-ink/20 dark:bg-slate-900/60"
          />
        </div>

        {canMutate && (
          <button
            type="button"
            onClick={onOpenCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-pine px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-pine-deep cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Buat Work Order Baru</span>
          </button>
        )}
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-ink/5 dark:border-ink/10">
        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-ink/60 whitespace-nowrap">Status:</span>
          <select
            value={filters.status ?? ''}
            onChange={(e) => onFilterChange({ status: e.target.value || undefined, offset: 0 })}
            className="w-full rounded-lg border border-ink/15 bg-paper px-2.5 py-1.5 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
          >
            <option value="">Semua Status Work Order</option>
            <option value="PENDING">Menunggu (PENDING)</option>
            <option value="SCHEDULED">Dijadwalkan (SCHEDULED)</option>
            <option value="IN_PROGRESS">Sedang Dikerjakan (IN_PROGRESS)</option>
            <option value="COMPLETED">Selesai (COMPLETED)</option>
            <option value="CANCELLED">Dibatalkan (CANCELLED)</option>
          </select>
        </div>

        {/* Service Type Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-ink/60 whitespace-nowrap">Tipe Servis:</span>
          <select
            value={filters.service_type ?? ''}
            onChange={(e) => onFilterChange({ service_type: e.target.value || undefined, offset: 0 })}
            className="w-full rounded-lg border border-ink/15 bg-paper px-2.5 py-1.5 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
          >
            <option value="">Semua Tipe Servis</option>
            <option value="INSTALLATION">Pemasangan Baru (INSTALLATION)</option>
            <option value="MAINTENANCE">Pemeliharaan / Cek Rutin (MAINTENANCE)</option>
            <option value="REPAIR">Perbaikan / Trouble Ticket (REPAIR)</option>
            <option value="REPLACEMENT">Penggantian / RMA Swap (REPLACEMENT)</option>
            <option value="DECOMMISSION">Penarikan / Decommission (DECOMMISSION)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
