import React from 'react';
import { CustomerInvoiceStatus, INVOICE_STATUS_LABELS } from '../types';

interface InvoiceStatusPillProps {
  status: CustomerInvoiceStatus;
  className?: string;
}

export function InvoiceStatusPill({ status, className = '' }: InvoiceStatusPillProps) {
  let style = 'bg-ink/10 text-ink/70 dark:bg-ink/20';

  switch (status) {
    case 'DRAFT':
      style = 'bg-ink/10 text-ink/60 border border-ink/20 dark:bg-ink/20 dark:text-ink/40';
      break;
    case 'ISSUED':
      style = 'bg-sky-500/10 text-sky-600 border border-sky-500/20 dark:bg-sky-500/20 dark:text-sky-400';
      break;
    case 'PAID':
      style = 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400';
      break;
    case 'OVERDUE':
      style = 'bg-rose-500/10 text-rose-600 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400';
      break;
    case 'CANCELLED':
      style = 'bg-ink/10 text-ink/50 line-through border border-ink/15 dark:bg-ink/10 dark:text-ink/40';
      break;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${style} ${className}`}
    >
      <span
        className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
          status === 'PAID'
            ? 'bg-emerald-500'
            : status === 'ISSUED'
            ? 'bg-sky-500'
            : status === 'OVERDUE'
            ? 'bg-rose-500'
            : 'bg-ink/40'
        }`}
      />
      {INVOICE_STATUS_LABELS[status] || status}
    </span>
  );
}
