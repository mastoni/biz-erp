'use client';

import React from 'react';
import { idrShort } from '../pos-helpers';
import { POSDailyCounter } from '../types';

export interface POSSectionHeadProps {
  cashierName: string;
  dailyCounter: POSDailyCounter;
  onClear: () => void;
  isClearDisabled: boolean;
}

export function POSSectionHead({
  cashierName,
  dailyCounter,
  onClear,
  isClearDisabled,
}: POSSectionHeadProps) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 border-b border-line pb-4 sm:flex-row sm:items-center">
      <div>
        <h1 className="font-display text-[26px] font-bold tracking-tight text-ink">Kasir</h1>
        <p className="text-[13px] text-fog">
          Klik produk untuk menambah ke keranjang · Shift {cashierName}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-pine/30 bg-pine-soft px-3 py-1.5 text-[12px] font-bold text-pine shadow-xs">
          Hari ini: {dailyCounter.total_sales} trx · {idrShort(dailyCounter.total_revenue_minor)}
        </span>
        <button
          type="button"
          onClick={onClear}
          disabled={isClearDisabled}
          className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Bersihkan
        </button>
      </div>
    </div>
  );
}
