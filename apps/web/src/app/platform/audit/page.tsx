'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  getPlatformAuditLogs,
  getPlatformAuditLogById,
  PLATFORM_PAGE_SIZE,
} from '@/features/platform/api';
import type {
  PlatformAuditLog,
  AuditStatus,
  AuditScope,
  AuditListSummary,
} from '@/features/platform/types';
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
  maskSensitivePayload,
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
import {
  Search,
  ShieldAlert,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  X,
  User,
  Activity,
  Layers,
  FileCode,
  Terminal,
  ShieldCheck,
} from 'lucide-react';

const FALLBACK = 'Terjadi kesalahan saat memproses data log audit.';
const PAGE_NOUN = 'log audit';

export default function PlatformAuditPage() {
  const [items, setItems] = useState<PlatformAuditLog[]>([]);
  const [summary, setSummary] = useState<AuditListSummary>({
    total: 0,
    success_count: 0,
    failure_count: 0,
  });
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AuditStatus | 'ALL'>('ALL');
  const [scopeFilter, setScopeFilter] = useState<AuditScope | 'ALL'>('ALL');
  const [reloadKey, setReloadKey] = useState(0);
  const activeRef = useRef(true);

  // Detail Modal State
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<PlatformAuditLog | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = async (nextOffset: number) => {
    setLoading(true);
    setError(null);
    setRequestId(null);
    try {
      const data = await getPlatformAuditLogs({
        limit: PLATFORM_PAGE_SIZE,
        offset: nextOffset,
        status: statusFilter,
        actor_scope: scopeFilter,
        search: search.trim() || undefined,
      });

      if (!activeRef.current) return;
      setItems(data.items || []);
      setTotal(data.total || 0);
      setOffset(nextOffset);
      setHasMore(data.has_more || false);
      if (data.summary) {
        setSummary(data.summary);
      }
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
  }, [statusFilter, scopeFilter, reloadKey]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    load(0);
  };

  const handleRefresh = () => {
    setReloadKey((prev) => prev + 1);
  };

  const handleOpenDetail = async (log: PlatformAuditLog) => {
    setSelectedLogId(log.id);
    setDetailData(log);
    setDetailOpen(true);
    setLoadingDetail(true);
    setDetailError(null);

    try {
      const detail = await getPlatformAuditLogById(log.id);
      setDetailData(detail);
    } catch (err) {
      const info = getApiErrorInfo(err, 'Gagal memuat rincian log audit.');
      setDetailError(info.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const statusBadge = (st: AuditStatus) => {
    switch (st) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            SUCCESS
          </span>
        );
      case 'FAILURE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 mr-1" />
            FAILURE
          </span>
        );
      default:
        return <span className="text-xs text-ink/60">{st}</span>;
    }
  };

  const scopeBadge = (scope: AuditScope) => {
    switch (scope) {
      case 'platform':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
            PLATFORM
          </span>
        );
      case 'tenant':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
            TENANT
          </span>
        );
      case 'system':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-300">
            SYSTEM
          </span>
        );
      default:
        return <span className="text-xs">{scope}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink font-display flex items-center gap-2">
            <Activity className="w-6 h-6 text-pine-600" />
            Audit Logs & Observability
          </h1>
          <p className="text-sm text-ink/60 mt-1">
            Jejak audit operasional, perubahan konfigurasi, dan aktivitas kontrol platform.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Muat Ulang
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-ink/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink/60 uppercase">Total Log Audit</span>
            <span className="p-1.5 bg-slate-50 text-slate-600 rounded-md">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-ink mt-2">{summary.total}</p>
          <p className="text-xs text-ink/40 mt-0.5">Semua rekaman peristiwa audit</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-ink/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink/60 uppercase">Operasi Berhasil</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{summary.success_count}</p>
          <p className="text-xs text-ink/40 mt-0.5">Eksekusi status SUCCESS</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-ink/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink/60 uppercase">Operasi Gagal / Anomali</span>
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-md">
              <AlertCircle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-rose-700 mt-2">{summary.failure_count}</p>
          <p className="text-xs text-ink/40 mt-0.5">Eksekusi status FAILURE</p>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="bg-white p-4 rounded-lg border border-ink/10 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
            <Input
              type="text"
              placeholder="Cari aksi, tipe target, email actor, ID target, atau ID request..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AuditStatus | 'ALL')}
              className="text-sm bg-white border border-ink/10 rounded-md px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-pine-500"
              aria-label="Filter Status"
            >
              <option value="ALL">Semua Status</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILURE">Failure</option>
            </select>

            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as AuditScope | 'ALL')}
              className="text-sm bg-white border border-ink/10 rounded-md px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-pine-500"
              aria-label="Filter Scope"
            >
              <option value="ALL">Semua Cakupan (Scope)</option>
              <option value="platform">Platform</option>
              <option value="tenant">Tenant</option>
              <option value="system">System</option>
            </select>

            <Button type="submit" size="sm" variant="default" className="bg-pine-600 hover:bg-pine-700 text-white">
              Cari
            </Button>
          </div>
        </form>
      </div>

      {/* Error alert */}
      {shouldShowError(loading, error) && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Gagal Memuat Data Log Audit</p>
            <p className="text-sm mt-0.5">{error}</p>
            {requestId && (
              <p className="text-xs text-rose-600/70 font-mono mt-1">Request ID: {requestId}</p>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={handleRefresh}>
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Table & Content */}
      <div className="bg-white rounded-lg border border-ink/10 shadow-sm overflow-hidden">
        {shouldShowSkeleton(loading) && (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {shouldShowEmpty(loading, error, items.length) && (
          <div className="text-center py-12 px-4">
            <Activity className="w-12 h-12 text-ink/20 mx-auto mb-3" />
            <p className="text-base font-medium text-ink">Belum Ada Log Audit</p>
            <p className="text-sm text-ink/50 mt-1 max-w-md mx-auto">
              Tidak ada rekaman audit yang sesuai dengan kriteria filter saat ini.
            </p>
          </div>
        )}

        {shouldShowTable(loading, error, items.length) && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Waktu</TableHead>
                  <TableHead>Aksi (Action)</TableHead>
                  <TableHead>Actor / Pelaksana</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="w-[100px]">Layanan</TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead>Request ID</TableHead>
                  <TableHead className="w-[80px] text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((log) => (
                  <TableRow key={log.id} className="hover:bg-ink/5 transition-colors">
                    <TableCell className="text-xs text-ink/60 font-mono">
                      {formatPlatformDate(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-semibold text-ink bg-slate-100 px-2 py-1 rounded">
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-ink font-medium">
                        {log.actor_email || (log.actor_id ? log.actor_id.slice(0, 8) + '...' : 'System')}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {scopeBadge(log.actor_scope)}
                        {log.actor_role && (
                          <span className="text-[10px] text-ink/40 font-mono">
                            ({log.actor_role})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-mono font-medium text-ink">
                        {log.target_type}
                      </div>
                      {log.target_id && (
                        <div className="text-[11px] text-ink/40 font-mono truncate max-w-[140px]">
                          ID: {log.target_id}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-ink/70">
                      {log.service_code || '-'}
                    </TableCell>
                    <TableCell>{statusBadge(log.status)}</TableCell>
                    <TableCell className="font-mono text-[11px] text-ink/50 max-w-[120px] truncate">
                      {log.request_id || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenDetail(log)}
                        className="h-8 px-2 text-xs flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Detail
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && !error && items.length > 0 && (
          <div className="p-4 border-t border-ink/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-ink/60">
              {formatRangeLabel(total, offset, PLATFORM_PAGE_SIZE, PAGE_NOUN)}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => load(offset - PLATFORM_PAGE_SIZE)}
                disabled={isPreviousDisabled(loading, offset)}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => load(offset + PLATFORM_PAGE_SIZE)}
                disabled={isNextDisabled(loading, hasMore)}
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-ink/10">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-ink/10 flex items-start justify-between bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-ink font-display font-mono">
                    {detailData?.action || 'Rincian Peristiwa Audit'}
                  </h2>
                  {detailData && statusBadge(detailData.status)}
                  {detailData && scopeBadge(detailData.actor_scope)}
                </div>
                <p className="text-xs text-ink/50 font-mono mt-1">
                  ID: {selectedLogId} • Waktu: {detailData ? formatPlatformDate(detailData.created_at) : '-'}
                </p>
              </div>
              <button
                onClick={() => setDetailOpen(false)}
                className="text-ink/40 hover:text-ink p-1 rounded-md transition-colors"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {loadingDetail ? (
                <div className="space-y-4">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : (
                <>
                  {detailError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-md">
                      {detailError}
                    </div>
                  )}

                  {/* Operational Metadata Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-lg border border-ink/5">
                    <div>
                      <span className="text-ink/50 block font-medium">Actor / Pelaksana:</span>
                      <span className="text-ink font-semibold text-sm">
                        {detailData?.actor_email || detailData?.actor_id || 'System Process'}
                      </span>
                      <span className="text-ink/40 block mt-0.5">
                        Role: {detailData?.actor_role || '-'} • Scope: {detailData?.actor_scope}
                      </span>
                    </div>

                    <div>
                      <span className="text-ink/50 block font-medium">Target Objek:</span>
                      <span className="text-ink font-semibold text-sm font-mono">
                        {detailData?.target_type}
                      </span>
                      <span className="text-ink/40 block font-mono mt-0.5">
                        ID: {detailData?.target_id || '-'} • Layanan: {detailData?.service_code || '-'}
                      </span>
                    </div>

                    <div>
                      <span className="text-ink/50 block font-medium">Korelasi Request ID:</span>
                      <span className="text-ink font-mono">
                        {detailData?.request_id || '-'}
                      </span>
                    </div>

                    <div>
                      <span className="text-ink/50 block font-medium">Jaringan & Klien:</span>
                      <span className="text-ink font-mono">
                        IP: {detailData?.ip_address || '-'}
                      </span>
                      {detailData?.user_agent && (
                        <span className="text-ink/40 block text-[10px] truncate max-w-xs mt-0.5">
                          UA: {detailData.user_agent}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Error Message if FAILURE */}
                  {detailData?.error_message && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-md">
                      <span className="font-semibold block mb-0.5">Pesan Kegagalan (Error):</span>
                      <span className="font-mono text-xs">{detailData.error_message}</span>
                    </div>
                  )}

                  {/* Diff / State Inspection */}
                  {detailData?.diff && Object.keys(detailData.diff).length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-ink/70 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-pine-600" />
                        Perubahan Data (State Diff)
                      </h3>
                      <pre className="p-3 bg-slate-900 text-slate-100 rounded-md overflow-x-auto text-[11px] font-mono leading-relaxed">
                        {JSON.stringify(maskSensitivePayload(detailData.diff), null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Before & After State */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {detailData?.before_state && (
                      <div>
                        <h3 className="text-xs font-semibold text-ink/70 uppercase tracking-wider mb-1.5">
                          Status Sebelum (Before)
                        </h3>
                        <pre className="p-3 bg-slate-50 border border-ink/10 rounded-md overflow-x-auto text-[11px] font-mono text-ink leading-relaxed max-h-48">
                          {JSON.stringify(maskSensitivePayload(detailData.before_state), null, 2)}
                        </pre>
                      </div>
                    )}

                    {detailData?.after_state && (
                      <div>
                        <h3 className="text-xs font-semibold text-ink/70 uppercase tracking-wider mb-1.5">
                          Status Sesudah (After)
                        </h3>
                        <pre className="p-3 bg-slate-50 border border-ink/10 rounded-md overflow-x-auto text-[11px] font-mono text-ink leading-relaxed max-h-48">
                          {JSON.stringify(maskSensitivePayload(detailData.after_state), null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Metadata JSON */}
                  {detailData?.metadata && Object.keys(detailData.metadata).length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-ink/70 uppercase tracking-wider mb-1.5">
                        Metadata Tambahan
                      </h3>
                      <pre className="p-3 bg-slate-50 border border-ink/10 rounded-md overflow-x-auto text-[11px] font-mono text-ink leading-relaxed">
                        {JSON.stringify(maskSensitivePayload(detailData.metadata), null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-ink/10 flex items-center justify-end bg-slate-50/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailOpen(false)}
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
