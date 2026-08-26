'use client';

import React from 'react';
import { POSCartLineViewModel } from '../types';
import { idr } from '../pos-helpers';

export interface POSCartLineProps {
  line: POSCartLineViewModel;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onRemove: (productId: string) => void;
}

export function POSCartLine({
  line,
  onIncrement,
  onDecrement,
  onRemove,
}: POSCartLineProps) {
  const isMaxStock = line.quantity >= line.quantity_available;

  return (
    <li className="row-in rounded-lg border border-line bg-paper/50 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold text-ink">{line.product_name}</p>
          <p className="num text-[10.5px] text-fog">{idr(line.unit_price_minor)} / item</p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(line.product_id)}
          className="rounded p-1 text-fog transition hover:bg-clay-soft hover:text-clay cursor-pointer"
          aria-label="Hapus item"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center rounded-md border border-line bg-surface">
          <button
            type="button"
            onClick={() => onDecrement(line.product_id)}
            disabled={line.quantity <= 1}
            className="px-2 py-1 text-fog transition hover:text-pine disabled:opacity-30 cursor-pointer"
            aria-label="Kurangi"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </button>
          <span className="num w-8 text-center text-[13px] font-bold text-ink">{line.quantity}</span>
          <button
            type="button"
            onClick={() => onIncrement(line.product_id)}
            disabled={isMaxStock}
            className="px-2 py-1 text-fog transition hover:text-pine disabled:opacity-30 cursor-pointer"
            aria-label="Tambah"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <span className="num text-[13px] font-bold text-ink">{idr(line.line_subtotal_minor)}</span>
      </div>
    </li>
  );
}
