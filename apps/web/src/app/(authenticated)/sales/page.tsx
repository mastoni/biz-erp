'use client';

import React from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { useBranchContext } from '@/features/branches/BranchContext';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { useSalesViewModel } from '@/features/sales/use-sales-viewmodel';
import { SalesKPICards } from '@/features/sales/components/SalesKPICards';
import { SalesAnalytics } from '@/features/sales/components/SalesAnalytics';
import { SalesToolbar } from '@/features/sales/components/SalesToolbar';
import { SalesTable } from '@/features/sales/components/SalesTable';

export default function SalesPage() {
  const { business } = useAuth();
  const { branches, activeBranch, branchStatus, selectBranch } = useBranchContext();

  const isSwitchingBranch = branchStatus === 'switching' || branchStatus === 'loading';

  const {
    dataState,
    error,
    kpi,
    trendPoints,
    paymentMethods,
    transactions,
    filteredTransactions,
    range,
    setRange,
    search,
    setSearch,
    paymentMethod,
    setPaymentMethod,
    refresh,
    exportCsv,
  } = useSalesViewModel({
    businessId: business?.id,
    branchId: activeBranch?.id,
  });

  const isLoading = dataState === 'loading' || isSwitchingBranch;
  const isError = dataState === 'error' && !isLoading;

  return (
    <div className="space-y-5" data-testid="sales-page">
      {/* Section Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between" data-testid="sales-header">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
            Penjualan
          </h1>
          <p className="mt-1 text-sm text-fog">
            Log seluruh transaksi kasir — struk baru dari POS otomatis masuk ke daftar ini.
          </p>
          <p className="mt-1 text-xs text-fog/70">
            {business?.name ?? '—'}
            {activeBranch && (
              <>
                {' · Cabang aktif: '}
                <span className="font-medium text-ink">{activeBranch.name}</span>
              </>
            )}
            {isSwitchingBranch && ' · memuat…'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Branch selector */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-fog" htmlFor="sales-branch-select">
              Cabang
            </label>
            <select
              id="sales-branch-select"
              data-testid="sales-branch-select"
              className="input w-auto py-1.5 px-2.5 text-[13px] rounded-lg border border-line bg-surface text-ink"
              value={activeBranch?.id || ''}
              onChange={(e) => selectBranch(e.target.value)}
              disabled={isSwitchingBranch}
            >
              {!activeBranch && <option value="">Pilih cabang</option>}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
            data-testid="sales-refresh-btn"
            className="h-9 px-3 rounded-lg border border-line text-xs font-semibold text-ink hover:bg-surface"
          >
            <RefreshCw className={"mr-1.5 h-3.5 w-3.5 " + (isLoading ? 'animate-spin' : '')} />
            Refresh
          </Button>

          {/* Export CSV button */}
          <Button
            size="sm"
            onClick={() => exportCsv('laporan-penjualan.csv')}
            disabled={isLoading || filteredTransactions.length === 0}
            data-testid="sales-export-csv-btn"
            className="h-9 px-3.5 rounded-lg bg-pine text-[#f2efe2] text-xs font-semibold hover:bg-pine-deep cursor-pointer"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Ekspor CSV
          </Button>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <ErrorState
          message={error || 'Gagal memuat data penjualan'}
          onRetry={refresh}
        />
      )}

      {/* 4 KPI Cards */}
      <SalesKPICards kpi={kpi} isLoading={isLoading} />

      {/* Analytics (2 + 1 Grid) */}
      <SalesAnalytics
        trendPoints={trendPoints}
        range={range}
        onRangeChange={setRange}
        paymentMethods={paymentMethods}
        totalTransactions={kpi.total_sales}
        isLoading={isLoading}
      />

      {/* Transaction Log Ledger */}
      <div className="card overflow-hidden border border-line bg-card rounded-lg shadow-sm" data-testid="sales-transaction-ledger">
        <SalesToolbar
          search={search}
          onSearchChange={setSearch}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          disabled={isLoading}
        />

        <SalesTable
          transactions={filteredTransactions}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
