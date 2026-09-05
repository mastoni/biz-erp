import React from 'react';
import { CustomerSubscriptionBillingCycle, BILLING_CYCLE_LABELS } from '../types';
import { Calendar } from 'lucide-react';

interface BillingCyclePillProps {
  cycle: CustomerSubscriptionBillingCycle;
  className?: string;
}

export function BillingCyclePill({ cycle, className = '' }: BillingCyclePillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md bg-ink/5 px-2 py-0.5 text-[11px] font-medium text-ink/70 dark:bg-ink/10 dark:text-ink/80 ${className}`}
    >
      <Calendar className="mr-1 h-3 w-3 text-ink/40" />
      {BILLING_CYCLE_LABELS[cycle] || cycle}
    </span>
  );
}
