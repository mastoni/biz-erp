'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getPlatformBusinesses, getPlatformSubscriptions, PLATFORM_PAGE_SIZE } from '@/features/platform/api';
import type { PlatformBusiness, PlatformSubscription } from '@/features/platform/types';
import {
  getApiErrorInfo,
  formatPlatformDate,
  formatRangeLabel,
  isNextDisabled,
  isPreviousDisabled,
  shouldShowEmpty,
  shouldShowError,
  shouldShowSkeleton,
  shouldShowTable,
} from '@/features/platform/list-helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Building2, Shield, Calendar, RefreshCw } from 'lucide-react';

const FALLBACK = 'Terjadi kesalahan saat mengambil data bisnis.';
const PAGE_NOUN = 'bisnis';

export default function PlatformBusinessesPage() {
  const [items, setItems] = useState<PlatformBusiness[]>([]);
  const [subscriptions, setSubscriptions] = useState<PlatformSubscription[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reloadKey, setReloadKey] = useState(0);
  const activeRef = useRef(true);

  const load = async (nextOffset: number) => {
    setLoading(true);
    setError(null);
    setRequestId(null);
    try {
      const [bizData, subData] = await Promise.all([
        getPlatformBusinesses(PLATFORM_PAGE_SIZE, nextOffset),
        getPlatformSubscriptions(200, 0),
      ]);

      if (!activeRef.current) return;
      setItems(bizData.items || []);
      setSubscriptions(subData.items || []);
      setTotal(bizData.total || 0);
      setOffset(nextOffset);
      setHasMore(bizData.has_more || false);
    } catch (err) {
      if (!activeRef.current) return;
      const info = getApiErrorInfo(err, FALLBACK);
      setError(info.message);
      setRequestId(info.requestId);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    activeRef.current = true;
    load(0);
    return () => {
      activeRef.current = false;
    };
  }, [reloadKey]);

  const handleNext = () => {
    if (loading) return;
    load(offset + PLATFORM_PAGE_SIZE);
  };
  const handlePrev = () => {
    if (loading || offset === 0) return;
    load(Math.max(0, offset - PLATFORM_PAGE_SIZE));
  };
  const handleRetry = () => setReloadKey((k) => k + 1);

  // Filter items based on search and status
  const filteredItems = useMemo(() => {
    return items.filter((b) => {
      const matchSearch =
        search === '' ||
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        b.id.toLowerCase().includes(search.toLowerCase());

      const sub = subscriptions.find((s) => s.business_id === b.id);
      const status = (sub?.status || 'active').toLowerCase();

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && (status === 'active' || status === 'aktif')) ||
        (statusFilter === 'trial' && status === 'trial') ||
        (statusFilter === 'suspended' && (status === 'suspended' || status === 'ditangguhkan'));

      return matchSearch && matchStatus;
    });
  }, [items, subscriptions, search, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink font-display">
            Manajemen Bisnis Tenant
          </h1>
          <p className="mt-1 text-sm text-fog">
            Daftar entitas bisnis multi-tenant yang terdaftar di Platform Control Plane.
          </p>
        </div>

        <button
          onClick={handleRetry}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2 text-xs font-semibold text-ink shadow-2xs transition hover:bg-paper cursor-pointer disabled:opacity-50"
        >
          <RefreshCw width={14} height={14} className={loading ? 'animate-spin' : ''} />
          <span>Muat Ulang</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-line bg-card p-3.5 shadow-2xs">
        <div className="relative flex-1">
          <Search width={15} height={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama bisnis atau tenant ID…"
            className="w-full rounded-xl border border-line bg-surface pl-9 pr-4 py-2 text-xs text-ink placeholder:text-fog focus:border-pine focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink focus:border-pine focus:outline-none cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="trial">Masa Trial</option>
            <option value="suspended">Ditangguhkan</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {shouldShowError(loading, error) && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5">
          <p className="text-sm font-bold text-rose-900">Gagal memuat data bisnis</p>
          <p className="mt-1 text-xs text-rose-700">{error}</p>
          {requestId && (
            <p className="mt-2 font-mono text-[11px] text-rose-600">Request ID: {requestId}</p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-3 border-rose-300 text-rose-900 hover:bg-rose-100"
            onClick={handleRetry}
          >
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Skeleton loading */}
      {shouldShowSkeleton(loading) && (
        <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-2xs">
          <div className="divide-y divide-line/60 p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 w-full animate-pulse rounded-lg bg-paper" />
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-line bg-paper/60">
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Nama Bisnis</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Tenant ID</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Paket</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Status</th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-fog">Terdaftar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {filteredItems.map((b) => {
                  const sub = subscriptions.find((s) => s.business_id === b.id);
                  const planCode = sub?.plan_code || 'starter';
                  const status = (sub?.status || 'active').toLowerCase();

                  return (
                    <tr key={b.id} className="transition-colors hover:bg-paper/40">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Building2 width={15} height={15} />
                          </div>
                          <div>
                            <p className="font-semibold text-xs text-ink">{b.name}</p>
                            <p className="num text-[10.5px] text-fog">Partisi Terisolasi</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs text-fog bg-surface px-2 py-0.5 rounded border border-line">
                          {b.id}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-semibold text-ink uppercase">
                          {planCode}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[10.5px] font-bold ${
                            status === 'active' || status === 'aktif'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : status === 'trial'
                              ? 'bg-sky-50 text-sky-800 border border-sky-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {status === 'active' || status === 'aktif'
                            ? 'Aktif'
                            : status === 'trial'
                            ? 'Trial'
                            : 'Ditangguhkan'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="num text-xs text-fog">
                          {formatPlatformDate(b.created_at)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredItems.length === 0 && (
            <div className="py-12 text-center">
              <Building2 width={28} height={28} className="mx-auto text-fog/50" />
              <p className="mt-2 text-sm font-semibold text-ink">Tidak ada bisnis ditemukan</p>
              <p className="mt-1 text-xs text-fog">Tidak ada tenant yang cocok dengan filter atau kata kunci pencarian.</p>
            </div>
          )}

          {/* Footer & Pagination */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-line/60 bg-paper/30 px-4 py-3 text-xs">
            <span className="text-fog">
              {formatRangeLabel(total, offset, PLATFORM_PAGE_SIZE, PAGE_NOUN)}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-line bg-card hover:bg-paper"
                disabled={isPreviousDisabled(loading, offset)}
                onClick={handlePrev}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-line bg-card hover:bg-paper"
                disabled={isNextDisabled(loading, hasMore)}
                onClick={handleNext}
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
