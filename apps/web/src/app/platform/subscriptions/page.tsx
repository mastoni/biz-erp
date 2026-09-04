'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  getPlatformSubscriptions,
  generatePlatformInvoice,
  recordPlatformPayment,
  getPlatformInvoiceById,
  createPlatformInvoicePaymentToken,
  PLATFORM_PAGE_SIZE,
} from '@/features/platform/api';
import type {
  PlatformSubscription,
  PlatformInvoice,
  PlatformPaymentMethod,
  GatewayTransactionResult,
} from '@/features/platform/types';
import {
  getApiErrorInfo,
  formatPlatformDate,
  formatCurrency,
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
  RefreshCw,
  Receipt,
  CreditCard,
  Eye,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building2,
  FileText,
  Calendar,
  ExternalLink,
  Zap,
  Copy,
} from 'lucide-react';

const FALLBACK = 'Terjadi kesalahan saat memproses data langganan dan penagihan platform.';
const PAGE_NOUN = 'langganan';

export default function PlatformSubscriptionsPage() {
  const [items, setItems] = useState<PlatformSubscription[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Summary counts
  const [summary, setSummary] = useState({
    total: 0,
    active_count: 0,
    pending_count: 0,
    suspended_count: 0,
    cancelled_count: 0,
  });

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Selected subscription for invoice generation
  const [selectedSubForInvoice, setSelectedSubForInvoice] = useState<PlatformSubscription | null>(null);
  const [invoiceNotes, setInvoiceNotes] = useState('');

  // Payment Recording Modal
  const [paymentInvoice, setPaymentInvoice] = useState<PlatformInvoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PlatformPaymentMethod>('MANUAL_BANK_TRANSFER');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Payment Gateway Modal
  const [gatewayTx, setGatewayTx] = useState<GatewayTransactionResult | null>(null);
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Invoice Detail Inspection Modal
  const [inspectInvoice, setInspectInvoice] = useState<PlatformInvoice | null>(null);

  const activeRef = useRef(true);

  const load = async (nextOffset: number) => {
    setLoading(true);
    setError(null);
    setRequestId(null);
    try {
      const data = await getPlatformSubscriptions({
        limit: PLATFORM_PAGE_SIZE,
        offset: nextOffset,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: searchQuery.trim() || undefined,
      });
      if (!activeRef.current) return;
      setItems(data.items);
      setTotal(data.total);
      setOffset(nextOffset);
      setHasMore(data.has_more);
      if (data.summary) {
        setSummary({
          total: data.summary.total ?? data.total,
          active_count: data.summary.active_count ?? 0,
          pending_count: data.summary.pending_count ?? 0,
          suspended_count: data.summary.suspended_count ?? 0,
          cancelled_count: data.summary.cancelled_count ?? 0,
        });
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
    load(0);
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

  // Generate Invoice Handler
  const handleOpenGenerateInvoice = (sub: PlatformSubscription) => {
    setSelectedSubForInvoice(sub);
    setInvoiceNotes(`Tagihan platform untuk periode ${sub.billing_cycle || 'MONTHLY'}`);
    setActionError(null);
    setActionSuccess(null);
  };

  const handleConfirmGenerateInvoice = async () => {
    if (!selectedSubForInvoice) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const result = await generatePlatformInvoice({
        subscription_id: selectedSubForInvoice.id,
        notes: invoiceNotes,
      });
      setActionSuccess(
        result.is_new
          ? `Invoice ${result.invoice.invoice_number} berhasil diterbitkan.`
          : `Invoice ${result.invoice.invoice_number} untuk periode ini sudah ada (idempoten).`
      );
      setSelectedSubForInvoice(null);
      load(offset);
    } catch (err) {
      const info = getApiErrorInfo(err, 'Gagal menerbitkan invoice.');
      setActionError(info.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Payment Gateway Token Initiation
  const handleInitiateGatewayPayment = async (inv: PlatformInvoice) => {
    setGatewayLoading(true);
    setActionError(null);
    try {
      const result = await createPlatformInvoicePaymentToken(inv.id);
      setGatewayTx(result.transaction);
      setCopiedLink(false);
    } catch (err) {
      const info = getApiErrorInfo(err, 'Gagal menginisiasi token payment gateway.');
      setActionError(info.message);
    } finally {
      setGatewayLoading(false);
    }
  };

  // Payment Recording Handler
  const handleOpenPayment = (inv: PlatformInvoice) => {
    setPaymentInvoice(inv);
    setPaymentAmount(inv.total_amount);
    setPaymentMethod('MANUAL_BANK_TRANSFER');
    setPaymentRef(`TRF-${Date.now().toString().slice(-6)}`);
    setPaymentNotes('Pembayaran diverifikasi oleh platform admin.');
    setActionError(null);
    setActionSuccess(null);
  };

  const handleConfirmPayment = async () => {
    if (!paymentInvoice) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const result = await recordPlatformPayment(paymentInvoice.id, {
        amount: paymentAmount,
        payment_method: paymentMethod,
        payment_reference: paymentRef,
        notes: paymentNotes,
      });
      setActionSuccess(
        `Pembayaran ${formatCurrency(result.payment.amount, result.payment.currency)} berhasil dicatat. Status langganan kini: ${result.subscription_status}.`
      );
      setPaymentInvoice(null);
      load(offset);
    } catch (err) {
      const info = getApiErrorInfo(err, 'Gagal mencatat pembayaran invoice.');
      setActionError(info.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Inspect Invoice Detail
  const handleInspectInvoice = async (invoiceId: string) => {
    try {
      const inv = await getPlatformInvoiceById(invoiceId);
      setInspectInvoice(inv);
    } catch (err) {
      const info = getApiErrorInfo(err, 'Gagal memuat detail invoice.');
      setError(info.message);
    }
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const getStatusBadge = (status: string | null) => {
    const s = (status || '').toUpperCase();
    if (s === 'ACTIVE') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
          <CheckCircle2 className="w-3 h-3" /> ACTIVE
        </span>
      );
    }
    if (s === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          <Clock className="w-3 h-3" /> PENDING
        </span>
      );
    }
    if (s === 'SUSPENDED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400">
          <AlertCircle className="w-3 h-3" /> SUSPENDED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
        {s || 'UNKNOWN'}
      </span>
    );
  };

  const getInvoiceBadge = (status: string | null) => {
    const s = (status || '').toUpperCase();
    if (s === 'PAID') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          PAID
        </span>
      );
    }
    if (s === 'ISSUED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
          ISSUED
        </span>
      );
    }
    if (s === 'OVERDUE') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
          OVERDUE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
        {s || 'DRAFT'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold tracking-tight text-ink">Langganan & Penagihan Platform</h2>
          <p className="text-ink/60 mt-1">Siklus langganan, payment gateway online, dan pencatatan pembayaran</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          disabled={loading}
          className="border-ink/20 text-ink hover:bg-ink/5 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Global Action Alerts */}
      {actionSuccess && (
        <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium">{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-md bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <span className="text-sm font-medium">{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border-2 border-ink/10 rounded-lg p-4">
          <p className="text-xs font-medium text-ink/60 uppercase tracking-wider">Total Langganan</p>
          <p className="text-2xl font-bold font-display text-ink mt-1">{summary.total}</p>
        </div>
        <div className="bg-card border-2 border-ink/10 rounded-lg p-4">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Aktif</p>
          <p className="text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400 mt-1">
            {summary.active_count}
          </p>
        </div>
        <div className="bg-card border-2 border-ink/10 rounded-lg p-4">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending</p>
          <p className="text-2xl font-bold font-display text-amber-600 dark:text-amber-400 mt-1">
            {summary.pending_count}
          </p>
        </div>
        <div className="bg-card border-2 border-ink/10 rounded-lg p-4">
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400 uppercase tracking-wider">Suspended</p>
          <p className="text-2xl font-bold font-display text-rose-600 dark:text-rose-400 mt-1">
            {summary.suspended_count}
          </p>
        </div>
      </div>

      {/* Controls: Status tabs & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-card border border-ink/10 rounded-lg p-4">
        <div className="flex flex-wrap gap-2">
          {['ALL', 'ACTIVE', 'PENDING', 'SUSPENDED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-ink text-white dark:bg-white dark:text-ink shadow-sm'
                  : 'bg-ink/5 text-ink/70 hover:bg-ink/10 dark:bg-white/5 dark:text-white/70'
              }`}
            >
              {st === 'ALL' ? 'Semua Status' : st}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-ink/40" />
            <Input
              type="text"
              placeholder="Cari bisnis / plan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" className="h-9 text-xs">
            Cari
          </Button>
        </form>
      </div>

      {/* Skeletons */}
      {shouldShowSkeleton(loading) && (
        <div className="bg-card border-2 border-ink/10 rounded-md overflow-hidden">
          <div className="p-4 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {shouldShowError(loading, error) && (
        <div className="rounded-md bg-brick/5 border border-brick/20 p-4">
          <p className="text-sm text-brick font-medium">Gagal memuat data langganan</p>
          <p className="text-sm text-brick/80 mt-1">{error}</p>
          {requestId && <p className="text-xs text-brick/60 mt-2 font-mono">Request ID: {requestId}</p>}
          <Button variant="outline" size="sm" className="mt-3 border-ink/20 text-ink hover:bg-ink/5" onClick={handleRetry}>
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Empty */}
      {shouldShowEmpty(loading, error, items.length) && (
        <div className="rounded-md border-2 border-dashed border-ink/10 bg-card p-12 text-center">
          <Receipt className="w-12 h-12 mx-auto text-ink/30 mb-3" />
          <p className="text-base font-medium text-ink">Belum ada langganan</p>
          <p className="text-sm text-ink/60 mt-1">Tidak ada data langganan yang cocok dengan kriteria filter.</p>
        </div>
      )}

      {/* Table */}
      {shouldShowTable(loading, error, items.length) && (
        <>
          <div className="bg-card border-2 border-ink/10 rounded-md overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bisnis / Tenant</TableHead>
                    <TableHead>Plan & Siklus</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Periode Aktif</TableHead>
                    <TableHead>Invoice Terakhir</TableHead>
                    <TableHead className="text-right">Aksi Penagihan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => {
                    const inv = row.latest_invoice;
                    return (
                      <TableRow key={row.id}>
                        {/* Bisnis */}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-semibold text-ink flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-ink/40" />
                              {row.business_name || row.business_id}
                            </div>
                            <div className="font-mono text-[11px] text-ink/50">{row.business_id}</div>
                          </div>
                        </TableCell>

                        {/* Plan */}
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="font-medium text-ink">{row.plan_name || row.plan_code}</div>
                            <div className="text-xs text-ink/60">
                              {formatCurrency(row.final_price, row.currency)} / {row.billing_cycle || 'MONTHLY'}
                            </div>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>{getStatusBadge(row.status)}</TableCell>

                        {/* Masa Aktif */}
                        <TableCell>
                          <div className="text-xs space-y-1 text-ink/70">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-ink/40" />
                              Mulai: {formatPlatformDate(row.starts_at)}
                            </div>
                            <div className="text-ink/60">
                              Berakhir: {formatPlatformDate(row.ends_at)}
                            </div>
                          </div>
                        </TableCell>

                        {/* Latest Invoice */}
                        <TableCell>
                          {inv ? (
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-medium text-ink">{inv.invoice_number}</span>
                                {getInvoiceBadge(inv.status)}
                              </div>
                              <div className="text-ink/60">
                                {formatCurrency(inv.total_amount, inv.currency)} · Jatuh tempo: {formatPlatformDate(inv.due_date)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-ink/40 italic">Belum ada invoice</span>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {inv && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleInspectInvoice(inv.id)}
                                title="Lihat Detail Invoice"
                                className="h-8 px-2 text-xs"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" /> Detail
                              </Button>
                            )}

                            {inv && inv.status !== 'PAID' ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleInitiateGatewayPayment(inv)}
                                  disabled={gatewayLoading}
                                  className="h-8 px-2.5 text-xs border-ink/20 text-ink hover:bg-ink/5"
                                  title="Dapatkan Token & Link Pembayaran Midtrans Snap"
                                >
                                  <Zap className="w-3.5 h-3.5 mr-1 text-amber-500" /> Gateway
                                </Button>

                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleOpenPayment(inv)}
                                  className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                >
                                  <CreditCard className="w-3.5 h-3.5 mr-1.5" /> Catat Bayar
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenGenerateInvoice(row)}
                                className="h-8 px-3 text-xs border-ink/20 hover:bg-ink/5 text-ink"
                              >
                                <FileText className="w-3.5 h-3.5 mr-1.5" /> Buat Invoice
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink/60">{formatRangeLabel(total, offset, PLATFORM_PAGE_SIZE, PAGE_NOUN)}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={isPreviousDisabled(loading, offset)}
                className="border-ink/20 text-ink hover:bg-ink/5"
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={isNextDisabled(loading, hasMore)}
                className="border-ink/20 text-ink hover:bg-ink/5"
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        </>
      )}

      {/* MODAL: Payment Gateway Snap Token */}
      {gatewayTx && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-card border-2 border-ink/20 rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold font-display text-ink flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" /> Payment Gateway Online (Midtrans)
              </h3>
              <button
                onClick={() => setGatewayTx(null)}
                className="text-ink/40 hover:text-ink transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-ink/80 bg-ink/5 p-4 rounded-md">
              <div className="flex justify-between">
                <span className="text-ink/60">No. Order / Invoice:</span>
                <span className="font-mono font-bold text-ink">{gatewayTx.order_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/60">Nominal Tagihan:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(gatewayTx.gross_amount, gatewayTx.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/60">Berlaku Sampai:</span>
                <span className="text-xs text-ink/80">{formatPlatformDate(gatewayTx.expires_at)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-ink/70">Snap Token</label>
              <Input
                type="text"
                readOnly
                value={gatewayTx.token}
                className="font-mono text-xs bg-muted"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-ink/70">Payment Checkout Link</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  readOnly
                  value={gatewayTx.redirect_url}
                  className="font-mono text-xs bg-muted flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(gatewayTx.redirect_url)}
                  className="shrink-0 text-xs border-ink/20"
                >
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  {copiedLink ? 'Tersalin' : 'Salin'}
                </Button>
              </div>
            </div>

            <p className="text-xs text-ink/60 italic">
              Pembayaran online akan otomatis diverifikasi melalui webhook gateway secara real-time dan mengaktifkan langganan.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGatewayTx(null)}
              >
                Tutup
              </Button>
              <a
                href={gatewayTx.redirect_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md text-xs font-medium h-8 px-3 bg-amber-600 hover:bg-amber-700 text-white"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Buka Halaman Bayar
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Generate Invoice */}
      {selectedSubForInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-card border-2 border-ink/20 rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold font-display text-ink flex items-center gap-2">
                <Receipt className="w-5 h-5 text-ink" /> Terbitkan Platform Invoice
              </h3>
              <button
                onClick={() => setSelectedSubForInvoice(null)}
                className="text-ink/40 hover:text-ink transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-ink/80 bg-ink/5 p-4 rounded-md">
              <div className="flex justify-between">
                <span className="text-ink/60">Bisnis:</span>
                <span className="font-semibold text-ink">{selectedSubForInvoice.business_name || selectedSubForInvoice.business_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/60">Plan:</span>
                <span className="font-medium text-ink">{selectedSubForInvoice.plan_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/60">Tarif Langganan:</span>
                <span className="font-bold text-ink">
                  {formatCurrency(selectedSubForInvoice.final_price, selectedSubForInvoice.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/60">Siklus:</span>
                <span className="font-medium text-ink">{selectedSubForInvoice.billing_cycle || 'MONTHLY'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-ink/70">Catatan Invoice</label>
              <Input
                type="text"
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                placeholder="Catatan tambahan (opsional)"
                className="text-xs"
              />
            </div>

            <p className="text-xs text-ink/60 italic">
              Invoice diterbitkan secara idempoten. Jika invoice periode berjalan sudah ada, sistem tidak akan membuat duplikasi.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedSubForInvoice(null)}
                disabled={actionLoading}
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmGenerateInvoice}
                disabled={actionLoading}
                className="bg-ink text-white hover:bg-ink/90"
              >
                {actionLoading ? 'Menerbitkan...' : 'Terbitkan Invoice'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Record Payment */}
      {paymentInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-card border-2 border-ink/20 rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold font-display text-ink flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" /> Catat Pembayaran Manual
              </h3>
              <button
                onClick={() => setPaymentInvoice(null)}
                className="text-ink/40 hover:text-ink transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-sm text-ink/80 bg-ink/5 p-4 rounded-md">
              <div className="flex justify-between">
                <span className="text-ink/60">No. Invoice:</span>
                <span className="font-mono font-bold text-ink">{paymentInvoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/60">Total Tagihan:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(paymentInvoice.total_amount, paymentInvoice.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/60">Periode:</span>
                <span className="text-xs text-ink/80">
                  {formatPlatformDate(paymentInvoice.billing_period_start)} — {formatPlatformDate(paymentInvoice.billing_period_end)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-ink/70">Metode Pembayaran</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PlatformPaymentMethod)}
                  className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="MANUAL_BANK_TRANSFER">Transfer Bank Manual (BCA/Mandiri/BRI)</option>
                  <option value="CASH">Tunai / Loket Kantor</option>
                  <option value="INTERNAL_CREDIT">Kredit / Saldo Internal Platform</option>
                  <option value="GATEWAY_PENDING">Gateway Menunggu Konfirmasi</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-ink/70">Nominal Pembayaran</label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink/70">Referensi Transaksi</label>
                <Input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="Contoh: TRF-BCA-981240"
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink/70">Catatan</label>
                <Input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Catatan verifikasi"
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <p className="text-xs text-ink/60 italic">
              Pencatatan pembayaran ini akan otomatis mengubah status invoice menjadi PAID dan memperpanjang masa aktif langganan ke ACTIVE.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaymentInvoice(null)}
                disabled={actionLoading}
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmPayment}
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {actionLoading ? 'Menyimpan...' : 'Konfirmasi Pembayaran'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Inspect Invoice Detail */}
      {inspectInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-card border-2 border-ink/20 rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold font-display text-ink flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-ink" /> {inspectInvoice.invoice_number}
                </h3>
                <p className="text-xs text-ink/60 mt-0.5">Detail tagihan langganan platform</p>
              </div>
              <button
                onClick={() => setInspectInvoice(null)}
                className="text-ink/40 hover:text-ink transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 bg-ink/5 p-4 rounded-md">
                <div>
                  <span className="text-xs text-ink/60 block">Status Invoice</span>
                  <span className="mt-1 inline-block">{getInvoiceBadge(inspectInvoice.status)}</span>
                </div>
                <div>
                  <span className="text-xs text-ink/60 block">Total Tagihan</span>
                  <span className="font-bold text-base text-ink">
                    {formatCurrency(inspectInvoice.total_amount, inspectInvoice.currency)}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs text-ink/60 block">Periode Tagihan</span>
                  <span className="text-xs font-medium text-ink">
                    {formatPlatformDate(inspectInvoice.billing_period_start)} — {formatPlatformDate(inspectInvoice.billing_period_end)}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs text-ink/60 block">Jatuh Tempo</span>
                  <span className="text-xs font-medium text-ink">{formatPlatformDate(inspectInvoice.due_date)}</span>
                </div>
              </div>

              {inspectInvoice.payments && inspectInvoice.payments.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink/70">Riwayat Pembayaran</h4>
                  <div className="border border-ink/10 rounded-md divide-y divide-ink/10">
                    {inspectInvoice.payments.map((p) => (
                      <div key={p.id} className="p-3 text-xs space-y-1">
                        <div className="flex justify-between font-semibold text-ink">
                          <span>{p.payment_method}</span>
                          <span className="text-emerald-600">{formatCurrency(p.amount, p.currency)}</span>
                        </div>
                        <div className="text-ink/60 flex justify-between">
                          <span>Ref: {p.payment_reference || '—'}</span>
                          <span>{formatPlatformDate(p.created_at)}</span>
                        </div>
                        {p.notes && <div className="text-ink/50 italic">{p.notes}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3">
              <Button size="sm" variant="outline" onClick={() => setInspectInvoice(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
