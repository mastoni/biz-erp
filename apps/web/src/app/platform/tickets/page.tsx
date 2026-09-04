'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  getPlatformTickets,
  getPlatformTicketById,
  updatePlatformTicketStatus,
  PLATFORM_PAGE_SIZE,
} from '@/features/platform/api';
import type {
  PlatformSupportTicket,
  PlatformSupportTicketDetail,
  TicketStatus,
  TicketPriority,
  TicketListSummary,
  PlatformTicketAssignee,
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
  LifeBuoy,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  X,
  User,
  Building2,
  MessageSquare,
  Sparkles,
  Shield,
  ArrowRight,
  Filter,
} from 'lucide-react';

const FALLBACK = 'Terjadi kesalahan saat memproses data tiket dukungan.';
const PAGE_NOUN = 'tiket';

export default function PlatformTicketsPage() {
  const [items, setItems] = useState<PlatformSupportTicket[]>([]);
  const [summary, setSummary] = useState<TicketListSummary>({
    open_count: 0,
    in_progress_count: 0,
    resolved_count: 0,
    closed_count: 0,
    total: 0,
  });
  const [assignees, setAssignees] = useState<PlatformTicketAssignee[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'ALL'>('ALL');
  const [reloadKey, setReloadKey] = useState(0);
  const activeRef = useRef(true);

  // Detail Modal / Drawer state
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<PlatformSupportTicketDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  // Status & Assignee update state inside detail modal
  const [pendingStatus, setPendingStatus] = useState<TicketStatus>('OPEN');
  const [pendingAssignee, setPendingAssignee] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const load = async (nextOffset: number) => {
    setLoading(true);
    setError(null);
    setRequestId(null);
    try {
      const data = await getPlatformTickets({
        limit: PLATFORM_PAGE_SIZE,
        offset: nextOffset,
        status: statusFilter,
        priority: priorityFilter,
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
      if (data.assignees) {
        setAssignees(data.assignees);
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
  }, [statusFilter, priorityFilter, reloadKey]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    load(0);
  };

  const handleRefresh = () => {
    setReloadKey((prev) => prev + 1);
  };

  const handleOpenDetail = async (ticket: PlatformSupportTicket) => {
    setSelectedTicketId(ticket.id);
    setPendingStatus(ticket.status);
    setPendingAssignee(ticket.assigned_to || '');
    setDetailOpen(true);
    setLoadingDetail(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const detail = await getPlatformTicketById(ticket.id);
      setDetailData(detail);
      setPendingStatus(detail.status);
      setPendingAssignee(detail.assigned_to || '');
    } catch (err) {
      const info = getApiErrorInfo(err, 'Gagal memuat rincian tiket.');
      setActionError(info.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleUpdateStatusAndAssignee = async () => {
    if (!selectedTicketId) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await updatePlatformTicketStatus(selectedTicketId, {
        status: pendingStatus,
        assigned_to: pendingAssignee ? pendingAssignee : null,
      });

      setActionSuccess(res.message || 'Status tiket berhasil diperbarui');
      // Update item in local table list
      setItems((prev) =>
        prev.map((t) => (t.id === selectedTicketId ? { ...t, ...res.ticket } : t))
      );
      // Update local detail
      if (detailData && detailData.id === selectedTicketId) {
        setDetailData({ ...detailData, ...res.ticket });
      }
      // Reload overview counts
      setReloadKey((k) => k + 1);
    } catch (err) {
      const info = getApiErrorInfo(err, 'Gagal memperbarui tiket.');
      setActionError(info.message);
    } finally {
      setActionLoading(false);
    }
  };

  const statusBadge = (st: TicketStatus) => {
    switch (st) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 mr-1" />
            OPEN
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            IN PROGRESS
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            RESOLVED
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300">
            <XCircle className="w-3 h-3 mr-1" />
            CLOSED
          </span>
        );
      default:
        return <span className="text-xs text-ink/60">{st}</span>;
    }
  };

  const priorityBadge = (p: TicketPriority) => {
    switch (p) {
      case 'URGENT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            URGENT
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 border border-orange-300">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
            MEDIUM
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            LOW
          </span>
        );
      default:
        return <span className="text-xs">{p}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink font-display flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-pine-600" />
            Support Tickets
          </h1>
          <p className="text-sm text-ink/60 mt-1">
            Manajemen tiket eskalasi CS AI dan dukungan operasional lintas penyewa (multi-tenant).
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-ink/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink/60 uppercase">Tiket Terbuka (Open)</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-md">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-ink mt-2">{summary.open_count}</p>
          <p className="text-xs text-ink/40 mt-0.5">Menunggu respon/tindakan agen</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-ink/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink/60 uppercase">Sedang Ditangani</span>
            <span className="p-1.5 bg-sky-50 text-sky-600 rounded-md">
              <RefreshCw className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-ink mt-2">{summary.in_progress_count}</p>
          <p className="text-xs text-ink/40 mt-0.5">Dalam investigasi teknis</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-ink/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink/60 uppercase">Selesai (Resolved)</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-ink mt-2">{summary.resolved_count}</p>
          <p className="text-xs text-ink/40 mt-0.5">Solusi telah dikonfirmasi</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-ink/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink/60 uppercase">Ditutup (Closed)</span>
            <span className="p-1.5 bg-slate-50 text-slate-600 rounded-md">
              <XCircle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-ink mt-2">{summary.closed_count}</p>
          <p className="text-xs text-ink/40 mt-0.5">Total tiket: {summary.total}</p>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="bg-white p-4 rounded-lg border border-ink/10 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
            <Input
              type="text"
              placeholder="Cari subjek, deskripsi, nama bisnis, atau layanan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TicketStatus | 'ALL')}
              className="text-sm bg-white border border-ink/10 rounded-md px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-pine-500"
              aria-label="Filter Status"
            >
              <option value="ALL">Semua Status</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | 'ALL')}
              className="text-sm bg-white border border-ink/10 rounded-md px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-pine-500"
              aria-label="Filter Prioritas"
            >
              <option value="ALL">Semua Prioritas</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
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
            <p className="font-semibold text-sm">Gagal Memuat Data Tiket</p>
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
            <LifeBuoy className="w-12 h-12 text-ink/20 mx-auto mb-3" />
            <p className="text-base font-medium text-ink">Belum Ada Tiket Dukungan</p>
            <p className="text-sm text-ink/50 mt-1 max-w-md mx-auto">
              Tidak ada tiket yang cocok dengan kriteria pencarian dan filter saat ini.
            </p>
          </div>
        )}

        {shouldShowTable(loading, error, items.length) && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">ID Tiket</TableHead>
                  <TableHead>Bisnis / Tenant</TableHead>
                  <TableHead>Subjek & Deskripsi</TableHead>
                  <TableHead className="w-[100px]">Prioritas</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead>Agen / Ditugaskan</TableHead>
                  <TableHead className="w-[150px]">Dibuat</TableHead>
                  <TableHead className="w-[100px] text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((ticket) => (
                  <TableRow key={ticket.id} className="hover:bg-ink/5 transition-colors">
                    <TableCell className="font-mono text-xs text-ink/60">
                      {ticket.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm text-ink flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-ink/40" />
                        {ticket.business_name || ticket.business_id.slice(0, 8)}
                      </div>
                      {ticket.service_code && (
                        <span className="text-[11px] text-ink/40 font-mono">
                          Layanan: {ticket.service_code}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="font-medium text-sm text-ink truncate">{ticket.subject}</div>
                      <div className="text-xs text-ink/50 truncate mt-0.5">{ticket.description}</div>
                    </TableCell>
                    <TableCell>{priorityBadge(ticket.priority)}</TableCell>
                    <TableCell>{statusBadge(ticket.status)}</TableCell>
                    <TableCell>
                      {ticket.assignee_name ? (
                        <div className="text-xs text-ink flex items-center gap-1">
                          <User className="w-3 h-3 text-ink/40" />
                          <span>{ticket.assignee_name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-ink/40 italic">Belum ditugaskan</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-ink/60">
                      {formatPlatformDate(ticket.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenDetail(ticket)}
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

      {/* Detail & Action Modal */}
      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-ink/10">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-ink/10 flex items-start justify-between bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-ink font-display">
                    {detailData?.subject || 'Rincian Tiket Dukungan'}
                  </h2>
                  {detailData && priorityBadge(detailData.priority)}
                  {detailData && statusBadge(detailData.status)}
                </div>
                <p className="text-xs text-ink/50 font-mono mt-1">
                  ID: {selectedTicketId} • Dibuat: {detailData ? formatPlatformDate(detailData.created_at) : '-'}
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
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
              {loadingDetail ? (
                <div className="space-y-4">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : (
                <>
                  {actionError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-md">
                      {actionError}
                    </div>
                  )}

                  {actionSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      {actionSuccess}
                    </div>
                  )}

                  {/* Tenant & Service Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-lg border border-ink/5 text-xs">
                    <div>
                      <span className="text-ink/50 block font-medium">Bisnis / Penyewa:</span>
                      <span className="text-ink font-semibold text-sm">
                        {detailData?.business_name || detailData?.business_id}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink/50 block font-medium">Kode Layanan:</span>
                      <span className="text-ink font-mono font-medium">
                        {detailData?.service_code || 'CS_AI'}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <h3 className="text-xs font-semibold text-ink/70 uppercase tracking-wider mb-1.5">
                      Deskripsi Masalah / Tiket
                    </h3>
                    <div className="p-3 bg-white border border-ink/10 rounded-md text-sm text-ink whitespace-pre-wrap">
                      {detailData?.description || 'Tidak ada rincian deskripsi.'}
                    </div>
                  </div>

                  {/* Linked AI CS Conversation Messages */}
                  <div>
                    <h3 className="text-xs font-semibold text-ink/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-pine-600" />
                      Riwayat Percakapan CS AI Terkait
                    </h3>

                    {detailData?.conversation_messages && detailData.conversation_messages.length > 0 ? (
                      <div className="space-y-3 max-h-60 overflow-y-auto p-3 bg-slate-50 rounded-lg border border-ink/10">
                        {detailData.conversation_messages.map((msg) => {
                          const isUser = msg.sender_type === 'USER';
                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                            >
                              <div className="flex items-center gap-1 mb-0.5 text-[10px] text-ink/50">
                                {isUser ? (
                                  <span>Pengguna</span>
                                ) : (
                                  <span className="flex items-center gap-0.5 text-pine-600 font-medium">
                                    <Sparkles className="w-2.5 h-2.5" /> Asisten CS AI
                                  </span>
                                )}
                                <span>•</span>
                                <span>{formatPlatformDate(msg.created_at)}</span>
                              </div>
                              <div
                                className={`p-2.5 rounded-lg text-xs max-w-[85%] leading-relaxed ${
                                  isUser
                                    ? 'bg-pine-600 text-white rounded-br-none'
                                    : 'bg-white text-ink border border-ink/10 rounded-bl-none shadow-xs'
                                }`}
                              >
                                {msg.content}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 text-center bg-slate-50 rounded-lg border border-dashed border-ink/10 text-xs text-ink/50">
                        Tidak ada riwayat percakapan yang tertaut dengan tiket ini.
                      </div>
                    )}
                  </div>

                  {/* Control / Update Form */}
                  <div className="p-4 bg-amber-50/50 rounded-lg border border-amber-200/60 space-y-4">
                    <h3 className="text-xs font-semibold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-amber-700" />
                      Tindakan Kontrol Superadmin
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-ink/70 mb-1">
                          Status Tiket
                        </label>
                        <select
                          value={pendingStatus}
                          onChange={(e) => setPendingStatus(e.target.value as TicketStatus)}
                          className="w-full text-xs bg-white border border-ink/10 rounded-md px-3 py-2 text-ink focus:ring-2 focus:ring-pine-500"
                        >
                          <option value="OPEN">OPEN (Menunggu Tindakan)</option>
                          <option value="IN_PROGRESS">IN_PROGRESS (Sedang Ditangani)</option>
                          <option value="RESOLVED">RESOLVED (Telah Diselesaikan)</option>
                          <option value="CLOSED">CLOSED (Ditutup)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-ink/70 mb-1">
                          Tugaskan ke Agen Platform
                        </label>
                        <select
                          value={pendingAssignee}
                          onChange={(e) => setPendingAssignee(e.target.value)}
                          className="w-full text-xs bg-white border border-ink/10 rounded-md px-3 py-2 text-ink focus:ring-2 focus:ring-pine-500"
                        >
                          <option value="">-- Belum Ditugaskan --</option>
                          {assignees.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name} ({agent.email})
                            </option>
                          ))}
                        </select>
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
                onClick={handleUpdateStatusAndAssignee}
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
    </div>
  );
}
