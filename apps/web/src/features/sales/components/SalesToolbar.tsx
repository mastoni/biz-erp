'use client';

import React from 'react';
import { Receipt, Search } from 'lucide-react';
import type { SalesPaymentMethodFilter } from '../types';

interface SalesToolbarProps {
  search: string;
  onSearchChange: (q: string) => void;
  paymentMethod: SalesPaymentMethodFilter;
  onPaymentMethodChange: (m: SalesPaymentMethodFilter) => void;
  disabled?: boolean;
}

export function SalesToolbar({
  search,
  onSearchChange,
  paymentMethod,
  onPaymentMethodChange,
  disabled = false,
}: SalesToolbarProps) {
  const methods: SalesPaymentMethodFilter[] = ['Semua', 'Tunai', 'QRIS', 'Debit'];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 bg-card" data-testid="sales-toolbar">
      <div className="flex items-center gap-2">
        <Receipt className="h-4 w-4 text-pine" />
        <h3 className="font-display text-[16px] font-bold text-ink">Log Transaksi Hari Ini</h3>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-fog" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari struk / kasir…"
            disabled={disabled}
            data-testid="sales-search-input"
            className="input w-48 py-1.5 pl-8 text-[12.5px] rounded-lg border border-line bg-surface text-ink placeholder:text-fog focus:outline-none focus:ring-1 focus:ring-pine"
          />
        </div>

        <div className="flex gap-1" data-testid="sales-payment-filters">
          {methods.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onPaymentMethodChange(m)}
              disabled={disabled}
              data-testid={"filter-method-" + m.toLowerCase()}
              className={"rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition-all cursor-pointer " + (paymentMethod === m ? 'border-pine bg-pine text-[#f2efe2]' : 'border-line bg-surface text-fog hover:text-ink')}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
