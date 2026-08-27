'use client';

import React from 'react';
import { Search } from 'lucide-react';

interface SuppliersToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filteredCount: number;
  totalCount: number;
}

export function SuppliersToolbar({
  search,
  onSearchChange,
  filteredCount,
  totalCount,
}: SuppliersToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-line bg-card p-3.5 shadow-sm">
      <div className="relative flex-1">
        <Search
          width={14}
          height={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog"
        />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Cari nama, kode, atau kategori…"
          className="h-9 w-full rounded-xl border border-line bg-paper/40 pl-9 pr-3 text-xs text-ink placeholder:text-fog/70 transition-all focus:border-pine focus:bg-card focus:outline-none focus:ring-1 focus:ring-pine/20"
        />
      </div>
      <div className="flex items-center justify-end px-1">
        <span className="num text-[12px] font-semibold text-fog">
          {search ? `Menampilkan ${filteredCount} dari ${totalCount} supplier` : `${totalCount} supplier`}
        </span>
      </div>
    </div>
  );
}
