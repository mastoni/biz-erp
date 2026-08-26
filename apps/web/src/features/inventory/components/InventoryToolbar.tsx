'use client';

import { Search } from '@/components/ui/search';
import { RefreshCw, PackagePlus, PackageMinus, SlidersHorizontal } from 'lucide-react';
import type { InventoryFilterModel, InventoryStockStatusFilter } from '../types';

interface InventoryToolbarProps {
  filter: InventoryFilterModel;
  onFilterChange: (filter: InventoryFilterModel) => void;
  categories: string[];
  resultCount: number;
  onRefresh: () => void;
  onStockIn: () => void;
  onStockOut: () => void;
  onAdjust: () => void;
  canMutate: boolean;
  disabled: boolean;
}

const STATUS_OPTIONS: Array<{ value: '' | InventoryStockStatusFilter; label: string }> = [
  { value: '', label: 'Semua Status' },
  { value: 'in_stock', label: 'Normal' },
  { value: 'low_stock', label: 'Menipis' },
  { value: 'out_of_stock', label: 'Habis' },
];

export function InventoryToolbar({
  filter,
  onFilterChange,
  categories,
  resultCount,
  onRefresh,
  onStockIn,
  onStockOut,
  onAdjust,
  canMutate,
  disabled,
}: InventoryToolbarProps) {
  return (
    <div className="card flex flex-wrap items-center gap-2.5 p-3.5">
      <div className="relative min-w-[200px] flex-1">
        <Search
          value={filter.search ?? ''}
          onChange={(e) => onFilterChange({ ...filter, search: e.target.value })}
          onClear={() => onFilterChange({ ...filter, search: '' })}
          placeholder="Cari nama atau SKU…"
        />
      </div>

      <select
        aria-label="Filter kategori"
        value={filter.category ?? ''}
        onChange={(e) => onFilterChange({ ...filter, category: e.target.value })}
        className="input w-auto py-2 text-[13px]"
      >
        <option value="">Semua Kategori</option>
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select
        aria-label="Filter status stok"
        value={filter.status ?? ''}
        onChange={(e) =>
          onFilterChange({ ...filter, status: (e.target.value || undefined) as InventoryFilterModel['status'] })
        }
        className="input w-auto py-2 text-[13px]"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s.label} value={s.value}>{s.label}</option>
        ))}
      </select>

      <button
        type="button"
        onClick={onRefresh}
        disabled={disabled}
        aria-label="Muat ulang stok"
        title="Muat ulang"
        className="btn-outline px-2.5 py-2 text-[12px] disabled:opacity-50"
      >
        <RefreshCw width={14} height={14} />
      </button>

      {canMutate && (
        <>
          <span className="hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
          <button
            type="button"
            onClick={onStockIn}
            disabled={disabled}
            className="btn-outline px-3 py-2 text-[12px] text-pine disabled:opacity-50"
          >
            <PackagePlus width={14} height={14} /> Stok Masuk
          </button>
          <button
            type="button"
            onClick={onStockOut}
            disabled={disabled}
            className="btn-outline px-3 py-2 text-[12px] text-clay disabled:opacity-50"
          >
            <PackageMinus width={14} height={14} /> Stok Keluar
          </button>
          <button
            type="button"
            onClick={onAdjust}
            disabled={disabled}
            className="btn-primary px-3 py-2 text-[12px] disabled:opacity-50"
          >
            <SlidersHorizontal width={14} height={14} /> Atur Stok
          </button>
        </>
      )}

      <span className="num ml-auto text-[12px] font-semibold text-fog">{resultCount} item</span>
    </div>
  );
}
