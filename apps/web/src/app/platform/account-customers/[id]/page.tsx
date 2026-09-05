'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  getPlatformAccountCustomerById,
  updatePlatformAccountCustomer,
  setPlatformAccountCustomerStatus,
  getPlatformAccountCustomerUsers,
  addPlatformAccountCustomerUser,
  updatePlatformAccountCustomerUser,
  removePlatformAccountCustomerUser,
  getPlatformAccountCustomerBusinesses,
  reconcilePlatformAccountCustomerBusiness,
  unlinkPlatformAccountCustomerBusiness,
  getPlatformAccountCustomerSubscriptions,
} from '@/features/platform/api';
import type {
  AccountCustomerDetail,
  AccountCustomerStatus,
  AccountCustomerType,
  AccountCustomerUserItem,
  AccountCustomerUserRole,
  AccountCustomerBusinessItem,
  AccountCustomerSubscriptionItem,
  UpdateAccountCustomerPayload,
} from '@/features/platform/types';
import {
  getApiErrorInfo,
  formatPlatformDate,
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
  ArrowLeft,
  Building2,
  Users,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  Unlink,
  Link as LinkIcon,
  AlertCircle,
  X,
} from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PlatformAccountCustomerDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const accountCustomerId = resolvedParams.id;

  const [detail, setDetail] = useState<AccountCustomerDetail | null>(null);
  const [users, setUsers] = useState<AccountCustomerUserItem[]>([]);
  const [businesses, setBusinesses] = useState<AccountCustomerBusinessItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<AccountCustomerSubscriptionItem[]>([]);

  const [activeTab, setActiveTab] = useState<'profile' | 'users' | 'businesses' | 'subscriptions'>('profile');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit Profile Form
  const [profileForm, setProfileForm] = useState<UpdateAccountCustomerPayload>({
    name: '',
    tax_id: '',
    billing_email: '',
    billing_phone: '',
  });
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Status Action Modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<AccountCustomerStatus>('ACTIVE');
  const [statusReason, setStatusReason] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

  // Add User Modal
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [userIdInput, setUserIdInput] = useState('');
  const [userRoleInput, setUserRoleInput] = useState<AccountCustomerUserRole>('AUTHORIZED_USER');
  const [userActionLoading, setUserActionLoading] = useState(false);

  // Reconcile Business Modal
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [reconcileBusinessId, setReconcileBusinessId] = useState('');
  const [expectedOwnerId, setExpectedOwnerId] = useState('');
  const [confirmReassignment, setConfirmReassignment] = useState(false);
  const [reconcileLoading, setReconcileLoading] = useState(false);

  // Unlink Business Modal
  const [unlinkModalOpen, setUnlinkModalOpen] = useState(false);
  const [targetUnlinkBusiness, setTargetUnlinkBusiness] = useState<AccountCustomerBusinessItem | null>(null);
  const [unlinkLoading, setUnlinkLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [detailRes, usersRes, businessesRes, subsRes] = await Promise.all([
        getPlatformAccountCustomerById(accountCustomerId),
        getPlatformAccountCustomerUsers(accountCustomerId),
        getPlatformAccountCustomerBusinesses(accountCustomerId),
        getPlatformAccountCustomerSubscriptions(accountCustomerId),
      ]);

      setDetail(detailRes);
      setUsers(usersRes);
      setBusinesses(businessesRes);
      setSubscriptions(subsRes);

      setProfileForm({
        name: detailRes.name,
        tax_id: detailRes.tax_id || '',
        billing_email: detailRes.billing_email || '',
        billing_phone: detailRes.billing_phone || '',
      });
    } catch (err: unknown) {
      const info = getApiErrorInfo(err, 'Gagal memuat detail Account Customer.');
      setError(info.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [accountCustomerId]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await updatePlatformAccountCustomer(accountCustomerId, {
        name: profileForm.name?.trim(),
        tax_id: profileForm.tax_id?.trim() || null,
        billing_email: profileForm.billing_email?.trim() || null,
        billing_phone: profileForm.billing_phone?.trim() || null,
      });
      setDetail(res.account_customer);
      setSuccessMsg('Profil berhasil diperbarui.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const info = getApiErrorInfo(err, 'Gagal memperbarui profil.');
      setError(info.message);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleStatusChange = async () => {
    setStatusLoading(true);
    setError(null);
    try {
      const res = await setPlatformAccountCustomerStatus(
        accountCustomerId,
        targetStatus,
        statusReason.trim() || undefined
      );
      setDetail(res.account_customer);
      setStatusModalOpen(false);
      setStatusReason('');
      setSuccessMsg(`Status berhasil diubah menjadi ${targetStatus}.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const info = getApiErrorInfo(err, 'Gagal mengubah status.');
      setError(info.message);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserActionLoading(true);
    setError(null);
    try {
      await addPlatformAccountCustomerUser(accountCustomerId, {
        user_id: userIdInput.trim(),
        role: userRoleInput,
      });
      setAddUserModalOpen(false);
      setUserIdInput('');
      setUserRoleInput('AUTHORIZED_USER');
      setSuccessMsg('Pengguna komersial berhasil ditambahkan.');
      setTimeout(() => setSuccessMsg(null), 3000);
      const updatedUsers = await getPlatformAccountCustomerUsers(accountCustomerId);
      setUsers(updatedUsers);
    } catch (err: unknown) {
      const info = getApiErrorInfo(err, 'Gagal menambahkan pengguna.');
      setError(info.message);
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: AccountCustomerUserRole) => {
    setUserActionLoading(true);
    setError(null);
    try {
      await updatePlatformAccountCustomerUser(accountCustomerId, userId, { role: newRole });
      const updatedUsers = await getPlatformAccountCustomerUsers(accountCustomerId);
      setUsers(updatedUsers);
      setSuccessMsg('Role pengguna berhasil diubah.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const info = getApiErrorInfo(err, 'Gagal memperbarui role pengguna.');
      setError(info.message);
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm('Apakah Anda yakin ingin mencabut akses pengguna komersial ini?')) return;
    setUserActionLoading(true);
    setError(null);
    try {
      await removePlatformAccountCustomerUser(accountCustomerId, userId);
      const updatedUsers = await getPlatformAccountCustomerUsers(accountCustomerId);
      setUsers(updatedUsers);
      setSuccessMsg('Pengguna berhasil dihapus dari Account Customer.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const info = getApiErrorInfo(err, 'Gagal menghapus pengguna.');
      setError(info.message);
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReconcileLoading(true);
    setError(null);
    try {
      const res = await reconcilePlatformAccountCustomerBusiness(accountCustomerId, {
        business_id: reconcileBusinessId.trim(),
        expected_current_account_customer_id: expectedOwnerId.trim() || null,
        confirm_reassignment: confirmReassignment,
      });
      setReconcileModalOpen(false);
      setReconcileBusinessId('');
      setExpectedOwnerId('');
      setConfirmReassignment(false);
      setSuccessMsg(`Bisnis berhasil direkonsiliasi. ${res.updated_subscriptions_count} langganan disinkronkan.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      const [updatedBiz, updatedSubs] = await Promise.all([
        getPlatformAccountCustomerBusinesses(accountCustomerId),
        getPlatformAccountCustomerSubscriptions(accountCustomerId),
      ]);
      setBusinesses(updatedBiz);
      setSubscriptions(updatedSubs);
    } catch (err: unknown) {
      const info = getApiErrorInfo(err, 'Gagal merekonsiliasi bisnis.');
      setError(info.message);
    } finally {
      setReconcileLoading(false);
    }
  };

  const handleUnlinkSubmit = async () => {
    if (!targetUnlinkBusiness) return;
    setUnlinkLoading(true);
    setError(null);
    try {
      const res = await unlinkPlatformAccountCustomerBusiness(accountCustomerId, targetUnlinkBusiness.id);
      setUnlinkModalOpen(false);
      setTargetUnlinkBusiness(null);
      setSuccessMsg(`Bisnis berhasil di-unlink. ${res.updated_subscriptions_count} langganan disinkronkan.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      const [updatedBiz, updatedSubs] = await Promise.all([
        getPlatformAccountCustomerBusinesses(accountCustomerId),
        getPlatformAccountCustomerSubscriptions(accountCustomerId),
      ]);
      setBusinesses(updatedBiz);
      setSubscriptions(updatedSubs);
    } catch (err: unknown) {
      const info = getApiErrorInfo(err, 'Gagal memutus tautan bisnis.');
      setError(info.message);
    } finally {
      setUnlinkLoading(false);
    }
  };

  const getStatusBadge = (status: AccountCustomerStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Active
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Pending
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">
            Suspended
          </span>
        );
      case 'TERMINATED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
            Terminated
          </span>
        );
      default:
        return <span className="text-xs font-mono">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-12 max-w-7xl mx-auto text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
        <div className="text-lg font-bold">Account Customer Tidak Ditemukan</div>
        <Link href="/platform/account-customers">
          <Button variant="outline">Kembali ke Daftar</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Back link & Top Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/platform/account-customers"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Daftar Account Customer
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-sm rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header Profile Card */}
      <div className="bg-card border rounded-lg p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{detail.name}</h1>
              {getStatusBadge(detail.status)}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-2 font-mono">
              <div>Kode: <span className="text-foreground font-semibold">{detail.code}</span></div>
              <div>ID: <span className="text-foreground">{detail.id}</span></div>
              <div>Tipe: <span className="text-foreground font-semibold">{detail.account_type}</span></div>
              <div>Dibuat: <span>{formatPlatformDate(detail.created_at)}</span></div>
            </div>
          </div>

          {/* Quick Status Change Actions */}
          <div className="flex items-center gap-2">
            {detail.status !== 'ACTIVE' && (
              <Button
                variant="outline"
                size="sm"
                className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                onClick={() => {
                  setTargetStatus('ACTIVE');
                  setStatusModalOpen(true);
                }}
              >
                Set ACTIVE
              </Button>
            )}
            {detail.status !== 'SUSPENDED' && (
              <Button
                variant="outline"
                size="sm"
                className="text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950"
                onClick={() => {
                  setTargetStatus('SUSPENDED');
                  setStatusModalOpen(true);
                }}
              >
                Suspend
              </Button>
            )}
            {detail.status !== 'TERMINATED' && (
              <Button
                variant="outline"
                size="sm"
                className="text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950"
                onClick={() => {
                  setTargetStatus('TERMINATED');
                  setStatusModalOpen(true);
                }}
              >
                Terminate
              </Button>
            )}
          </div>
        </div>

        {/* Mini KPI stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t text-center">
          <div>
            <div className="text-xs text-muted-foreground uppercase">Bisnis Terkait</div>
            <div className="text-xl font-bold mt-1">{businesses.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">Kontak Pengguna</div>
            <div className="text-xl font-bold mt-1">{users.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">Langganan Komersial</div>
            <div className="text-xl font-bold mt-1">{subscriptions.length}</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b space-x-4">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'profile'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Profil & Metadata
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'users'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Kontak Komersial ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('businesses')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'businesses'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Bisnis & Rekonsiliasi ({businesses.length})
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'subscriptions'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Langganan ({subscriptions.length})
        </button>
      </div>

      {/* TAB 1: Profile & Metadata */}
      {activeTab === 'profile' && (
        <div className="bg-card border rounded-lg p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold">Informasi Legal & Billing</h2>
          <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-xl">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Nama Legal / Komersial *</label>
              <Input
                required
                value={profileForm.name || ''}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Tax ID / NPWP</label>
              <Input
                value={profileForm.tax_id || ''}
                onChange={(e) => setProfileForm({ ...profileForm, tax_id: e.target.value })}
                placeholder="01.234.567.8-901.000"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Email Billing</label>
              <Input
                type="email"
                value={profileForm.billing_email || ''}
                onChange={(e) => setProfileForm({ ...profileForm, billing_email: e.target.value })}
                placeholder="billing@company.com"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Telepon Billing</label>
              <Input
                value={profileForm.billing_phone || ''}
                onChange={(e) => setProfileForm({ ...profileForm, billing_phone: e.target.value })}
                placeholder="+62812345678"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Metadata (JSON)</label>
              <pre className="mt-1 p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto">
                {JSON.stringify(detail.metadata || {}, null, 2)}
              </pre>
            </div>

            <Button type="submit" disabled={updatingProfile}>
              {updatingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </form>
        </div>
      )}

      {/* TAB 2: Commercial Contacts (account_customer_users) */}
      {activeTab === 'users' && (
        <div className="bg-card border rounded-lg p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Kontak Pengguna Komersial</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pengguna yang memiliki otorisasi komersial pada level Account Customer ini.
              </p>
            </div>
            <Button size="sm" onClick={() => setAddUserModalOpen(true)} className="gap-1.5">
              <Plus className="w-4 h-4" />
              Tambah Kontak
            </Button>
          </div>

          {users.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Belum ada kontak pengguna komersial yang terdaftar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pengguna</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Role Komersial</TableHead>
                    <TableHead>Ditambahkan</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">{u.user_name || u.user_email || 'User'}</div>
                        <div className="text-xs text-muted-foreground">{u.user_email}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{u.user_id}</TableCell>
                      <TableCell>
                        <select
                          value={u.role}
                          onChange={(e) =>
                            handleUpdateUserRole(u.user_id, e.target.value as AccountCustomerUserRole)
                          }
                          disabled={userActionLoading}
                          className="h-8 rounded border border-input bg-background px-2 py-1 text-xs font-semibold"
                        >
                          <option value="PRIMARY_CONTACT">PRIMARY_CONTACT</option>
                          <option value="BILLING_ADMIN">BILLING_ADMIN</option>
                          <option value="AUTHORIZED_USER">AUTHORIZED_USER</option>
                        </select>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatPlatformDate(u.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveUser(u.user_id)}
                          disabled={userActionLoading}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Businesses & Reconciliation */}
      {activeTab === 'businesses' && (
        <div className="bg-card border rounded-lg p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Entitas Bisnis Milik Account Customer</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Daftar tenant bisnis yang dinaungi oleh entitas komersial ini.
              </p>
            </div>
            <Button size="sm" onClick={() => setReconcileModalOpen(true)} className="gap-1.5">
              <LinkIcon className="w-4 h-4" />
              Tautkan / Rekonsiliasi Bisnis
            </Button>
          </div>

          {businesses.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Belum ada bisnis yang ditautkan ke Account Customer ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Bisnis</TableHead>
                    <TableHead>Business ID</TableHead>
                    <TableHead>Status Bisnis</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-center">Langganan Aktif</TableHead>
                    <TableHead>Dibuat</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {businesses.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-semibold">{b.name}</TableCell>
                      <TableCell className="font-mono text-xs">{b.id}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted">
                          {b.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{b.owner_email || b.owner_user_id || '-'}</TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {b.active_subscription_count} / {b.subscription_count}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatPlatformDate(b.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950 border-rose-200"
                          onClick={() => {
                            setTargetUnlinkBusiness(b);
                            setUnlinkModalOpen(true);
                          }}
                        >
                          <Unlink className="w-3.5 h-3.5" />
                          Unlink
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Commercial Subscriptions */}
      {activeTab === 'subscriptions' && (
        <div className="bg-card border rounded-lg p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Langganan Komersial</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Semua paket langganan komersial yang terasosiasi dengan Account Customer ini.
            </p>
          </div>

          {subscriptions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Belum ada langganan komersial yang tercatat.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bisnis</TableHead>
                    <TableHead>Paket / Bundle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mulai</TableHead>
                    <TableHead>Berakhir</TableHead>
                    <TableHead>Subscription ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.business_name || s.business_id}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-xs">{s.plan_name || s.plan_code}</div>
                        {s.bundle_code && (
                          <div className="text-[11px] text-muted-foreground">
                            Bundle: {s.bundle_name || s.bundle_code}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                          {s.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatPlatformDate(s.starts_at)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.ends_at ? formatPlatformDate(s.ends_at) : 'Tanpa batas'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{s.id}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Status Action Modal */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-lg shadow-lg w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-semibold">Ubah Status Account Customer</h3>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setStatusModalOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Anda akan mengubah status <span className="font-semibold text-foreground">{detail.name}</span> menjadi{' '}
              <span className="font-bold text-foreground">{targetStatus}</span>.
            </p>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Alasan Perubahan (Opsional)</label>
              <Input
                placeholder="e.g. Permintaan pelanggan / Penyesuaian kontrak"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => setStatusModalOpen(false)} disabled={statusLoading}>
                Batal
              </Button>
              <Button onClick={handleStatusChange} disabled={statusLoading}>
                {statusLoading ? 'Memproses...' : 'Konfirmasi Ubah Status'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {addUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-lg shadow-lg w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-semibold">Tambah Kontak Komersial</h3>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setAddUserModalOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">User ID (UUID) *</label>
                <Input
                  required
                  placeholder="e.g. 11111111-2222-3333-4444-555555555555"
                  value={userIdInput}
                  onChange={(e) => setUserIdInput(e.target.value)}
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Role Komersial *</label>
                <select
                  value={userRoleInput}
                  onChange={(e) => setUserRoleInput(e.target.value as AccountCustomerUserRole)}
                  className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="PRIMARY_CONTACT">PRIMARY_CONTACT</option>
                  <option value="BILLING_ADMIN">BILLING_ADMIN</option>
                  <option value="AUTHORIZED_USER">AUTHORIZED_USER</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setAddUserModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={userActionLoading}>
                  {userActionLoading ? 'Menambahkan...' : 'Tambah Kontak'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reconcile Business Modal */}
      {reconcileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-lg shadow-lg w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-semibold">Tautkan / Rekonsiliasi Bisnis</h3>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setReconcileModalOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={handleReconcileSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Business ID (UUID) *</label>
                <Input
                  required
                  placeholder="e.g. 22222222-3333-4444-5555-666666666666"
                  value={reconcileBusinessId}
                  onChange={(e) => setReconcileBusinessId(e.target.value)}
                  className="mt-1 font-mono text-xs"
                />
              </div>

              <div className="p-3 bg-muted/60 rounded-md space-y-3">
                <div className="text-xs font-medium text-foreground">Proteksi Pemindahan Kepemilikan:</div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Expected Current Owner ID (Wajib jika bisnis sudah milik Account Customer lain)
                  </label>
                  <Input
                    placeholder="e.g. aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
                    value={expectedOwnerId}
                    onChange={(e) => setExpectedOwnerId(e.target.value)}
                    className="mt-1 font-mono text-xs bg-background"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="confirm_reassign"
                    checked={confirmReassignment}
                    onChange={(e) => setConfirmReassignment(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                  />
                  <label htmlFor="confirm_reassign" className="text-xs text-foreground font-medium cursor-pointer">
                    Konfirmasi pemindahan kepemilikan (confirm_reassignment=true)
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setReconcileModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={reconcileLoading}>
                  {reconcileLoading ? 'Memproses...' : 'Tautkan Bisnis'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unlink Business Modal */}
      {unlinkModalOpen && targetUnlinkBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-lg shadow-lg w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-semibold text-destructive">Konfirmasi Pemutusan Tautan Bisnis</h3>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setUnlinkModalOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Apakah Anda yakin ingin melepas tautan bisnis <span className="font-semibold text-foreground">{targetUnlinkBusiness.name}</span> dari Account Customer ini?
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 p-2.5 rounded border border-amber-200 dark:border-amber-900">
              Operasi ini akan mengatur <code className="font-mono">businesses.account_customer_id = NULL</code> dan melepaskan semua langganan aktif bisnis ini secara atomik.
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => setUnlinkModalOpen(false)} disabled={unlinkLoading}>
                Batal
              </Button>
              <Button
                variant="destructive"
                onClick={handleUnlinkSubmit}
                disabled={unlinkLoading}
              >
                {unlinkLoading ? 'Memproses...' : 'Ya, Putuskan Tautan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
