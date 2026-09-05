'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  getPlatformAccountCustomers,
  createPlatformAccountCustomer,
} from '@/features/platform/api';
import type {
  AccountCustomerListItem,
  AccountCustomerListSummary,
  AccountCustomerStatus,
  AccountCustomerType,
  CreateAccountCustomerPayload,
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
  PLATFORM_PAGE_SIZE,
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
  Users,
  CreditCard,
  Plus,
  RefreshCw,
  Eye,
  X,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';

const FALLBACK = 'Terjadi kesalahan saat memproses data Account Customer.';
const PAGE_NOUN = 'Account Customer';

export default function PlatformAccountCustomersPage() {
  const [items, setItems] = useState<AccountCustomerListItem[]>([]);
  const [summary, setSummary] = useState<AccountCustomerListSummary>({
    total: 0,
    active_count: 0,
    suspended_count: 0,
    pending_count: 0,
    terminated_count: 0,
  });
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccountCustomerStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<AccountCustomerType | 'ALL'>('ALL');
  const [reloadKey, setReloadKey] = useState(0);
  const activeRef = useRef(true);

  // Create Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAccountCustomerPayload>({
    name: '',
    code: '',
    account_type: 'BUSINESS',
    tax_id: '',
    billing_email: '',
    billing_phone: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const load = async (nextOffset: number) => {
    setLoading(true);
    setError(null);
    setRequestId(null);
    try {
      const res = await getPlatformAccountCustomers({
        search: search.trim() || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        account_type: typeFilter === 'ALL' ? undefined : typeFilter,
        limit: PLATFORM_PAGE_SIZE,
        offset: nextOffset,
      });

      if (!activeRef.current) return;
      setItems(res.items);
      setTotal(res.total);
      setOffset(res.offset);
      setHasMore(res.has_more);
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err: unknown) {
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
  }, [reloadKey, statusFilter, typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    load(0);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      await createPlatformAccountCustomer({
        name: createForm.name.trim(),
        code: createForm.code?.trim() || undefined,
        account_type: createForm.account_type,
        tax_id: createForm.tax_id?.trim() || null,
        billing_email: createForm.billing_email?.trim() || null,
        billing_phone: createForm.billing_phone?.trim() || null,
      });
      setCreateSuccess('Account Customer berhasil dibuat.');
      setTimeout(() => {
        setCreateModalOpen(false);
        setCreateSuccess(null);
        setCreateForm({
          name: '',
          code: '',
          account_type: 'BUSINESS',
          tax_id: '',
          billing_email: '',
          billing_phone: '',
        });
        setReloadKey((k) => k + 1);
      }, 700);
    } catch (err: unknown) {
      const info = getApiErrorInfo(err, 'Gagal membuat Account Customer.');
      setCreateError(info.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const getStatusBadge = (status: AccountCustomerStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Active
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Pending
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">
            Suspended
          </span>
        );
      case 'TERMINATED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
            Terminated
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            {status}
          </span>
        );
    }
  };

  const getTypeBadge = (type: AccountCustomerType) => {
    switch (type) {
      case 'ENTERPRISE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
            Enterprise
          </span>
        );
      case 'BUSINESS':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            Business
          </span>
        );
      case 'INDIVIDUAL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            Individual
          </span>
        );
      default:
        return <span className="text-xs font-mono">{type}</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Account Customers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola entitas kepemilikan komersial platform, kontak utama, dan reconciliasi tenant bisnis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Tambah Account Customer
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border rounded-lg p-4 shadow-sm">
          <div className="text-xs font-medium text-muted-foreground uppercase">Total</div>
          <div className="text-2xl font-bold mt-1">{summary.total}</div>
        </div>
        <div className="bg-card border rounded-lg p-4 shadow-sm">
          <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase">Active</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
            {summary.active_count}
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4 shadow-sm">
          <div className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase">Pending</div>
          <div className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
            {summary.pending_count}
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4 shadow-sm">
          <div className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase">Suspended</div>
          <div className="text-2xl font-bold mt-1 text-orange-600 dark:text-orange-400">
            {summary.suspended_count}
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4 shadow-sm">
          <div className="text-xs font-medium text-rose-600 dark:text-rose-400 uppercase">Terminated</div>
          <div className="text-2xl font-bold mt-1 text-rose-600 dark:text-rose-400">
            {summary.terminated_count}
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-card border rounded-lg p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Cari kode, nama, atau email billing..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as AccountCustomerStatus | 'ALL');
                setOffset(0);
              }}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING">PENDING</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="TERMINATED">TERMINATED</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as AccountCustomerType | 'ALL');
                setOffset(0);
              }}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="ALL">Semua Tipe</option>
              <option value="BUSINESS">BUSINESS</option>
              <option value="ENTERPRISE">ENTERPRISE</option>
              <option value="INDIVIDUAL">INDIVIDUAL</option>
            </select>

            <Button type="submit" variant="secondary" size="sm" className="h-10">
              Cari
            </Button>
          </div>
        </form>
      </div>

      {/* Main Table / View States */}
      <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
        {shouldShowSkeleton(loading) && (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {shouldShowError(loading, error) && (
          <div className="p-8 text-center space-y-3">
            <ShieldAlert className="w-10 h-10 text-destructive mx-auto" />
            <div className="text-base font-semibold text-destructive">{error}</div>
            {requestId && (
              <div className="text-xs text-muted-foreground font-mono">Request ID: {requestId}</div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => load(offset)}
              className="mt-2"
            >
              Coba Lagi
            </Button>
          </div>
        )}

        {shouldShowEmpty(loading, error, items.length) && (
          <div className="p-12 text-center space-y-3">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto" />
            <div className="text-base font-semibold">Tidak ada Account Customer ditemukan</div>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Belum ada data yang sesuai dengan pencarian atau filter yang diterapkan.
            </p>
          </div>
        )}

        {shouldShowTable(loading, error, items.length) && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode & Nama</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Kontak Billing</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Bisnis</TableHead>
                  <TableHead className="text-center">Pengguna</TableHead>
                  <TableHead className="text-center">Langganan Aktif</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="font-semibold text-foreground">{item.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{item.code}</div>
                    </TableCell>
                    <TableCell>{getTypeBadge(item.account_type)}</TableCell>
                    <TableCell>
                      <div className="text-xs">{item.billing_email || '-'}</div>
                      <div className="text-xs text-muted-foreground">{item.billing_phone || '-'}</div>
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell className="text-center font-mono text-sm">{item.business_count}</TableCell>
                    <TableCell className="text-center font-mono text-sm">{item.user_count}</TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {item.active_subscription_count}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatPlatformDate(item.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/platform/account-customers/${item.id}`}>
                        <Button variant="outline" size="sm" className="h-8 gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          Detail
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div>{formatRangeLabel(total, offset, PLATFORM_PAGE_SIZE, PAGE_NOUN)}</div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isPreviousDisabled(loading, offset)}
              onClick={() => load(Math.max(0, offset - PLATFORM_PAGE_SIZE))}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isNextDisabled(loading, hasMore)}
              onClick={() => load(offset + PLATFORM_PAGE_SIZE)}
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-card border rounded-lg shadow-lg w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-semibold">Buat Account Customer Baru</h2>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setCreateModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {createError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            {createSuccess && (
              <div className="p-3 bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-sm rounded flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{createSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Nama Legal / Commercial *</label>
                <Input
                  required
                  placeholder="e.g. PT Maju Bersama Sejahtera"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Kode Khusus (Opsional - otomatis jika kosong)
                </label>
                <Input
                  placeholder="e.g. ACC-2026-0001"
                  value={createForm.code || ''}
                  onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Tipe Entitas *</label>
                <select
                  value={createForm.account_type}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      account_type: e.target.value as AccountCustomerType,
                    })
                  }
                  className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="BUSINESS">BUSINESS</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                  <option value="INDIVIDUAL">INDIVIDUAL</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Email Billing</label>
                <Input
                  type="email"
                  placeholder="billing@company.com"
                  value={createForm.billing_email || ''}
                  onChange={(e) => setCreateForm({ ...createForm, billing_email: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Telepon Billing</label>
                <Input
                  placeholder="+62812345678"
                  value={createForm.billing_phone || ''}
                  onChange={(e) => setCreateForm({ ...createForm, billing_phone: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Tax ID / NPWP</label>
                <Input
                  placeholder="01.234.567.8-901.000"
                  value={createForm.tax_id || ''}
                  onChange={(e) => setCreateForm({ ...createForm, tax_id: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={createLoading}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={createLoading}>
                  {createLoading ? 'Menyimpan...' : 'Simpan Account Customer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
