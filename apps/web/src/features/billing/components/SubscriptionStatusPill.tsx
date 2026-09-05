import React from 'react';
import { CustomerSubscriptionStatus, SUBSCRIPTION_STATUS_LABELS } from '../types';

interface SubscriptionStatusPillProps {
  status: CustomerSubscriptionStatus;
  className?: string;
}

export function SubscriptionStatusPill({ status, className = '' }: SubscriptionStatusPillProps) {
  let style = 'bg-ink/10 text-ink/70 dark:bg-ink/20';

  switch (status) {
    case 'ACTIVE':
      style = 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400';
      break;
    case 'PAUSED':
      style = 'bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400';
      break;
    case 'CANCELLED':
      style = 'bg-rose-500/10 text-rose-600 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400';
      break;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${style} ${className}`}
    >
      <span
        className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
          status === 'ACTIVE'
            ? 'bg-emerald-500'
            : status === 'PAUSED'
            ? 'bg-amber-500'
            : 'bg-rose-500'
        }`}
      />
      {SUBSCRIPTION_STATUS_LABELS[status] || status}
    </span>
  );
}
