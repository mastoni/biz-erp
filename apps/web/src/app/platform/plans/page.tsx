'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  getPlatformPlans,
  getPlatformPlanByCode,
  createPlatformPlan,
  updatePlatformPlan,
  setPlatformPlanStatus,
  setPlatformPlanModules,
  getPlatformModules,
} from '@/features/platform/api';
import { PlatformPlan, PlatformModule } from '@/features/platform/types';
import { formatMinor } from '@/lib/format';

export default function PlatformPlansPage() {
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'ACTIVE' | 'DEPRECATED'>('ALL');
  const [familyFilter, setFamilyFilter] = useState('ALL');
  const [summary, setSummary] = useState({ total: 0, active_count: 0, draft_count: 0, deprecated_count: 0 });

  // Drawer / Editor state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);

  // Available modules for entitlement matrix
  const [availableModules, setAvailableModules] = useState<PlatformModule[]>([]);

  // Form fields
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formFamily, setFormFamily] = useState('ERP_PLAN');
  const [formTier, setFormTier] = useState('PRO');
  const [formBillingCycle, setFormBillingCycle] = useState('MONTHLY');
  const [formType, setFormType] = useState('STANDALONE');
  const [formBasePrice, setFormBasePrice] = useState<number>(250000);
  const [formDiscount, setFormDiscount] = useState<number>(0);
  const [formTax, setFormTax] = useState<number>(0);
  const [formTrialDays, setFormTrialDays] = useState<number>(14);
  const [formMaxBranches, setFormMaxBranches] = useState<number>(3);
  const [formMaxUsers, setFormMaxUsers] = useState<number>(5);
  const [formStatus, setFormStatus] = useState<'DRAFT' | 'ACTIVE' | 'DEPRECATED'>('DRAFT');
  const [formIsPublished, setFormIsPublished] = useState(false);
  const [formDisplayOrder, setFormDisplayOrder] = useState(1);
  const [formSelectedModules, setFormSelectedModules] = useState<string[]>([]);
  const [formVersion, setFormVersion] = useState<number>(1);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getPlatformPlans({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        family: familyFilter === 'ALL' ? undefined : familyFilter,
        search: search || undefined,
      });
      setPlans(res.items);
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Akses ditolak: Hanya Superadmin yang memiliki izin mengelola paket.');
      } else {
        setError(err.response?.data?.error?.message || 'Gagal memuat daftar paket.');
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, familyFilter, search]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    getPlatformModules(100, 0)
      .then((res) => setAvailableModules(res.items))
      .catch(() => {});
  }, []);

  const openCreateDrawer = () => {
    setIsEditing(false);
    setFormCode('');
    setFormName('');
    setFormFamily('ERP_PLAN');
    setFormTier('STANDARD');
    setFormBillingCycle('MONTHLY');
    setFormType('STANDALONE');
    setFormBasePrice(150000);
    setFormDiscount(0);
    setFormTax(16500);
    setFormTrialDays(14);
    setFormMaxBranches(1);
    setFormMaxUsers(3);
    setFormStatus('DRAFT');
    setFormIsPublished(false);
    setFormDisplayOrder(1);
    setFormSelectedModules(availableModules.filter((m) => m.is_core).map((m) => m.code));
    setFormVersion(1);
    setFormError(null);
    setConflictNotice(null);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = async (code: string) => {
    try {
      setLoading(true);
      const plan = await getPlatformPlanByCode(code);
      setIsEditing(true);
      setFormCode(plan.code);
      setFormName(plan.name);
      setFormFamily(plan.family || 'ERP_PLAN');
      setFormTier(plan.tier || 'PRO');
      setFormBillingCycle(plan.billing_cycle || 'MONTHLY');
      setFormType(plan.type || 'STANDALONE');
      setFormBasePrice(Number(plan.pricing?.base_price || 0));
      setFormDiscount(Number(plan.pricing?.discount || 0));
      setFormTax(Number(plan.pricing?.tax || 0));
      setFormTrialDays(Number(plan.trial_days || 0));
      setFormMaxBranches(Number(plan.limits?.max_branches || 1));
      setFormMaxUsers(Number(plan.limits?.max_users || 1));
      setFormStatus(plan.status || 'DRAFT');
      setFormIsPublished(Boolean(plan.is_published));
      setFormDisplayOrder(Number(plan.display_order || 0));
      setFormSelectedModules(plan.modules?.map((m) => m.code) || []);
      setFormVersion(plan.version || 1);
      setFormError(null);
      setConflictNotice(null);
      setIsDrawerOpen(true);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Gagal memuat detail paket');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setConflictNotice(null);
    setSaving(true);

    const calculatedFinalPrice = Math.max(0, formBasePrice - formDiscount + formTax);

    try {
      if (isEditing) {
        // Update plan
        await updatePlatformPlan(formCode, {
          name: formName,
          family: formFamily,
          tier: formTier,
          billing_cycle: formBillingCycle,
          type: formType,
          trial_days: formTrialDays,
          limits: { max_branches: formMaxBranches, max_users: formMaxUsers },
          is_published: formIsPublished,
          display_order: formDisplayOrder,
          pricing: {
            base_price: formBasePrice,
            discount: formDiscount,
            tax: formTax,
            final_price: calculatedFinalPrice,
          },
          expected_version: formVersion,
        });

        // Update status if changed
        await setPlatformPlanStatus(formCode, formStatus);

        // Update modules
        await setPlatformPlanModules(
          formCode,
          formSelectedModules.map((mCode) => ({ module_code: mCode }))
        );
      } else {
        // Create new plan
        await createPlatformPlan({
          code: formCode,
          name: formName,
          family: formFamily,
          tier: formTier,
          billing_cycle: formBillingCycle,
          type: formType,
          trial_days: formTrialDays,
          limits: { max_branches: formMaxBranches, max_users: formMaxUsers },
          status: formStatus,
          is_published: formIsPublished,
          display_order: formDisplayOrder,
          pricing: {
            base_price: formBasePrice,
            discount: formDiscount,
            tax: formTax,
            final_price: calculatedFinalPrice,
          },
        });

        if (formSelectedModules.length > 0) {
          await setPlatformPlanModules(
            formCode,
            formSelectedModules.map((mCode) => ({ module_code: mCode }))
          );
        }
      }

      setIsDrawerOpen(false);
      await fetchPlans();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setConflictNotice('Paket ini telah diperbarui oleh administrator lain. Muat ulang sebelum menyimpan.');
      } else {
        setFormError(err.response?.data?.error?.message || 'Gagal menyimpan paket.');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleModule = (moduleCode: string) => {
    setFormSelectedModules((prev) =>
      prev.includes(moduleCode) ? prev.filter((c) => c !== moduleCode) : [...prev, moduleCode]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink">Plans & Pricing Governance</h1>
          <p className="text-sm text-ink/60">
            Kendali pusat paket layanan ERP SKMNetwork, skema harga Rupiah langsung, kuota, dan modul entitlement.
          </p>
        </div>
        <button
          onClick={openCreateDrawer}
          className="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-paper shadow-sm hover:bg-ink/90 transition-all"
        >
          + Buat Paket Baru
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-ink/50">Total Paket</p>
          <p className="mt-2 text-2xl font-bold text-ink font-display">{summary.total}</p>
        </div>
        <div className="rounded-xl border border-teal-500/20 bg-teal-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-teal-700">Paket Aktif</p>
          <p className="mt-2 text-2xl font-bold text-teal-800 font-display">{summary.active_count}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-700">Draft Internal</p>
          <p className="mt-2 text-2xl font-bold text-amber-800 font-display">{summary.draft_count}</p>
        </div>
        <div className="rounded-xl border border-gray-400/20 bg-gray-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-600">Deprecated / Usang</p>
          <p className="mt-2 text-2xl font-bold text-gray-700 font-display">{summary.deprecated_count}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
        <div className="flex flex-1 items-center gap-2">
          <input
            type="text"
            placeholder="Cari nama atau kode paket..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:max-w-xs rounded-lg border border-ink/20 px-3 py-2 text-sm placeholder-ink/40 focus:border-ink focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-lg border border-ink/20 px-3 py-2 text-sm font-medium text-ink focus:border-ink focus:outline-none"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif (ACTIVE)</option>
            <option value="DRAFT">Draft</option>
            <option value="DEPRECATED">Deprecated</option>
          </select>
          <select
            value={familyFilter}
            onChange={(e) => setFamilyFilter(e.target.value)}
            className="rounded-lg border border-ink/20 px-3 py-2 text-sm font-medium text-ink focus:border-ink focus:outline-none"
          >
            <option value="ALL">Semua Family</option>
            <option value="ERP_PLAN">ERP Plan</option>
            <option value="INTERNET_PLAN">ISP Connectivity</option>
            <option value="CCTV_PLAN">CCTV Cloud</option>
          </select>
        </div>
      </div>

      {/* Error / Conflict Banner */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Plans Table */}
      <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink/10 text-left text-sm text-ink">
            <thead className="bg-ink/[0.02] font-semibold text-ink/70">
              <tr>
                <th className="px-4 py-3.5">Kode & Nama Paket</th>
                <th className="px-4 py-3.5">Family / Tier</th>
                <th className="px-4 py-3.5">Siklus</th>
                <th className="px-4 py-3.5">Harga Bersih (IDR)</th>
                <th className="px-4 py-3.5">Limits & Trial</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Publikasi</th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-ink/50">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                    <p className="mt-2 text-xs">Memuat katalog paket...</p>
                  </td>
                </tr>
              ) : plans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-ink/50">
                    Tidak ada paket yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                plans.map((p) => {
                  const finalPrice = p.pricing?.final_price ?? p.pricing?.base_price ?? 0;
                  return (
                    <tr key={p.code} className="hover:bg-ink/[0.01] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink">{p.name}</div>
                        <div className="font-mono text-xs text-ink/50">{p.code}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded bg-ink/5 px-2 py-0.5 text-xs font-medium text-ink">
                          {p.family || 'ERP_PLAN'}
                        </span>
                        <div className="mt-0.5 text-xs text-ink/60">{p.tier || 'STANDARD'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink/70">{p.billing_cycle || 'MONTHLY'}</td>
                      <td className="px-4 py-3">
                        {p.pricing?.discount && p.pricing.discount > 0 ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-ink">{formatMinor(finalPrice)}</span>
                              <span className="rounded bg-emerald-100 px-1 py-0.2 text-[9px] font-extrabold text-emerald-800 uppercase">Promo</span>
                            </div>
                            <div className="text-[11px] text-ink/40 line-through">Normal: {formatMinor(p.pricing?.base_price ?? 0)}</div>
                            <div className="text-[11px] text-emerald-700 font-medium">Diskon: -{formatMinor(p.pricing.discount)}</div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-ink">{formatMinor(finalPrice)}</div>
                            <div className="text-[10px] text-ink/40">Harga normal</div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="text-ink/80">{p.limits?.max_branches || 1} Cabang, {p.limits?.max_users || 1} User</div>
                        {p.trial_days > 0 ? (
                          <span className="inline-block mt-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                            Trial {p.trial_days} hari
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            p.status === 'ACTIVE'
                              ? 'bg-teal-100 text-teal-800'
                              : p.status === 'DRAFT'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-200 text-gray-800'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.is_published ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Tayang #{p.display_order}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-ink/40">
                            <span className="h-2 w-2 rounded-full bg-ink/20" />
                            Tidak Tayang
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEditDrawer(p.code)}
                          className="rounded-lg border border-ink/20 px-2.5 py-1 text-xs font-semibold text-ink hover:bg-ink/5 transition-colors"
                        >
                          Kelola / Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plan Drawer Editor */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-ink/10 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-ink font-display">
                  {isEditing ? `Edit Paket: ${formName}` : 'Buat Paket Layanan Baru'}
                </h2>
                <p className="text-xs text-ink/50">
                  Konfigurasi komersial resmi platform SKMNetwork
                </p>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="rounded-lg p-2 text-ink/50 hover:bg-ink/5 hover:text-ink"
              >
                ✕
              </button>
            </div>

            {/* Conflict Alert */}
            {conflictNotice && (
              <div className="m-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
                <p className="font-bold">⚠️ Konflik Modifikasi Data</p>
                <p className="mt-1">{conflictNotice}</p>
                <button
                  type="button"
                  onClick={() => openEditDrawer(formCode)}
                  className="mt-2 rounded bg-amber-800 px-2 py-1 text-white font-semibold"
                >
                  Muat Ulang Versi Terbaru
                </button>
              </div>
            )}

            {formError && (
              <div className="m-6 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800">
                {formError}
              </div>
            )}

            {/* Form Body */}
            <form onSubmit={handleSavePlan} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* SECTION 1: Basic Information */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60 border-b border-ink/10 pb-1">
                  1. Informasi Dasar Paket
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-ink">Kode Paket (Unique PK)</label>
                    <input
                      type="text"
                      disabled={isEditing}
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                      placeholder="e.g. ERP_RETAIL_PRO"
                      required
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm font-mono uppercase text-ink focus:border-ink focus:outline-none disabled:bg-ink/5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink">Nama Paket Komersial</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. ERP Pro Retail Bisnis"
                      required
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink">Family</label>
                    <select
                      value={formFamily}
                      onChange={(e) => setFormFamily(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                    >
                      <option value="ERP_PLAN">ERP Plan (Software)</option>
                      <option value="INTERNET_PLAN">ISP Internet Plan</option>
                      <option value="CCTV_PLAN">CCTV Cloud Plan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink">Tier</label>
                    <select
                      value={formTier}
                      onChange={(e) => setFormTier(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                    >
                      <option value="STARTER">Starter</option>
                      <option value="STANDARD">Standard</option>
                      <option value="PRO">Pro</option>
                      <option value="ENTERPRISE">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink">Siklus Billing</label>
                    <select
                      value={formBillingCycle}
                      onChange={(e) => setFormBillingCycle(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                    >
                      <option value="MONTHLY">Bulanan (MONTHLY)</option>
                      <option value="QUARTERLY">Triwulan (QUARTERLY)</option>
                      <option value="ANNUAL">Tahunan (ANNUAL)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink">Tipe</label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                    >
                      <option value="STANDALONE">Standalone</option>
                      <option value="INCLUDED">Included</option>
                      <option value="TRIAL">Trial</option>
                      <option value="PROMO">Promo</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Pricing Contract */}
              <div className="space-y-4 rounded-xl border border-ink/10 bg-ink/[0.01] p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60 border-b border-ink/10 pb-1">
                  2. Skema Harga Moneter (Integer Rupiah Langsung)
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink">Harga Dasar (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      value={formBasePrice}
                      onChange={(e) => setFormBasePrice(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm font-semibold text-ink focus:border-ink focus:outline-none"
                    />
                    <span className="text-[10px] text-ink/50">{formatMinor(formBasePrice)}</span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink">Diskon Potongan (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      value={formDiscount}
                      onChange={(e) => setFormDiscount(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm font-semibold text-emerald-600 focus:border-ink focus:outline-none"
                    />
                    <span className="text-[10px] text-emerald-600">{formatMinor(formDiscount)}</span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink">Pajak PPN 11% (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      value={formTax}
                      onChange={(e) => setFormTax(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm font-semibold text-ink focus:border-ink focus:outline-none"
                    />
                    <span className="text-[10px] text-ink/50">{formatMinor(formTax)}</span>
                  </div>
                </div>
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-emerald-800 font-semibold">Harga Final yang Dibayar Tenant:</div>
                    <div className="text-[11px] text-ink/60">
                      {formDiscount > 0 ? `Harga normal ${formatMinor(formBasePrice)} - Diskon ${formatMinor(formDiscount)}` : 'Harga normal standar'}
                    </div>
                  </div>
                  <span className="text-lg font-bold text-emerald-900 font-display">
                    {formatMinor(Math.max(0, formBasePrice - formDiscount + formTax))}
                  </span>
                </div>
              </div>

              {/* SECTION 3 & 4: Trial & Limits */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink">Durasi Trial (Hari)</label>
                  <input
                    type="number"
                    min={0}
                    value={formTrialDays}
                    onChange={(e) => setFormTrialDays(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                  />
                  <span className="text-[10px] text-ink/50">0 = Tanpa trial</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink">Batas Max Cabang</label>
                  <input
                    type="number"
                    min={1}
                    value={formMaxBranches}
                    onChange={(e) => setFormMaxBranches(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink">Batas Max Pengguna</label>
                  <input
                    type="number"
                    min={1}
                    value={formMaxUsers}
                    onChange={(e) => setFormMaxUsers(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                  />
                </div>
              </div>

              {/* SECTION 5: Modules Entitlement Matrix */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60 border-b border-ink/10 pb-1">
                  5. Modul Entitlement Software
                </h3>
                <p className="text-xs text-ink/50">Pilih modul yang diaktifkan untuk tenant pelanggan paket ini:</p>
                <div className="grid grid-cols-2 gap-2">
                  {availableModules.map((m) => {
                    const isChecked = formSelectedModules.includes(m.code);
                    return (
                      <label
                        key={m.code}
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                          isChecked ? 'border-ink bg-ink/[0.03]' : 'border-ink/10 hover:border-ink/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleModule(m.code)}
                          className="h-4 w-4 rounded border-ink/30 text-ink focus:ring-ink"
                        />
                        <div>
                          <div className="text-xs font-bold text-ink">{m.name}</div>
                          <div className="text-[10px] text-ink/50 font-mono">{m.code} · {m.pillar || 'OPERATE'}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 6: Governance & Publishing */}
              <div className="space-y-4 rounded-xl border border-ink/10 bg-ink/[0.01] p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60 border-b border-ink/10 pb-1">
                  6. Tata Kelola & Publikasi
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-ink">Status State Machine</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm font-semibold text-ink focus:border-ink focus:outline-none"
                    >
                      <option value="DRAFT">DRAFT (Internal)</option>
                      <option value="ACTIVE">ACTIVE (Resmi Dijual)</option>
                      <option value="DEPRECATED">DEPRECATED (Usang)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink">Urutan Tampil (Display Order)</label>
                    <input
                      type="number"
                      min={0}
                      value={formDisplayOrder}
                      onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsPublished}
                        onChange={(e) => setFormIsPublished(e.target.checked)}
                        className="h-4 w-4 rounded border-ink/30 text-ink focus:ring-ink"
                      />
                      <span className="text-xs font-semibold text-ink">Publikasikan ke Publik</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-ink/10 pt-4">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="rounded-lg border border-ink/20 px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-ink px-5 py-2 text-sm font-semibold text-paper hover:bg-ink/90 disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Buat Paket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
