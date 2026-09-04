'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  getPlatformBundles,
  getPlatformBundleByCode,
  createPlatformBundle,
  updatePlatformBundle,
  setPlatformBundleStatus,
  setPlatformBundleItems,
  getPlatformPlans,
} from '@/features/platform/api';
import { PlatformBundle, PlatformPlan, BundleItem } from '@/features/platform/types';
import { formatMinor } from '@/lib/format';

export default function PlatformBundlesPage() {
  const [bundles, setBundles] = useState<PlatformBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'ACTIVE' | 'DEPRECATED'>('ALL');
  const [summary, setSummary] = useState({ total: 0, active_count: 0, draft_count: 0, deprecated_count: 0 });

  // Composer Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);

  // Available Items for composition
  const [availablePlans, setAvailablePlans] = useState<PlatformPlan[]>([]);

  // Form fields
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formTargetSegment, setFormTargetSegment] = useState('RETAIL');
  const [formInstallationRequired, setFormInstallationRequired] = useState(true);
  const [formOneTimePrice, setFormOneTimePrice] = useState<number>(1000000);
  const [formMonthlyPrice, setFormMonthlyPrice] = useState<number>(550000);
  const [formCommitmentMonths, setFormCommitmentMonths] = useState<number>(12);
  const [formStatus, setFormStatus] = useState<'DRAFT' | 'ACTIVE' | 'DEPRECATED'>('DRAFT');
  const [formIsPublished, setFormIsPublished] = useState(false);
  const [formDisplayOrder, setFormDisplayOrder] = useState(1);
  const [formItems, setFormItems] = useState<BundleItem[]>([]);
  const [formVersion, setFormVersion] = useState<number>(1);

  const fetchBundles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getPlatformBundles({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: search || undefined,
      });
      setBundles(res.items);
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Akses ditolak: Hanya Superadmin yang memiliki izin mengelola bundle.');
      } else {
        setError(err.response?.data?.error?.message || 'Gagal memuat daftar bundle.');
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchBundles();
  }, [fetchBundles]);

  useEffect(() => {
    getPlatformPlans({ status: 'ACTIVE', limit: 100 })
      .then((res) => setAvailablePlans(res.items))
      .catch(() => {});
  }, []);

  const openCreateDrawer = () => {
    setIsEditing(false);
    setFormCode('');
    setFormName('');
    setFormTargetSegment('RETAIL');
    setFormInstallationRequired(true);
    setFormOneTimePrice(1000000);
    setFormMonthlyPrice(550000);
    setFormCommitmentMonths(12);
    setFormStatus('DRAFT');
    setFormIsPublished(false);
    setFormDisplayOrder(1);
    setFormItems([]);
    setFormVersion(1);
    setFormError(null);
    setConflictNotice(null);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = async (code: string) => {
    try {
      setLoading(true);
      const bundle = await getPlatformBundleByCode(code);
      setIsEditing(true);
      setFormCode(bundle.code);
      setFormName(bundle.name);
      setFormTargetSegment(bundle.target_segment || 'RETAIL');
      setFormInstallationRequired(Boolean(bundle.installation_required));
      setFormOneTimePrice(Number(bundle.pricing?.one_time || 0));
      setFormMonthlyPrice(Number(bundle.pricing?.monthly || 0));
      setFormCommitmentMonths(Number(bundle.pricing?.commitment_months || 12));
      setFormStatus(bundle.status || 'DRAFT');
      setFormIsPublished(Boolean(bundle.is_published));
      setFormDisplayOrder(Number(bundle.display_order || 0));
      setFormItems(bundle.items || []);
      setFormVersion(bundle.version || 1);
      setFormError(null);
      setConflictNotice(null);
      setIsDrawerOpen(true);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Gagal memuat detail bundle');
    } finally {
      setLoading(false);
    }
  };

  const addItemToBundle = (type: 'PLAN' | 'PRODUCT' | 'HARDWARE' | 'SERVICE', itemCode: string) => {
    if (formItems.some((i) => i.item_type === type && i.item_code === itemCode)) return;
    setFormItems((prev) => [...prev, { item_type: type, item_code: itemCode, quantity: 1, required: true }]);
  };

  const removeItemFromBundle = (index: number) => {
    setFormItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    const validQty = Math.max(1, quantity);
    setFormItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, quantity: validQty } : item))
    );
  };

  const handleSaveBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setConflictNotice(null);

    if (formStatus === 'ACTIVE' && formItems.length === 0) {
      setFormError('Bundle aktif wajib memiliki minimal 1 item penyusun.');
      return;
    }

    setSaving(true);

    try {
      if (isEditing) {
        await updatePlatformBundle(formCode, {
          name: formName,
          target_segment: formTargetSegment,
          installation_required: formInstallationRequired,
          is_published: formIsPublished,
          display_order: formDisplayOrder,
          pricing: {
            one_time: formOneTimePrice,
            monthly: formMonthlyPrice,
            commitment_months: formCommitmentMonths,
          },
          expected_version: formVersion,
        });

        await setPlatformBundleItems(formCode, formItems);
        await setPlatformBundleStatus(formCode, formStatus);
      } else {
        await createPlatformBundle({
          code: formCode,
          name: formName,
          target_segment: formTargetSegment,
          installation_required: formInstallationRequired,
          status: formStatus,
          is_published: formIsPublished,
          display_order: formDisplayOrder,
          pricing: {
            one_time: formOneTimePrice,
            monthly: formMonthlyPrice,
            commitment_months: formCommitmentMonths,
          },
        });

        if (formItems.length > 0) {
          await setPlatformBundleItems(formCode, formItems);
        }
      }

      setIsDrawerOpen(false);
      await fetchBundles();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setConflictNotice('Bundle ini telah diperbarui oleh administrator lain. Muat ulang sebelum menyimpan.');
      } else {
        setFormError(err.response?.data?.error?.message || 'Gagal menyimpan bundle.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink">Bundle Composer</h1>
          <p className="text-sm text-ink/60">
            Pusat peracik paket komersial gabungan (Software ERP + Bandwidth Internet + Hardware CCTV/Router).
          </p>
        </div>
        <button
          onClick={openCreateDrawer}
          className="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-paper shadow-sm hover:bg-ink/90 transition-all"
        >
          + Racik Bundle Baru
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-ink/50">Total Bundle</p>
          <p className="mt-2 text-2xl font-bold text-ink font-display">{summary.total}</p>
        </div>
        <div className="rounded-xl border border-teal-500/20 bg-teal-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-teal-700">Bundle Aktif</p>
          <p className="mt-2 text-2xl font-bold text-teal-800 font-display">{summary.active_count}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-700">Draft Komposisi</p>
          <p className="mt-2 text-2xl font-bold text-amber-800 font-display">{summary.draft_count}</p>
        </div>
        <div className="rounded-xl border border-gray-400/20 bg-gray-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-600">Deprecated</p>
          <p className="mt-2 text-2xl font-bold text-gray-700 font-display">{summary.deprecated_count}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
        <input
          type="text"
          placeholder="Cari kode atau nama bundle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs rounded-lg border border-ink/20 px-3 py-2 text-sm placeholder-ink/40 focus:border-ink focus:outline-none"
        />
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
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Bundles Table */}
      <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink/10 text-left text-sm text-ink">
            <thead className="bg-ink/[0.02] font-semibold text-ink/70">
              <tr>
                <th className="px-4 py-3.5">Kode & Nama Bundle</th>
                <th className="px-4 py-3.5">Target Segmen</th>
                <th className="px-4 py-3.5">Biaya Awal / Perangkat (One-Time)</th>
                <th className="px-4 py-3.5">Langganan ERP / Bulan (Monthly)</th>
                <th className="px-4 py-3.5">Komposisi Item</th>
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
                    <p className="mt-2 text-xs">Memuat katalog bundle...</p>
                  </td>
                </tr>
              ) : bundles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-ink/50">
                    Belum ada bundle komersial yang diracik.
                  </td>
                </tr>
              ) : (
                bundles.map((b) => (
                  <tr key={b.code} className="hover:bg-ink/[0.01] transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{b.name}</div>
                      <div className="font-mono text-xs text-ink/50">{b.code}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded bg-ink/5 px-2 py-0.5 text-xs font-medium text-ink">
                        {b.target_segment || 'RETAIL'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{formatMinor(b.pricing?.one_time || 0)}</div>
                      <div className="text-[10px] text-ink/50">Biaya perangkat & setup</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{formatMinor(b.pricing?.monthly || 0)} /bln</div>
                      <div className="text-[11px] text-ink/50">Kontrak {b.pricing?.commitment_months || 12} bln</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink/70">
                      {b.item_count || 0} item terpasang
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          b.status === 'ACTIVE'
                            ? 'bg-teal-100 text-teal-800'
                            : b.status === 'DRAFT'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {b.is_published ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          Tayang #{b.display_order}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-ink/40">
                          <span className="h-2 w-2 rounded-full bg-ink/20" />
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditDrawer(b.code)}
                        className="rounded-lg border border-ink/20 px-2.5 py-1 text-xs font-semibold text-ink hover:bg-ink/5"
                      >
                        Racik / Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bundle Composer Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-ink/10 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-ink font-display">
                  {isEditing ? `Edit Komposisi: ${formName}` : 'Racik Bundle Komersial Baru'}
                </h2>
                <p className="text-xs text-ink/50">Komposisi multi-item dengan skema harga bundel independen</p>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="rounded-lg p-2 text-ink/50 hover:bg-ink/5 hover:text-ink"
              >
                ✕
              </button>
            </div>

            {conflictNotice && (
              <div className="m-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
                <p className="font-bold">⚠️ Konflik Modifikasi</p>
                <p className="mt-1">{conflictNotice}</p>
              </div>
            )}

            {formError && (
              <div className="m-6 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveBundle} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60 border-b border-ink/10 pb-1">
                  1. Identitas Bundle
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-ink">Kode Bundle (Unique)</label>
                    <input
                      type="text"
                      disabled={isEditing}
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                      placeholder="e.g. SMART_STORE_BUNDLE"
                      required
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm font-mono uppercase text-ink focus:border-ink focus:outline-none disabled:bg-ink/5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink">Nama Bundle</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Paket Toko Cerdas Pro"
                      required
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink">Target Segmen</label>
                    <input
                      type="text"
                      value={formTargetSegment}
                      onChange={(e) => setFormTargetSegment(e.target.value)}
                      placeholder="e.g. RETAIL_STORE, CAFE_RESTO"
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formInstallationRequired}
                        onChange={(e) => setFormInstallationRequired(e.target.checked)}
                        className="h-4 w-4 rounded border-ink/30 text-ink focus:ring-ink"
                      />
                      <span className="text-xs font-semibold text-ink">Wajib Jasa Instalasi Fisik</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Composition Builder */}
              <div className="space-y-4 rounded-xl border border-ink/10 bg-ink/[0.01] p-4">
                <div className="flex items-center justify-between border-b border-ink/10 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">
                    2. Komposisi Item Penyusun ({formItems.length} Terpilih)
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => addItemToBundle('PRODUCT', 'ISP_50M')}
                      className="rounded bg-ink/5 px-2 py-1 text-[11px] font-semibold text-ink hover:bg-ink/10"
                    >
                      + Internet 50M
                    </button>
                    <button
                      type="button"
                      onClick={() => addItemToBundle('HARDWARE', 'ROUTER_MIKROTIK')}
                      className="rounded bg-ink/5 px-2 py-1 text-[11px] font-semibold text-ink hover:bg-ink/10"
                    >
                      + Router MikroTik
                    </button>
                  </div>
                </div>

                {/* Available Active Plans quick adder */}
                <div className="flex flex-wrap gap-2 items-center text-xs">
                  <span className="text-ink/50 text-[11px]">Tambah Paket ERP:</span>
                  {availablePlans.map((p) => (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => addItemToBundle('PLAN', p.code)}
                      className="rounded-full border border-ink/20 px-2.5 py-0.5 text-[11px] font-medium text-ink hover:border-ink"
                    >
                      + {p.name}
                    </button>
                  ))}
                </div>

                {/* Selected Items List */}
                <div className="space-y-2 pt-2">
                  {formItems.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-ink/20 p-4 text-center text-xs text-ink/50">
                      Belum ada item yang dimasukkan ke dalam racikan bundle ini.
                    </div>
                  ) : (
                    formItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg border border-ink/10 bg-white p-3 shadow-xs"
                      >
                        <div>
                          <span
                            className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold font-mono ${
                              item.item_type === 'PLAN'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : item.item_type === 'HARDWARE'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : item.item_type === 'SERVICE'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-800 border border-slate-200'
                            }`}
                          >
                            [{item.item_type}]
                          </span>
                          <span className="ml-2 text-xs font-semibold text-ink">{item.item_code}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-ink/50">Qty:</span>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => updateItemQuantity(idx, Number(e.target.value))}
                              className="w-14 rounded border border-ink/20 px-2 py-1 text-xs text-center font-bold text-ink"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItemFromBundle(idx)}
                            className="text-xs text-red-600 hover:text-red-800 font-semibold"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Independent Pricing */}
              <div className="space-y-4 rounded-xl border border-ink/10 bg-ink/[0.01] p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60 border-b border-ink/10 pb-1">
                  3. Harga Bundel Mandiri (IDR Integer)
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink">Biaya Pasang (One-Time)</label>
                    <input
                      type="number"
                      min={0}
                      value={formOneTimePrice}
                      onChange={(e) => setFormOneTimePrice(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm font-semibold text-ink"
                    />
                    <span className="text-[10px] text-ink/50">{formatMinor(formOneTimePrice)}</span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink">Biaya Bulanan (Monthly)</label>
                    <input
                      type="number"
                      min={0}
                      value={formMonthlyPrice}
                      onChange={(e) => setFormMonthlyPrice(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm font-semibold text-ink"
                    />
                    <span className="text-[10px] text-ink/50">{formatMinor(formMonthlyPrice)} /bln</span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink">Komitmen Kontrak (Bulan)</label>
                    <input
                      type="number"
                      min={1}
                      value={formCommitmentMonths}
                      onChange={(e) => setFormCommitmentMonths(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink"
                    />
                  </div>
                </div>
              </div>

              {/* Governance & Publish */}
              <div className="grid grid-cols-3 gap-4 border-t border-ink/10 pt-4">
                <div>
                  <label className="block text-xs font-semibold text-ink">Status State Machine</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm font-semibold text-ink"
                  >
                    <option value="DRAFT">DRAFT (Internal)</option>
                    <option value="ACTIVE">ACTIVE (Resmi Dijual)</option>
                    <option value="DEPRECATED">DEPRECATED (Usang)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink">Urutan Tampil (Order)</label>
                  <input
                    type="number"
                    min={0}
                    value={formDisplayOrder}
                    onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink"
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
                    <span className="text-xs font-semibold text-ink">Publikasikan</span>
                  </label>
                </div>
              </div>

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
                  {saving ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Buat Bundle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
