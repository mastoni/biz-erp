'use client';

import React from 'react';
import { usePlatformOverviewViewModel } from '@/features/platform/use-platform-overview-viewmodel';
import { PlatformKPICards } from '@/features/platform/components/PlatformKPICards';
import { PlatformDistributions } from '@/features/platform/components/PlatformDistributions';
import { PlatformQuickNav } from '@/features/platform/components/PlatformQuickNav';
import { PlatformSchemaViewer } from '@/features/platform/components/PlatformSchemaViewer';
import { getPlatformRoleLabel } from '@/features/platform/list-helpers';
import { Button } from '@/components/ui/button';
import { RefreshCw, Shield } from 'lucide-react';

export default function PlatformOverviewPage() {
  const {
    context,
    kpis,
    planDistribution,
    statusDistribution,
    loading,
    error,
    requestId,
    refresh,
  } = usePlatformOverviewViewModel();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink font-display">
              Platform Control Plane
            </h1>
            {context && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                <Shield width={12} height={12} />
                {getPlatformRoleLabel(context.role)}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-fog">
            SKMNetwork — Ikhtisar status multi-tenant, performa langganan, dan katalog solusi.
          </p>
        </div>

        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2 text-xs font-semibold text-ink shadow-2xs transition hover:bg-paper cursor-pointer disabled:opacity-50"
        >
          <RefreshCw width={14} height={14} className={loading ? 'animate-spin' : ''} />
          <span>Muat Ulang</span>
        </button>
      </div>

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5">
          <p className="text-sm font-bold text-rose-900">Gagal memuat data kontrol platform</p>
          <p className="mt-1 text-xs text-rose-700">{error}</p>
          {requestId && (
            <p className="mt-2 font-mono text-[11px] text-rose-600">Request ID: {requestId}</p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-3 border-rose-300 text-rose-900 hover:bg-rose-100"
            onClick={refresh}
          >
            Coba Lagi
          </Button>
        </div>
      )}

      {/* 4 KPI Cards */}
      <PlatformKPICards kpis={kpis} loading={loading} />

      {/* Distributions */}
      <PlatformDistributions
        planDistribution={planDistribution}
        statusDistribution={statusDistribution}
        loading={loading}
      />

      {/* Quick Navigation Cards */}
      <PlatformQuickNav />

      {/* Database Schema & Architecture Visualizer */}
      <PlatformSchemaViewer />
    </div>
  );
}
