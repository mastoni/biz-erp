'use client';

import React, { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { PaymentMethodViewModel } from '../types';

interface PaymentMethodDonutProps {
  methods: PaymentMethodViewModel[];
  totalCount: number;
  isLoading: boolean;
}

export function PaymentMethodDonut({
  methods,
  totalCount,
  isLoading,
}: PaymentMethodDonutProps) {
  const [active, setActive] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="card h-full p-5 border border-line bg-card rounded-lg" data-testid="payment-donut-loading">
        <Skeleton className="h-5 w-36 rounded" />
        <Skeleton className="mt-1 h-3 w-44 rounded" />
        <div className="mt-6 flex items-center gap-5">
          <Skeleton className="h-36 w-36 rounded-full shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-full rounded" />
          </div>
        </div>
      </div>
    );
  }

  const items = methods.length > 0
    ? methods
    : [
        { payment_method: 'Tunai', canonical_method: 'Tunai' as const, count: 0, total_minor: 0, percentage: 100, label: 'Tunai', color: '#17593e' },
      ];

  const totalSum = items.reduce((s, i) => s + (i.count || 0), 0) || 1;
  let acc = 0;

  return (
    <div className="card h-full p-5 border border-line bg-card rounded-lg" data-testid="payment-donut-chart">
      <h3 className="font-display text-[16px] font-bold text-ink">Metode Pembayaran</h3>
      <p className="mb-4 text-[11.5px] text-fog mt-0.5">Dihitung live dari log transaksi</p>

      <div className="flex items-center gap-5">
        <div className="relative h-36 w-36 shrink-0">
          <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
            <circle cx="21" cy="21" r="15.915" fill="none" stroke="#e8e6d9" strokeWidth="4.5" />
            {items.map((it, i) => {
              const v = (it.count / totalSum) * 100;
              const strokeLength = Math.max(v - 1.5, 0.5);
              const dashArray = strokeLength + " " + (100 - strokeLength);
              const dashOffset = -acc - 0.75;
              acc += v;

              return (
                <circle
                  key={it.label}
                  cx="21"
                  cy="21"
                  r="15.915"
                  fill="none"
                  stroke={it.color}
                  strokeWidth={active === i ? 6 : 4.5}
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  opacity={active === null || active === i ? 1 : 0.3}
                  style={{ transition: 'all 0.25s ease' }}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] uppercase tracking-wider text-fog">
              {active !== null ? items[active].label : 'Total'}
            </span>
            <span className="num text-lg font-bold text-ink" data-testid="donut-center-value">
              {active !== null ? items[active].percentage + "%" : totalCount + " trx"}
            </span>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-2">
          {items.map((it, i) => (
            <li
              key={it.label}
              className="flex items-center gap-2 text-sm cursor-default"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              data-testid={"payment-method-" + it.canonical_method.toLowerCase()}
            >
              <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: it.color }} />
              <span className="truncate text-ink/85 font-medium">{it.label}</span>
              <span className="num ml-auto font-semibold text-ink">{it.percentage}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
