'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  getPlatformServices,
  getPlatformServiceByCode,
  createPlatformService,
  updatePlatformService,
  PLATFORM_PAGE_SIZE,
} from '@/features/platform/api';
import type {
  PlatformService,
  ServiceLifecycleStatus,
  ServiceType,
  ServiceDependency,
  ServiceListSummary,
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
  Server,
  RefreshCw,
  Plus,
  Eye,
  X,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  Archive,
  Network,
  GitBranch,
  Shield,
  Globe,
  Lock,
} from 'lucide-react';

const FALLBACK = 'Terjadi kesalahan saat memproses data registry layanan.';
const PAGE_NOUN = 'layanan';

export default function PlatformServicesPage() {
  const [items, setItems] = useState<PlatformService[]>([]);
  const [summary, setSummary] = useState<ServiceListSummary>({
    total: 0,
    active_count: 0,
    draft_count: 0,
    deprecated_count: 0,
    suspended_count: 0,
    retired_count: 0,
  });
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ServiceLifecycleStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<ServiceType | 'ALL'>('ALL');
  const [reloadKey, setReloadKey] = useState(0);
  const activeRef = useRef(true);

  // Detail / Edit Modal state
  const [selectedServiceCode, setSelectedServiceCode] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<PlatformService | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editType, setEditType] = useState<ServiceType>('INTERNAL');
  const [editStatus, setEditStatus] = useState<ServiceLifecycleStatus>('DRAFT');
  const [editPublicVisibility, setEditPublicVisibility] = useState(false);
  const [editDependencies, setEditDependencies] = useState<Array<{ depends_on: string; type: 'REQUIRED' | 'OPTIONAL' }>>([]);
  const [newDepCode, setNewDepCode] = useState('');
  const [newDepType, setNewDepType] = useState<'REQUIRED' | 'OPTIONAL'>('REQUIRED');

  // Create Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createCode, setCreateCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createCategory, setCreateCategory] = useState('OPERATIONS');
  const [createType, setCreateType] = useState<ServiceType>('INTERNAL');
  const [createStatus, setCreateStatus] = useState<ServiceLifecycleStatus>('DRAFT');
  const [createPublicVisibility, setCreatePublicVisibility] = useState(false);

  // Action status state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const load = async (nextOffset: number) => {
    setLoading(true);
    setError(null);
    setRequestId(null);
    try {
      const data = await getPlatformServices({
        limit: PLATFORM_PAGE_SIZE,
        offset: nextOffset,
        status: statusFilter,
        service_type: typeFilter,
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
  }, [statusFilter, typeFilter, reloadKey]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    load(0);
  };

  const handleRefresh = () => {
    setReloadKey((prev) => prev + 1);
  };

  const handleOpenDetail = async (svc: PlatformService) => {
    setSelectedServiceCode(svc.code);
    setDetailData(svc);
    setEditName(svc.name);
    setEditDescription(svc.description || '');
    setEditCategory(svc.category);
    setEditType(svc.service_type);
    setEditStatus(svc.lifecycle_status);
    setEditPublicVisibility(Boolean(svc.public_visibility));
    setEditDependencies(
      (svc.dependencies || []).map((d) => ({
        depends_on: d.depends_on_service_code,
        type: d.dependency_type,
      }))
    );
    setDetailOpen(true);
    setLoadingDetail(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const detail = await getPlatformServiceByCode(svc.code);
      setDetailData(detail);
      setEditName(detail.name);
      setEditDescription(detail.description || '');
      setEditCategory(detail.category);
      setEditType(detail.service_type);
      setEditStatus(detail.lifecycle_status);
      setEditPublicVisibility(Boolean(detail.public_visibility));
      setEditDependencies(
        (detail.dependencies || []).map((d) => ({
          depends_on: d.depends_on_service_code,
          type: d.dependency_type,
        }))
      );
    } catch (err) {
      const info = getApiErrorInfo(err, 'Gagal memuat rincian layanan.');
      setActionError(info.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAddDependency = () => {
    const code = newDepCode.trim().toUpperCase();
    if (!code) return;
    if (code === selectedServiceCode) {
      setActionError('Layanan tidak dapat bergantung pada dirinya sendiri.');
      return;
    }
    if (editDependencies.some((d) => d.depends_on === code)) {
      setActionError(`Dependensi ke ${code} sudah ada.`);
      return;
    }
    setEditDependencies((prev) => [...prev, { depends_on: code, type: newDepType }]);
    setNewDepCode('');
    setActionError(null);
  };

  const handleRemoveDependency = (depCode: string) => {
    setEditDependencies((prev) => prev.filter((d) => d.depends_on !== depCode));
  };

  const handleUpdateService = async () => {
    if (!selectedServiceCode) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await updatePlatformService(selectedServiceCode, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        category: editCategory.trim(),
        service_type: editType,
        lifecycle_status: editStatus,
        public_visibility: editPublicVisibility,
        dependencies: editDependencies as any,
      });

      setActionSuccess(res.message || 'Layanan berhasil diperbarui');
      // Update local item in table
      setItems((prev) =>
        prev.map((s) => (s.code === selectedServiceCode ? { ...s, ...res.service } : s))
      );
      if (detailData && detailData.code === selectedServiceCode) {
        setDetailData({ ...detailData, ...res.service });
      }
      setReloadKey((k) => k + 1);
    } catch (err) {
      const info = getApiErrorInfo(err, 'Gagal memperbarui layanan.');
      setActionError(info.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await createPlatformService({
        code: createCode.trim().toUpperCase(),
        name: createName.trim(),
        description: createDescription.trim() || null,
        category: createCategory.trim(),
        service_type: createType,
        lifecycle_status: createStatus,
        public_visibility: createPublicVisibility,
      });

      setCreateOpen(false);
      setCreateCode('');
      setCreateName('');
      setCreateDescription('');
      setReloadKey((k) => k + 1);
    } catch (err) {
      const info = getApiErrorInfo(err, 'Gagal membuat layanan baru.');
      setActionError(info.message);
    } finally {
      setActionLoading(false);
    }
  };

  const statusBadge = (st: ServiceLifecycleStatus) => {
    switch (st) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            ACTIVE
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 mr-1" />
            DRAFT
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            SUSPENDED
          </span>
        );
      case 'DEPRECATED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300">
            <Archive className="w-3 h-3 mr-1" />
            DEPRECATED
          </span>
        );
      case 'RETIRED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-500 border border-slate-400">
            RETIRED
          </span>
        );
      default:
        return <span className="text-xs text-ink/60">{st}</span>;
    }
  };

  const typeBadge = (type: ServiceType) => {
    switch (type) {
      case 'INTERNAL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
            INTERNAL
          </span>
        );
      case 'EXTERNAL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
            EXTERNAL
          </span>
        );
      case 'HYBRID':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-teal-50 text-teal-700 border border-teal-200">
            HYBRID
          </span>
        );
      default:
        return <span className="text-xs">{type}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink font-display flex items-center gap-2">
            <Server className="w-6 h-6 text-pine-600" />
            Service Registry
          </h1>
          <p className="text-sm text-ink/60 mt-1">
            Katalog layanan ekosistem platform, relasi dependensi (DAG), dan konfigurasi kapabilitas.
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
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              setCreateOpen(true);
              setActionError(null);
            }}
            className="bg-pine-600 hover:bg-pine-700 text-white flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Tambah Layanan
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-ink/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink/60 uppercase">Total Layanan</span>
            <span className="p-1.5 bg-slate-50 text-slate-600 rounded-md">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-ink mt-2">{summary.total}</p>
          <p className="text-xs text-ink/40 mt-0.5">Layanan makro terdaftar</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-ink/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink/60 uppercase">Layanan Aktif</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{summary.active_count}</p>
          <p className="text-xs text-ink/40 mt-0.5">Operasional &amp; tersedia</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-ink/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink/60 uppercase">Status Draft</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-md">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">{summary.draft_count}</p>
          <p className="text-xs text-ink/40 mt-0.5">Dalam pengembangan / review</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-ink/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink/60 uppercase">Deprecated / Non-Aktif</span>
            <span className="p-1.5 bg-slate-50 text-slate-600 rounded-md">
              <Archive className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-ink mt-2">
            {summary.deprecated_count + summary.suspended_count + summary.retired_count}
          </p>
          <p className="text-xs text-ink/40 mt-0.5">Tidak direkomendasikan</p>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="bg-white p-4 rounded-lg border border-ink/10 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
            <Input
              type="text"
              placeholder="Cari kode layanan, nama, kategori, atau deskripsi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ServiceLifecycleStatus | 'ALL')}
              className="text-sm bg-white border border-ink/10 rounded-md px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-pine-500"
              aria-label="Filter Status"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DEPRECATED">Deprecated</option>
              <option value="RETIRED">Retired</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ServiceType | 'ALL')}
              className="text-sm bg-white border border-ink/10 rounded-md px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-pine-500"
              aria-label="Filter Tipe"
            >
              <option value="ALL">Semua Tipe</option>
              <option value="INTERNAL">Internal</option>
              <option value="EXTERNAL">External</option>
              <option value="HYBRID">Hybrid</option>
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
            <p className="font-semibold text-sm">Gagal Memuat Data Layanan</p>
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
            <Server className="w-12 h-12 text-ink/20 mx-auto mb-3" />
            <p className="text-base font-medium text-ink">Belum Ada Layanan Terdaftar</p>
            <p className="text-sm text-ink/50 mt-1 max-w-md mx-auto">
              Tidak ada layanan yang cocok dengan filter saat ini.
            </p>
          </div>
        )}

        {shouldShowTable(loading, error, items.length) && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Kode Layanan</TableHead>
                  <TableHead>Nama Layanan &amp; Deskripsi</TableHead>
                  <TableHead className="w-[140px]">Kategori</TableHead>
                  <TableHead className="w-[110px]">Tipe</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead className="w-[120px]">Visibilitas</TableHead>
                  <TableHead className="w-[150px]">Dibuat</TableHead>
                  <TableHead className="w-[80px] text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((svc) => (
                  <TableRow key={svc.code} className="hover:bg-ink/5 transition-colors">
                    <TableCell className="font-mono text-xs font-semibold text-ink">
                      {svc.code}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="font-medium text-sm text-ink">{svc.name}</div>
                      {svc.description && (
                        <div className="text-xs text-ink/50 truncate mt-0.5">{svc.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-ink/70">
                      {svc.category}
                    </TableCell>
                    <TableCell>{typeBadge(svc.service_type)}</TableCell>
                    <TableCell>{statusBadge(svc.lifecycle_status)}</TableCell>
                    <TableCell>
                      {svc.public_visibility ? (
                        <span className="inline-flex items-center text-xs text-emerald-700 font-medium">
                          <Globe className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Publik
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs text-ink/40">
                          <Lock className="w-3.5 h-3.5 mr-1" /> Internal
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-ink/60 font-mono">
                      {formatPlatformDate(svc.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenDetail(svc)}
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

      {/* Detail / Edit Modal */}
      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-ink/10">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-ink/10 flex items-start justify-between bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-ink font-display font-mono">
                    {selectedServiceCode}
                  </h2>
                  {detailData && typeBadge(detailData.service_type)}
                  {detailData && statusBadge(detailData.lifecycle_status)}
                </div>
                <p className="text-xs text-ink/50 mt-1">
                  Dibuat: {detailData ? formatPlatformDate(detailData.created_at) : '-'} • Pemilik: {detailData?.owner || 'PLATFORM'}
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
                  {actionError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-md">
                      {actionError}
                    </div>
                  )}

                  {actionSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      {actionSuccess}
                    </div>
                  )}

                  {/* Form fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-medium text-ink/70 mb-1">
                        Nama Layanan
                      </label>
                      <Input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-ink/70 mb-1">
                        Kategori Layanan
                      </label>
                      <Input
                        type="text"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-ink/70 mb-1">
                        Tipe Layanan
                      </label>
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as ServiceType)}
                        className="w-full text-xs bg-white border border-ink/10 rounded-md px-3 py-2 text-ink focus:ring-2 focus:ring-pine-500"
                      >
                        <option value="INTERNAL">INTERNAL</option>
                        <option value="EXTERNAL">EXTERNAL</option>
                        <option value="HYBRID">HYBRID</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-ink/70 mb-1">
                        Status Lifecycle
                      </label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as ServiceLifecycleStatus)}
                        className="w-full text-xs bg-white border border-ink/10 rounded-md px-3 py-2 text-ink focus:ring-2 focus:ring-pine-500"
                      >
                        <option value="DRAFT">DRAFT</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="SUSPENDED">SUSPENDED</option>
                        <option value="DEPRECATED">DEPRECATED</option>
                        <option value="RETIRED">RETIRED</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-medium text-ink/70 mb-1">
                        Deskripsi
                      </label>
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={2}
                        className="w-full text-xs bg-white border border-ink/10 rounded-md p-2.5 text-ink focus:ring-2 focus:ring-pine-500"
                      />
                    </div>

                    <div className="sm:col-span-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="editVisibility"
                        checked={editPublicVisibility}
                        onChange={(e) => setEditPublicVisibility(e.target.checked)}
                        className="rounded border-ink/20 text-pine-600 focus:ring-pine-500"
                      />
                      <label htmlFor="editVisibility" className="text-xs text-ink/80 font-medium">
                        Visibilitas Publik (Tampilkan pada katalog publik landing page)
                      </label>
                    </div>
                  </div>

                  {/* Dependency DAG Section */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-ink/10 space-y-3">
                    <h3 className="font-semibold text-ink uppercase tracking-wider flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-pine-600" />
                      Dependensi Layanan (DAG)
                    </h3>
                    <p className="text-[11px] text-ink/50">
                      Layanan lain yang dibutuhkan agar layanan ini dapat beroperasi.
                    </p>

                    {editDependencies.length > 0 ? (
                      <div className="space-y-1.5">
                        {editDependencies.map((dep) => (
                          <div
                            key={dep.depends_on}
                            className="flex items-center justify-between p-2 bg-white rounded border border-ink/10 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-ink">{dep.depends_on}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                dep.type === 'REQUIRED'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                {dep.type}
                              </span>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveDependency(dep.depends_on)}
                              className="h-6 px-2 text-rose-600 hover:text-rose-700 text-[11px]"
                            >
                              Hapus
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-ink/40 italic py-1">Tidak ada dependensi.</div>
                    )}

                    {/* Add dependency row */}
                    <div className="flex items-center gap-2 pt-2 border-t border-ink/10">
                      <Input
                        type="text"
                        placeholder="Kode Layanan Dependensi..."
                        value={newDepCode}
                        onChange={(e) => setNewDepCode(e.target.value)}
                        className="text-xs uppercase font-mono flex-1"
                      />
                      <select
                        value={newDepType}
                        onChange={(e) => setNewDepType(e.target.value as 'REQUIRED' | 'OPTIONAL')}
                        className="text-xs bg-white border border-ink/10 rounded-md px-2 py-2"
                      >
                        <option value="REQUIRED">REQUIRED</option>
                        <option value="OPTIONAL">OPTIONAL</option>
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleAddDependency}
                        className="text-xs"
                      >
                        Tambah
                      </Button>
                    </div>
                  </div>

                  {/* Capabilities JSON Inspector */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-ink/70 uppercase tracking-wider">
                      Kapabilitas Layanan
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <span className="text-[11px] font-medium text-ink/60 block mb-1">Base Capability</span>
                        <pre className="p-2 bg-slate-900 text-slate-100 rounded text-[10px] font-mono overflow-x-auto max-h-32">
                          {JSON.stringify(detailData?.base_capability || {}, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-ink/60 block mb-1">Provisioning Capability</span>
                        <pre className="p-2 bg-slate-900 text-slate-100 rounded text-[10px] font-mono overflow-x-auto max-h-32">
                          {JSON.stringify(detailData?.provisioning_capability || {}, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-ink/60 block mb-1">Support Capability</span>
                        <pre className="p-2 bg-slate-900 text-slate-100 rounded text-[10px] font-mono overflow-x-auto max-h-32">
                          {JSON.stringify(detailData?.support_capability || {}, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-ink/10 flex items-center justify-end gap-2 bg-slate-50/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailOpen(false)}
                disabled={actionLoading}
              >
                Tutup
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleUpdateService}
                disabled={actionLoading || loadingDetail}
                className="bg-pine-600 hover:bg-pine-700 text-white flex items-center gap-1.5"
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Simpan Perubahan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Service Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-ink/10">
            <form onSubmit={handleCreateService}>
              <div className="p-4 sm:p-6 border-b border-ink/10 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-base font-bold text-ink font-display flex items-center gap-2">
                  <Plus className="w-4 h-4 text-pine-600" />
                  Tambah Layanan Baru
                </h2>
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="text-ink/40 hover:text-ink p-1 rounded-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 text-xs">
                {actionError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-md">
                    {actionError}
                  </div>
                )}

                <div>
                  <label className="block font-medium text-ink/70 mb-1">
                    Kode Layanan (Huruf kapital, angka, underscore; 3-50 karakter)
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="CONTOH: BILLING_CORE"
                    value={createCode}
                    onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                    className="font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block font-medium text-ink/70 mb-1">
                    Nama Layanan
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="Nama Layanan Platform"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-ink/70 mb-1">
                      Kategori
                    </label>
                    <Input
                      type="text"
                      required
                      value={createCategory}
                      onChange={(e) => setCreateCategory(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-ink/70 mb-1">
                      Tipe Layanan
                    </label>
                    <select
                      value={createType}
                      onChange={(e) => setCreateType(e.target.value as ServiceType)}
                      className="w-full text-xs bg-white border border-ink/10 rounded-md px-3 py-2 text-ink"
                    >
                      <option value="INTERNAL">INTERNAL</option>
                      <option value="EXTERNAL">EXTERNAL</option>
                      <option value="HYBRID">HYBRID</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-ink/70 mb-1">
                    Deskripsi
                  </label>
                  <textarea
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    rows={2}
                    placeholder="Rincian fungsional layanan..."
                    className="w-full text-xs bg-white border border-ink/10 rounded-md p-2.5 text-ink"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="createVisibility"
                    checked={createPublicVisibility}
                    onChange={(e) => setCreatePublicVisibility(e.target.checked)}
                    className="rounded border-ink/20 text-pine-600 focus:ring-pine-500"
                  />
                  <label htmlFor="createVisibility" className="text-xs text-ink/80 font-medium">
                    Visibilitas Publik (Landing page catalog)
                  </label>
                </div>
              </div>

              <div className="p-4 border-t border-ink/10 flex items-center justify-end gap-2 bg-slate-50/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateOpen(false)}
                  disabled={actionLoading}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  disabled={actionLoading}
                  className="bg-pine-600 hover:bg-pine-700 text-white flex items-center gap-1.5"
                >
                  {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Layanan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
