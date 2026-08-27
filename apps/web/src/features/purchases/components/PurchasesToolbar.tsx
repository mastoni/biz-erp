'use client';

import React from 'react';
import { Search } from 'lucide-react';

interface PurchasesToolbarProps {
  search: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  termFilter: string;
  onTermFilterChange: (val: string) => void;
  filteredCount: number;
}

export function PurchasesToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  termFilter,
  onTermFilterChange,
  filteredCount,
}: PurchasesToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card p-3.5 shadow-xs">
      {/* Search Input */}
      <div className="relative min-w-[220px] flex-1">
        <Search
          width={15}
          height={15}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fog"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Cari no. PO atau supplier…"
          className="h-10 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-fog/70 focus:border-pine focus:ring-1 focus:ring-pine"
        />
      </div>

      {/* Status Filter */}
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        aria-label="Filter status pembelian"
        className="h-10 rounded-xl border border-line bg-surface px-3 text-xs font-medium text-ink outline-none transition focus:border-pine focus:ring-1 focus:ring-pine"
      >
        {['Semua', 'Draft', 'Dikirim', 'Parsial', 'Diterima', 'Dibatalkan'].map((s) => (
          <option key={s} value={s}>
            {s === 'Semua' ? 'Semua Status' : s}
          </option>
        ))}
      </select>

      {/* Term Filter */}
      <select
        value={termFilter}
        onChange={(e) => onTermFilterChange(e.target.value)}
        aria-label="Filter termin supplier"
        className="h-10 rounded-xl border border-line bg-surface px-3 text-xs font-medium text-ink outline-none transition focus:border-pine focus:ring-1 focus:ring-pine"
      >
        <option value="Semua">Semua Termin</option>
        <option value="Tunai">Tunai</option>
        <option value="Tempo 14">Tempo 14 Hari</option>
        <option value="Tempo 30">Tempo 30 Hari</option>
      </select>

      {/* Counter */}
      <span className="num ml-auto text-xs font-bold text-fog">
        {`${filteredCount} PO`}
      </span>
    </div>
  );
}
