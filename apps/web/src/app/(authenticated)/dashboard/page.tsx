'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { useBranchContext } from '@/features/branches/BranchContext';
import { fetchDashboardViewModel } from '@/features/dashboard/api';
import type { DashboardViewModel } from '@/features/dashboard/types';
import { DashboardKPIs } from '@/features/dashboard/components/DashboardKPIs';
import { HourlySalesChart } from '@/features/dashboard/components/HourlySalesChart';
import { PaymentMethodMix } from '@/features/dashboard/components/PaymentMethodMix';
import { TopProductsCard } from '@/features/dashboard/components/TopProductsCard';
import { RecentTransactionsList } from '@/features/dashboard/components/RecentTransactionsList';
import { StockAlertsCard } from '@/features/dashboard/components/StockAlertsCard';
import { QuickActions } from '@/features/dashboard/components/QuickActions';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Calendar, Building2, Store } from 'lucide-react';

export default function DashboardPage() {
  const { business } = useAuth();
  const { activeBranch, branchStatus } = useBranchContext();

  const [viewModel, setViewModel] = useState<DashboardViewModel | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const todayFormatted = React.useMemo(() => {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!business?.id) {
      setViewModel(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchDashboardViewModel({
        branchId: activeBranch?.id ?? null,
      });
      setViewModel(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat ringkasan dashboard.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [business?.id, activeBranch?.id]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header with Contextual Scope & Date Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line/60">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-extrabold font-heading tracking-tight text-ink">
              Dasbor Operasional
            </h1>
            {activeBranch ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-pine-soft text-pine text-xs font-semibold border border-pine/20">
                <Building2 className="h-3 w-3" />
                {activeBranch.name}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-soft text-fog text-xs font-medium border border-line">
                <Store className="h-3 w-3" />
                Semua Cabang (Tenant)
              </span>
            )}
          </div>
          <p className="text-xs text-fog mt-1">
            Ringkasan metrik penjualan real-time, aktivitas checkout, dan status inventori cabang.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-line text-xs font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <Calendar className="h-3.5 w-3.5 text-fog" />
            <span>{todayFormatted}</span>
          </div>
        </div>
      </div>

      {/* Error Boundary View */}
      {error && (
        <ErrorState
          title="Gagal Memuat Dashboard"
          message={error}
          onRetry={loadDashboard}
        />
      )}

      {/* Loading Skeletons */}
      {loading || branchStatus === 'switching' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-5 space-y-3">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-8 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <div className="card p-6 h-72">
                <Skeleton className="h-5 w-48 mb-4" />
                <Skeleton className="h-52 w-full" />
              </div>
            </div>
            <div className="lg:col-span-4">
              <div className="card p-6 h-72">
                <Skeleton className="h-5 w-36 mb-4" />
                <Skeleton className="h-52 w-full" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <div className="card p-6 h-64">
                <Skeleton className="h-5 w-40 mb-4" />
                <Skeleton className="h-44 w-full" />
              </div>
            </div>
            <div className="lg:col-span-7">
              <div className="card p-6 h-64">
                <Skeleton className="h-5 w-40 mb-4" />
                <Skeleton className="h-44 w-full" />
              </div>
            </div>
          </div>
        </div>
      ) : viewModel ? (
        <div className="space-y-6">
          {/* 1. Primary KPIs Row */}
          <DashboardKPIs kpis={viewModel.kpis} stockAlerts={viewModel.stock_alerts} />

          {/* 2. Row 2: Sales Trend (8 Cols) + Payment Mix (4 Cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-8 flex flex-col">
              <HourlySalesChart hourlySales={viewModel.hourly_sales} />
            </div>
            <div className="lg:col-span-4 flex flex-col">
              <PaymentMethodMix paymentMix={viewModel.payment_mix} />
            </div>
          </div>

          {/* 3. Row 3: Top Products (5 Cols) + Recent Transactions (7 Cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-5 flex flex-col">
              <TopProductsCard topProducts={viewModel.top_products} />
            </div>
            <div className="lg:col-span-7 flex flex-col">
              <RecentTransactionsList transactions={viewModel.recent_transactions} />
            </div>
          </div>

          {/* 4. Row 4: Inventory Status (4 Cols) + Quick Actions (8 Cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-4 flex flex-col">
              <StockAlertsCard stockAlerts={viewModel.stock_alerts} />
            </div>
            <div className="lg:col-span-8 flex flex-col">
              <QuickActions />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
