import React from 'react';
import { Search, Plus, Layers, Filter } from 'lucide-react';
import { DeviceFilterModel, DeviceStatus, DeviceType, DeviceOwnershipType } from '../types';

interface DeviceToolbarProps {
  filters: DeviceFilterModel;
  onFilterChange: (patch: Partial<DeviceFilterModel>) => void;
  canMutate: boolean;
  onOpenRegisterSingle: () => void;
  onOpenRegisterBulk: () => void;
}

export function DeviceToolbar({
  filters,
  onFilterChange,
  canMutate,
  onOpenRegisterSingle,
  onOpenRegisterBulk,
}: DeviceToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-surface p-4 shadow-sm dark:border-ink/20">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40" />
          <input
            type="text"
            placeholder="Cari nomor seri, MAC address, atau catatan..."
            value={filters.search ?? ''}
            onChange={(e) => onFilterChange({ search: e.target.value, offset: 0 })}
            className="w-full rounded-lg border border-ink/15 bg-paper pl-10 pr-4 py-2 text-xs text-ink placeholder:text-ink/40 focus:border-pine focus:outline-none focus:ring-1 focus:ring-pine dark:border-ink/20 dark:bg-slate-900/60"
          />
        </div>

        {/* Action Buttons (OWNER and STAFF only) */}
        {canMutate && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenRegisterBulk}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink/20 bg-paper px-3 py-2 text-xs font-semibold text-ink shadow-sm transition-colors hover:bg-ink/5 dark:bg-slate-900/60 cursor-pointer"
            >
              <Layers className="h-3.5 w-3.5 text-ink/70" />
              <span>Input Bulk</span>
            </button>
            <button
              type="button"
              onClick={onOpenRegisterSingle}
              className="inline-flex items-center gap-1.5 rounded-lg bg-pine px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-pine-deep cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Registrasi Perangkat</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-ink/5 dark:border-ink/10">
        {/* Status filter */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-ink/60 whitespace-nowrap">Status:</span>
          <select
            value={filters.status ?? ''}
            onChange={(e) => onFilterChange({ status: e.target.value || undefined, offset: 0 })}
            className="w-full rounded-lg border border-ink/15 bg-paper px-2.5 py-1.5 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
          >
            <option value="">Semua Status</option>
            <option value="IN_STOCK">Tersedia di Gudang (IN_STOCK)</option>
            <option value="RESERVED">Dipesan (RESERVED)</option>
            <option value="INSTALLED">Terpasang di Pelanggan (INSTALLED)</option>
            <option value="IN_REPAIR">Dalam Perbaikan (IN_REPAIR)</option>
            <option value="DEFECTIVE">Rusak (DEFECTIVE)</option>
            <option value="RETURNED">Dikembalikan (RETURNED)</option>
            <option value="DECOMMISSIONED">Nonaktif (DECOMMISSIONED)</option>
          </select>
        </div>

        {/* Device Type filter */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-ink/60 whitespace-nowrap">Tipe:</span>
          <select
            value={filters.device_type ?? ''}
            onChange={(e) => onFilterChange({ device_type: e.target.value || undefined, offset: 0 })}
            className="w-full rounded-lg border border-ink/15 bg-paper px-2.5 py-1.5 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
          >
            <option value="">Semua Tipe Perangkat</option>
            <option value="ROUTER">Router / Gateway</option>
            <option value="ONT">ONT / GPON Modem</option>
            <option value="ACCESS_POINT">Access Point WiFi</option>
            <option value="POS_TERMINAL">POS Terminal</option>
            <option value="PRINTER">Thermal / Receipt Printer</option>
            <option value="SCANNER">Barcode Scanner</option>
            <option value="CASH_DRAWER">Cash Drawer</option>
            <option value="CCTV_CAMERA">Kamera CCTV</option>
            <option value="DVR_NVR">DVR / NVR Recorder</option>
            <option value="OTHER">Lainnya (Other)</option>
          </select>
        </div>

        {/* Ownership filter */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-ink/60 whitespace-nowrap">Kepemilikan:</span>
          <select
            value={filters.ownership_type ?? ''}
            onChange={(e) => onFilterChange({ ownership_type: e.target.value || undefined, offset: 0 })}
            className="w-full rounded-lg border border-ink/15 bg-paper px-2.5 py-1.5 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
          >
            <option value="">Semua Kepemilikan</option>
            <option value="TENANT_OWNED">Milik Usaha / Tenant (TENANT_OWNED)</option>
            <option value="CUSTOMER_OWNED">Milik Pelanggan (CUSTOMER_OWNED)</option>
            <option value="LEASED_RENTED">Sewa / Pinjam (LEASED_RENTED)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
