'use client';

import React from 'react';
import { formatMinor } from '@/lib/format';
import type { SalesTransactionViewModel } from '../types';

interface ReceiptAccordionProps {
  transaction: SalesTransactionViewModel;
}

export function ReceiptAccordion({ transaction }: ReceiptAccordionProps) {
  return (
    <div
      className="row-in mx-auto max-w-xl rounded-lg border border-line bg-surface overflow-hidden my-1 shadow-sm"
      data-testid={"receipt-accordion-" + transaction.id}
    >
      <p className="border-b border-line px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-fog">
        Rincian Struk {transaction.receipt_number}
      </p>
      <ul>
        {transaction.lines.map((line, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-3 border-b border-line/60 px-4 py-2 text-[13px] last:border-0"
            data-testid="receipt-line-item"
          >
            <span className="font-semibold text-ink">{line.product_name}</span>
            <span className="num text-fog">
              {line.quantity} × {formatMinor(line.unit_price_minor)}
            </span>
            <span className="num w-24 text-right font-bold text-ink">
              {formatMinor(line.line_total_minor)}
            </span>
          </li>
        ))}
        <li className="flex items-center justify-between px-4 py-2.5 text-[13px] font-bold border-t border-line/80 bg-paper/30">
          <span className="text-ink">Total</span>
          <span className="num text-pine" data-testid="receipt-accordion-total">
            {formatMinor(transaction.total_minor)}
          </span>
        </li>
      </ul>
    </div>
  );
}
