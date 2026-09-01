'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  getPlatformBusinesses,
  getPlatformBusinessById,
  approvePlatformBusiness,
  rejectPlatformBusiness,
  suspendPlatformBusiness,
  reactivatePlatformBusiness,
  PLATFORM_PAGE_SIZE,
} from '@/features/platform/api';
import type {
  PlatformBusiness,
  PlatformBusinessDetail,
  BusinessLifecycleStatus,
  BusinessListSummary,
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
  Building2,
  ShieldCheck,
  Clock,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  RefreshCw,
  Eye,
  Lock,
  Unlock,
  X,
  User,
  GitBranch,
  CreditCard,
  Calendar,
  AlertCircle,
} from 'lucide-react';

const FALLBACK = 'Terjadi kesalahan saat memproses data bisnis.';
const PAGE_NOUN = 'bisnis';

export default function PlatformBusinessesPage() {
  const [items, setItems] = useState<PlatformBusiness[]>([]);
  const [summary, setSummary] = useState<BusinessListSummary>({
    pending_count: 0,
    active_count: 0,
    suspended_count: 0,
    rejected_count: 0,
    total: 0,
  });
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BusinessLifecycleStatus | 'ALL'>('ALL');
  const [reloadKey, setReloadKey] = useState(0);
  const activeRef = useRef(true);

  // Modal / Drawer states
  const [selectedBusiness, setSelectedBusiness] = useState<PlatformBusiness | null>(null);
  const [detailData, setDetailData] = useState<PlatformBusinessDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [reactivateModalOpen, setReactivateModalOpen] = useState(false);

  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const load = async (nextOffset: number) => {
    setLoading(true);
    setError(null);
    setRequestId(null);
    try {
      const data = await getPlatformBusinesses({
        limit: PLATFORM_PAGE_SIZE,
        offset: nextOffset,
        status: statusFilter,
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
  }, [reloadKey, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReloadKey((k) => k + 1);
  };

  const handleNext = () => {
    if (loading) return;
    load(offset + PLATFORM_PAGE_SIZE);
  };

  const handlePrev = () => {
    if (loading || offset === 0) return;
    load(Math.max(0, offset - PLATFORM_PAGE_SIZE));
  };

  const handleRetry = () => setReloadKey((k) => k + 1);

  // View Details
  const handleOpenDetail = async (business: PlatformBusiness) => {
    setSelectedBusiness(business);
    setDetailOpen(true);
    setLoadingDetail(true);
    try {
      const detail = await getPlatformBusinessById(business.id);
      setDetailData(detail);
    } catch (err) {
      // fallback to basic
      setDetailData(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Action handlers
  const handleApprove = async () => {
    if (!selectedBusiness) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await approvePlatformBusiness(selectedBusiness.id);
      setApproveModalOpen(false);
      setActionSuccess(`Bisnis ${selectedBusiness.name} berhasil disetujui.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      const info = getApiErrorInfo(err, 'Gagal menyetujui bisnis');
      setActionError(info.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedBusiness) return;
    if (!actionReason.trim()) {
      setActionError('Alasan penolakan wajib diisi.');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await rejectPlatformBusiness(selectedBusiness.id, actionReason.trim());
      setRejectModalOpen(false);
      setActionReason('');
      setActionSuccess(`Pendaftaran bisnis ${selectedBusiness.name} ditolak.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      const info = getApiErrorInfo(err, 'Gagal menolak pendaftaran bisnis');
      setActionError(info.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!selectedBusiness) return;
    if (!actionReason.trim()) {
      setActionError('Alasan penangguhan wajib diisi.');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await suspendPlatformBusiness(selectedBusiness.id, actionReason.trim());
      setSuspendModalOpen(false);
      setActionReason('');
      setActionSuccess(`Akun bisnis ${selectedBusiness.name} ditangguhkan.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      const info = getApiErrorInfo(err, 'Gagal menangguhkan bisnis');
      setActionError(info.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!selectedBusiness) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await reactivatePlatformBusiness(selectedBusiness.id);
      setReactivateModalOpen(false);
      setActionSuccess(`Akun bisnis ${selectedBusiness.name} berhasil diaktifkan kembali.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      const info = getApiErrorInfo(err, 'Gagal mengaktifkan kembali bisnis');
      setActionError(info.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: BusinessLifecycleStatus) => {
    switch (status) {
      case 'PENDING_REVIEW':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-900">
            <Clock className="h-3 w-3 animate-pulse" />
            Perlu Ditinjau
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-900">
            <CheckCircle2 className="h-3 w-3" />
            Aktif
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-900">
            <AlertTriangle className="h-3 w-3" />
            Ditangguhkan
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
            <XCircle className="h-3 w-3" />
            Ditolak
          </span>
        );
      case 'TERMINATED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-800">
            Ditutup
          </span>
        );
      default:
        return <span className="text-xs text-ink/60">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink font-display">
            Manajemen Tenant & Approval
          </h1>
          <p className="mt-1 text-sm text-fog">
            Pusat kendali siklus hidup tenant SKMNet-ERP: review pendaftaran baru, aktivasi, penangguhan, dan monitoring.
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

      {/* Success Notification */}
      {actionSuccess && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="cursor-pointer text-emerald-700 hover:text-emerald-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <button
          onClick={() => setStatusFilter('PENDING_REVIEW')}
          className={`flex flex-col rounded-2xl border p-4 text-left transition cursor-pointer ${
            statusFilter === 'PENDING_REVIEW'
              ? 'border-amber-400 bg-amber-50/70 ring-2 ring-amber-400/20'
              : 'border-amber-200 bg-amber-50/30 hover:bg-amber-50/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-900">Perlu Ditinjau</span>
            <Clock className="h-4 w-4 text-amber-700 animate-pulse" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-950 font-display">
            {summary.pending_count}
          </p>
          <p className="text-[11px] text-amber-800/80 mt-0.5">Antrean persetujuan</p>
        </button>

        <button
          onClick={() => setStatusFilter('ACTIVE')}
          className={`flex flex-col rounded-2xl border p-4 text-left transition cursor-pointer ${
            statusFilter === 'ACTIVE'
              ? 'border-emerald-400 bg-emerald-50/70 ring-2 ring-emerald-400/20'
              : 'border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-900">Bisnis Aktif</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-950 font-display">
            {summary.active_count}
          </p>
          <p className="text-[11px] text-emerald-800/80 mt-0.5">Operasional berjalan</p>
        </button>

        <button
          onClick={() => setStatusFilter('SUSPENDED')}
          className={`flex flex-col rounded-2xl border p-4 text-left transition cursor-pointer ${
            statusFilter === 'SUSPENDED'
              ? 'border-rose-400 bg-rose-50/70 ring-2 ring-rose-400/20'
              : 'border-rose-200 bg-rose-50/30 hover:bg-rose-50/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-900">Ditangguhkan</span>
            <AlertTriangle className="h-4 w-4 text-rose-700" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-950 font-display">
            {summary.suspended_count}
          </p>
          <p className="text-[11px] text-rose-800/80 mt-0.5">Akses dihentikan</p>
        </button>

        <button
          onClick={() => setStatusFilter('REJECTED')}
          className={`flex flex-col rounded-2xl border p-4 text-left transition cursor-pointer ${
            statusFilter === 'REJECTED'
              ? 'border-slate-400 bg-slate-100 ring-2 ring-slate-400/20'
              : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">Ditolak</span>
            <XCircle className="h-4 w-4 text-slate-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-display">
            {summary.rejected_count}
          </p>
          <p className="text-[11px] text-slate-600 mt-0.5">Tidak disetujui</p>
        </button>

        <button
          onClick={() => setStatusFilter('ALL')}
          className={`col-span-2 lg:col-span-1 flex flex-col rounded-2xl border p-4 text-left transition cursor-pointer ${
            statusFilter === 'ALL'
              ? 'border-ink bg-paper ring-2 ring-ink/10'
              : 'border-line bg-card hover:bg-paper'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink">Total Terdaftar</span>
            <Building2 className="h-4 w-4 text-ink/60" />
          </div>
          <p className="mt-2 text-2xl font-bold text-ink font-display">
            {summary.total}
          </p>
          <p className="text-[11px] text-fog mt-0.5">Seluruh tenant platform</p>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fog" />
          <Input
            placeholder="Cari nama bisnis atau email pemilik..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-line rounded-xl text-xs"
          />
        </form>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'REJECTED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-ink text-paper'
                  : 'border border-line bg-card text-ink/70 hover:bg-paper hover:text-ink'
              }`}
            >
              {st === 'ALL'
                ? 'Semua'
                : st === 'PENDING_REVIEW'
                ? `Perlu Ditinjau (${summary.pending_count})`
                : st === 'ACTIVE'
                ? 'Aktif'
                : st === 'SUSPENDED'
                ? 'Ditangguhkan'
                : 'Ditolak'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-line bg-card shadow-2xs overflow-hidden">
        {shouldShowSkeleton(loading) && (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {shouldShowError(loading, error) && (
          <div className="p-8 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-rose-500 mb-2" />
            <p className="text-sm font-bold text-rose-900">Gagal memuat data tenant</p>
            <p className="mt-1 text-xs text-rose-700">{error}</p>
            {requestId && (
              <p className="mt-2 font-mono text-[11px] text-rose-600">Request ID: {requestId}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-4 border-rose-300 text-rose-900 hover:bg-rose-100"
              onClick={handleRetry}
            >
              Coba Lagi
            </Button>
          </div>
        )}

        {shouldShowEmpty(loading, error, items.length) && (
          <div className="p-12 text-center">
            <Building2 className="mx-auto h-10 w-10 text-fog/40 mb-3" />
            <p className="text-sm font-bold text-ink">Tidak ada data bisnis ditemukan</p>
            <p className="mt-1 text-xs text-fog">
              {search || statusFilter !== 'ALL'
                ? 'Coba sesuaikan kata kunci pencarian atau filter status Anda.'
                : 'Belum ada bisnis yang terdaftar di platform.'}
            </p>
          </div>
        )}

        {shouldShowTable(loading, error, items.length) && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-paper/50 hover:bg-paper/50">
                  <TableHead className="w-[280px]">Nama Bisnis & ID</TableHead>
                  <TableHead>Pemilik / Email</TableHead>
                  <TableHead>Status Lifecycle</TableHead>
                  <TableHead>Tgl Pendaftaran</TableHead>
                  <TableHead className="text-right">Aksi Governance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((b) => (
                  <TableRow key={b.id} className="hover:bg-paper/30 transition">
                    <TableCell>
                      <div>
                        <p className="font-semibold text-ink text-sm">{b.name}</p>
                        <p className="font-mono text-[11px] text-fog truncate max-w-[240px]">{b.id}</p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs">
                        <p className="font-medium text-ink">{b.owner_email || '-'}</p>
                        {b.owner_user_id && (
                          <p className="font-mono text-[10px] text-fog">User: {b.owner_user_id.substring(0, 8)}...</p>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      {getStatusBadge(b.status)}
                    </TableCell>

                    <TableCell className="text-xs text-ink/70">
                      {formatPlatformDate(b.created_at)}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(b)}
                          title="Lihat Detail Tenant"
                          className="rounded-lg border border-line bg-white p-1.5 text-ink/70 hover:bg-paper hover:text-ink transition cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {b.status === 'PENDING_REVIEW' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedBusiness(b);
                                setApproveModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition cursor-pointer shadow-2xs"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Setujui</span>
                            </button>

                            <button
                              onClick={() => {
                                setSelectedBusiness(b);
                                setActionReason('');
                                setRejectModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 transition cursor-pointer"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Tolak</span>
                            </button>
                          </>
                        )}

                        {b.status === 'ACTIVE' && (
                          <button
                            onClick={() => {
                              setSelectedBusiness(b);
                              setActionReason('');
                              setSuspendModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Lock className="h-3.5 w-3.5" />
                            <span>Tangguhkan</span>
                          </button>
                        )}

                        {b.status === 'SUSPENDED' && (
                          <button
                            onClick={() => {
                              setSelectedBusiness(b);
                              setReactivateModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition cursor-pointer shadow-2xs"
                          >
                            <Unlock className="h-3.5 w-3.5" />
                            <span>Aktifkan</span>
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && !error && items.length > 0 && (
          <div className="flex items-center justify-between border-t border-line px-6 py-3 bg-paper/20">
            <span className="text-xs text-fog">
              {formatRangeLabel(total, offset, PLATFORM_PAGE_SIZE, PAGE_NOUN)}
            </span>
            <div className="flex gap-2">
              <button
                onClick={handlePrev}
                disabled={isPreviousDisabled(loading, offset)}
                className="rounded-xl border border-line bg-card px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-paper cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Sebelumnya
              </button>
              <button
                onClick={handleNext}
                disabled={isNextDisabled(loading, hasMore)}
                className="rounded-xl border border-line bg-card px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-paper cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL DRAWER / MODAL */}
      {detailOpen && selectedBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-line bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <h3 className="text-lg font-bold font-display text-ink">{selectedBusiness.name}</h3>
                <p className="font-mono text-xs text-fog">{selectedBusiness.id}</p>
              </div>
              <button
                onClick={() => setDetailOpen(false)}
                className="rounded-lg p-1.5 text-fog hover:bg-paper hover:text-ink cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="py-8 text-center text-xs text-fog">Memuat data detail...</div>
            ) : (
              <div className="mt-4 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-line bg-paper/30 p-3">
                    <span className="text-fog">Status Saat Ini</span>
                    <div className="mt-1">{getStatusBadge(detailData?.status || selectedBusiness.status)}</div>
                  </div>
                  <div className="rounded-xl border border-line bg-paper/30 p-3">
                    <span className="text-fog">Tgl Registrasi</span>
                    <p className="font-semibold text-ink mt-1">
                      {formatPlatformDate(detailData?.created_at || selectedBusiness.created_at)}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-line bg-paper/30 p-3 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-ink">
                    <User className="h-4 w-4 text-fog" />
                    <span>Informasi Pemilik (Owner)</span>
                  </div>
                  <p className="text-ink/80">Email: {detailData?.owner_email || selectedBusiness.owner_email || '-'}</p>
                  {detailData?.owner_name && <p className="text-ink/80">Nama Lengkap: {detailData.owner_name}</p>}
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl border border-line bg-paper/30 p-3">
                    <GitBranch className="mx-auto h-4 w-4 text-fog mb-1" />
                    <p className="text-lg font-bold text-ink">{detailData?.branch_count ?? '-'}</p>
                    <span className="text-[10px] text-fog">Cabang</span>
                  </div>
                  <div className="rounded-xl border border-line bg-paper/30 p-3">
                    <CreditCard className="mx-auto h-4 w-4 text-fog mb-1" />
                    <p className="text-lg font-bold text-ink">{detailData?.active_subscription_count ?? '-'}</p>
                    <span className="text-[10px] text-fog">Langganan Aktif</span>
                  </div>
                  <div className="rounded-xl border border-line bg-paper/30 p-3">
                    <User className="mx-auto h-4 w-4 text-fog mb-1" />
                    <p className="text-lg font-bold text-ink">{detailData?.user_count ?? '-'}</p>
                    <span className="text-[10px] text-fog">Staf / Kasir</span>
                  </div>
                </div>

                {/* Audit Lifecycle details */}
                {detailData?.approved_at && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                    <p className="font-semibold text-emerald-900">Disetujui Pada:</p>
                    <p className="text-emerald-800">{formatPlatformDate(detailData.approved_at)}</p>
                    {detailData.approver_email && (
                      <p className="text-[11px] text-emerald-700">Oleh: {detailData.approver_email}</p>
                    )}
                  </div>
                )}

                {detailData?.rejected_reason && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                    <p className="font-semibold text-rose-900">Alasan Penolakan:</p>
                    <p className="text-rose-800">{detailData.rejected_reason}</p>
                    {detailData.rejected_at && (
                      <p className="text-[11px] text-rose-700 mt-1">Pada: {formatPlatformDate(detailData.rejected_at)}</p>
                    )}
                  </div>
                )}

                {detailData?.suspended_reason && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                    <p className="font-semibold text-rose-900">Alasan Penangguhan:</p>
                    <p className="text-rose-800">{detailData.suspended_reason}</p>
                    {detailData.suspended_at && (
                      <p className="text-[11px] text-rose-700 mt-1">Pada: {formatPlatformDate(detailData.suspended_at)}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setDetailOpen(false)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* APPROVE CONFIRMATION MODAL */}
      {approveModalOpen && selectedBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 mb-4">
              <CheckCircle2 className="h-6 w-6" />
            </div>

            <h3 className="text-lg font-bold font-display text-ink">Setujui Pendaftaran Tenant?</h3>
            <p className="mt-2 text-xs text-ink/70 leading-relaxed">
              Anda akan menyetujui akun bisnis <strong className="text-ink">{selectedBusiness.name}</strong>.
              Setelah disetujui, tenant akan aktif dan dapat login untuk menggunakan seluruh fitur ERP yang terpasang.
            </p>

            {actionError && (
              <p className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700 font-semibold">{actionError}</p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setApproveModalOpen(false)}
                disabled={actionLoading}
              >
                Batal
              </Button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
              >
                {actionLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>Ya, Setujui Tenant</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModalOpen && selectedBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 mb-4">
              <XCircle className="h-6 w-6" />
            </div>

            <h3 className="text-lg font-bold font-display text-ink">Tolak Pendaftaran Tenant</h3>
            <p className="mt-1 text-xs text-ink/70">
              Pendaftaran untuk bisnis <strong className="text-ink">{selectedBusiness.name}</strong> akan ditolak.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-ink mb-1">
                Alasan Penolakan <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Contoh: Data usaha tidak valid, duplikasi pendaftaran, dsb..."
                className="w-full rounded-xl border border-line bg-card p-3 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-ink"
              />
            </div>

            {actionError && (
              <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700 font-semibold">{actionError}</p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectModalOpen(false)}
                disabled={actionLoading}
              >
                Batal
              </Button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
              >
                {actionLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>Tolak Pendaftaran</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUSPEND MODAL */}
      {suspendModalOpen && selectedBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <h3 className="text-lg font-bold font-display text-ink">Tangguhkan Akun Bisnis?</h3>
            <p className="mt-1 text-xs text-ink/70 leading-relaxed">
              Seluruh akses operasional untuk tenant <strong className="text-ink">{selectedBusiness.name}</strong> akan dibekukan sementara. Staf dan kasir tidak dapat melakukan transaksi.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-ink mb-1">
                Alasan Penangguhan <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Contoh: Keterlambatan pembayaran langganan, investigasi penyalahgunaan..."
                className="w-full rounded-xl border border-line bg-card p-3 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-ink"
              />
            </div>

            {actionError && (
              <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700 font-semibold">{actionError}</p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSuspendModalOpen(false)}
                disabled={actionLoading}
              >
                Batal
              </Button>
              <button
                onClick={handleSuspend}
                disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
              >
                {actionLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>Tangguhkan Akses</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REACTIVATE MODAL */}
      {reactivateModalOpen && selectedBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 mb-4">
              <Unlock className="h-6 w-6" />
            </div>

            <h3 className="text-lg font-bold font-display text-ink">Aktifkan Kembali Akun Bisnis?</h3>
            <p className="mt-2 text-xs text-ink/70 leading-relaxed">
              Akses operasional untuk bisnis <strong className="text-ink">{selectedBusiness.name}</strong> akan dipulihkan. Pemilik dan staf akan dapat kembali login dan menggunakan ERP secara normal.
            </p>

            {actionError && (
              <p className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700 font-semibold">{actionError}</p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReactivateModalOpen(false)}
                disabled={actionLoading}
              >
                Batal
              </Button>
              <button
                onClick={handleReactivate}
                disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
              >
                {actionLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>Ya, Aktifkan Kembali</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
