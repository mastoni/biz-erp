'use client';

import React from 'react';
import { RevenueTrendChart } from './RevenueTrendChart';
import { PaymentMethodDonut } from './PaymentMethodDonut';
import type {
  PaymentMethodViewModel,
  SalesRangeFilter,
  SalesTrendPointViewModel,
} from '../types';

interface SalesAnalyticsProps {
  trendPoints: SalesTrendPointViewModel[];
  range: SalesRangeFilter;
  onRangeChange: (r: SalesRangeFilter) => void;
  paymentMethods: PaymentMethodViewModel[];
  totalTransactions: number;
  isLoading: boolean;
}

export function SalesAnalytics({
  trendPoints,
  range,
  onRangeChange,
  paymentMethods,
  totalTransactions,
  isLoading,
}: SalesAnalyticsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3" data-testid="sales-analytics-grid">
      <div className="lg:col-span-2">
        <RevenueTrendChart
          points={trendPoints}
          range={range}
          onRangeChange={onRangeChange}
          isLoading={isLoading}
        />
      </div>
      <div>
        <PaymentMethodDonut
          methods={paymentMethods}
          totalCount={totalTransactions}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
