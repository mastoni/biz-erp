'use client';

import React from 'react';
import { POSParkedOrder } from '../types';

export interface POSParkedOrdersProps {
  parkedOrders: POSParkedOrder[];
  onRestore: (order: POSParkedOrder) => void;
  onDelete: (transactionId: string) => void;
}

export function POSParkedOrders({
  parkedOrders,
  onRestore,
  onDelete,
}: POSParkedOrdersProps) {
  if (parkedOrders.length === 0) return null;

  return (
    <div className="border-b border-line bg-honey-soft/40 px-4 py-2.5">
      <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#8a5f10]">
        Disimpan ({parkedOrders.length})
      </p>
      <div className="flex flex-wrap gap-1.5">
        {parkedOrders.map((pk) => (
          <span
            key={pk.transaction_id}
            className="inline-flex items-center gap-1.5 rounded-md border border-honey/50 bg-surface px-2 py-1 text-[11.5px] font-semibold"
          >
            <svg className="h-3 w-3 text-honey" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            <button
              type="button"
              onClick={() => onRestore(pk)}
              className="hover:text-pine cursor-pointer text-ink font-semibold"
            >
              {pk.customer_name} · {pk.item_count} item · {pk.saved_at}
            </button>
            <button
              type="button"
              onClick={() => onDelete(pk.transaction_id)}
              className="text-fog hover:text-clay cursor-pointer ml-1"
              aria-label="Hapus pesanan tersimpan"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
