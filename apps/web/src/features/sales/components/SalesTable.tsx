'use client';

import React, { Fragment, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMinor } from '@/lib/format';
import { METHOD_COLORS } from '../sales-helpers';
import { ReceiptAccordion } from './ReceiptAccordion';
import type { SalesTransactionViewModel } from '../types';

interface SalesTableProps {
  transactions: SalesTransactionViewModel[];
  isLoading: boolean;
}

export function SalesTable({ transactions, isLoading }: SalesTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="overflow-x-auto p-4" data-testid="sales-table-loading">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="overflow-x-auto" data-testid="sales-table-container">
      <table className="w-full min-w-[760px] text-left border-collapse" data-testid="sales-table">
        <thead>
          <tr className="bg-paper/60 border-b border-line text-[11px] font-bold uppercase tracking-wider text-fog">
            <th className="py-3 pl-4 pr-1 w-8"></th>
            <th className="py-3 px-3">No. Struk</th>
            <th className="py-3 px-3">Waktu</th>
            <th className="py-3 px-3">Kasir</th>
            <th className="py-3 px-3 text-center">Item</th>
            <th className="py-3 px-3">Metode</th>
            <th className="py-3 px-3 text-right">Total</th>
            <th className="py-3 px-4 text-center w-24">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {transactions.map((s) => {
            const isOpen = expandedId === s.id;
            return (
              <Fragment key={s.id}>
                <tr
                  onClick={() => toggleExpand(s.id)}
                  data-testid={"transaction-row-" + s.id}
                  className={"cursor-pointer transition-colors hover:bg-paper/60 " + (isOpen ? 'bg-paper/60' : '') + " " + (s.fresh ? 'bg-pine-soft/30' : '')}
                >
                  <td className="py-3 pl-4 pr-1">
                    <ChevronDown
                      className={"h-3.5 w-3.5 text-fog transition-transform duration-200 " + (isOpen ? 'rotate-180 text-pine' : '')}
                      data-testid={"chevron-" + s.id}
                    />
                  </td>
                  <td className="py-3 px-3">
                    <span className="num text-[12.5px] font-bold text-ink">{s.receipt_number}</span>
                    {s.fresh && (
                      <Badge variant="pine" size="sm" className="ml-2 py-0 px-1.5 text-[10px]">
                        baru
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 px-3 num text-[12.5px] text-fog">{s.time}</td>
                  <td className="py-3 px-3 text-[13px] text-ink">{s.cashier}</td>
                  <td className="py-3 px-3 num text-center text-ink">{s.items_count}</td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: METHOD_COLORS[s.canonical_method] }}
                      />
                      {s.canonical_method}
                    </span>
                  </td>
                  <td className="py-3 px-3 num text-right font-bold text-ink">
                    {formatMinor(s.total_minor)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant={s.status === 'selesai' ? 'pine' : 'clay'}>
                      {s.status === 'selesai' ? 'Selesai' : 'Refund'}
                    </Badge>
                  </td>
                </tr>

                {isOpen && (
                  <tr className="bg-paper/40" data-testid={"expanded-row-" + s.id}>
                    <td colSpan={8} className="px-6 pb-5 pt-1">
                      <ReceiptAccordion transaction={s} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {transactions.length === 0 && (
        <p className="px-5 py-10 text-center text-sm text-fog" data-testid="sales-filtered-empty">
          Tidak ada transaksi yang cocok dengan filter.
        </p>
      )}
    </div>
  );
}
