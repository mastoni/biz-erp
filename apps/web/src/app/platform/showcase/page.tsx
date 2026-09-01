'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  getPlatformShowcase,
  getPlatformShowcaseById,
  createPlatformShowcaseItem,
  updatePlatformShowcaseItem,
  setPlatformShowcasePublish,
  deletePlatformShowcaseItem,
  getPublicShowcase,
  getPlatformPlans,
  getPlatformBundles,
} from '@/features/platform/api';
import { PlatformShowcaseItem, PlatformPlan, PlatformBundle } from '@/features/platform/types';
import { formatMinor } from '@/lib/format';

const SECTIONS = [
  { key: 'ALL', label: 'Semua Section' },
  { key: 'HERO_FEATURED', label: 'Hero Featured' },
  { key: 'ERP_PLANS', label: 'ERP Plans' },
  { key: 'ISP_PLANS', label: 'ISP Plans' },
  { key: 'BUNDLES', label: 'Bundles' },
  { key: 'HARDWARE', label: 'Hardware' },
  { key: 'PROMOS', label: 'Promos' },
];

export default function PlatformShowcasePage() {
  const [items, setItems] = useState<PlatformShowcaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('ALL');

  // Preview Modal state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewItems, setPreviewItems] = useState<PlatformShowcaseItem[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Drawer / Editor state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Target options from DB
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [bundles, setBundles] = useState<PlatformBundle[]>([]);

  // Form fields
  const [formSection, setFormSection] = useState<'HERO_FEATURED' | 'ERP_PLANS' | 'ISP_PLANS' | 'BUNDLES' | 'HARDWARE' | 'PROMOS'>('ERP_PLANS');
  const [formItemType, setFormItemType] = useState<'PLAN' | 'BUNDLE' | 'CATALOG_PRODUCT' | 'CUSTOM'>('PLAN');
  const [formPlanCode, setFormPlanCode] = useState('');
  const [formBundleCode, setFormBundleCode] = useState('');
  const [formCatalogCode, setFormCatalogCode] = useState('ISP_50M');
  const [formCustomCode, setFormCustomCode] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formHeadline, setFormHeadline] = useState('');
  const [formMarketingBadge, setFormMarketingBadge] = useState('');
  const [formFeaturesText, setFormFeaturesText] = useState('Kasir Cepat Offline\nLaporan Keuangan Otomatis\nMulti Cabang & Gudang');
  const [formDisplayOrder, setFormDisplayOrder] = useState(1);
  const [formIsFeatured, setFormIsFeatured] = useState(false);
  const [formIsPublished, setFormIsPublished] = useState(true);
  const [formCtaText, setFormCtaText] = useState('Coba Gratis 14 Hari');
  const [formCtaUrl, setFormCtaUrl] = useState('/register');

  const fetchShowcase = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getPlatformShowcase({
        section: activeSection === 'ALL' ? undefined : activeSection,
      });
      setItems(res.items);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Akses ditolak: Hanya Superadmin yang memiliki izin mengelola etalase.');
      } else {
        setError(err.response?.data?.error?.message || 'Gagal memuat etalase.');
      }
    } finally {
      setLoading(false);
    }
  }, [activeSection]);

  useEffect(() => {
    fetchShowcase();
  }, [fetchShowcase]);

  useEffect(() => {
    getPlatformPlans({ status: 'ACTIVE', limit: 100 })
      .then((res) => {
        setPlans(res.items);
        if (res.items.length > 0 && !formPlanCode) setFormPlanCode(res.items[0].code);
      })
      .catch(() => {});

    getPlatformBundles({ status: 'ACTIVE', limit: 100 })
      .then((res) => {
        setBundles(res.items);
        if (res.items.length > 0 && !formBundleCode) setFormBundleCode(res.items[0].code);
      })
      .catch(() => {});
  }, []);

  const openCreateDrawer = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormSection(activeSection === 'ALL' ? 'ERP_PLANS' : (activeSection as any));
    setFormItemType('PLAN');
    setFormDisplayName('');
    setFormHeadline('');
    setFormMarketingBadge('PALING POPULER');
    setFormFeaturesText('Kasir Cepat Offline\nLaporan Keuangan Otomatis\nMulti Cabang');
    setFormDisplayOrder(1);
    setFormIsFeatured(false);
    setFormIsPublished(true);
    setFormCtaText('Coba Gratis 14 Hari');
    setFormCtaUrl('/register');
    setFormError(null);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = async (id: string) => {
    try {
      setLoading(true);
      const item = await getPlatformShowcaseById(id);
      setIsEditing(true);
      setEditingId(item.id);
      setFormSection(item.section);
      setFormItemType(item.item_type);
      setFormPlanCode(item.plan_code || '');
      setFormBundleCode(item.bundle_code || '');
      setFormCatalogCode(item.catalog_product_code || 'ISP_50M');
      setFormCustomCode(item.custom_item_code || '');
      setFormDisplayName(item.display_name);
      setFormHeadline(item.headline || '');
      setFormMarketingBadge(item.marketing_badge || '');
      setFormFeaturesText(item.features_list?.join('\n') || '');
      setFormDisplayOrder(item.display_order);
      setFormIsFeatured(Boolean(item.is_featured));
      setFormIsPublished(Boolean(item.is_published));
      setFormCtaText(item.cta_text || 'Pilih Paket');
      setFormCtaUrl(item.cta_url || '/register');
      setFormError(null);
      setIsDrawerOpen(true);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Gagal memuat detail showcase');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublish = async (id: string, currentStatus: boolean) => {
    try {
      await setPlatformShowcasePublish(id, !currentStatus);
      await fetchShowcase();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Gagal mengubah status publish');
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`Hapus penempatan etalase "${name}"? Master paket tidak akan terhapus.`)) return;
    try {
      await deletePlatformShowcaseItem(id);
      await fetchShowcase();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Gagal menghapus penempatan showcase');
    }
  };

  const handleSaveShowcase = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    const featuresList = formFeaturesText
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);

    const payload: Partial<PlatformShowcaseItem> = {
      section: formSection,
      item_type: formItemType,
      plan_code: formItemType === 'PLAN' ? formPlanCode : null,
      bundle_code: formItemType === 'BUNDLE' ? formBundleCode : null,
      catalog_product_code: formItemType === 'CATALOG_PRODUCT' ? formCatalogCode : null,
      custom_item_code: formItemType === 'CUSTOM' ? formCustomCode : null,
      display_name: formDisplayName,
      headline: formHeadline || null,
      marketing_badge: formMarketingBadge || null,
      features_list: featuresList,
      display_order: formDisplayOrder,
      is_featured: formIsFeatured,
      is_published: formIsPublished,
      cta_text: formCtaText,
      cta_url: formCtaUrl,
    };

    try {
      if (isEditing && editingId) {
        await updatePlatformShowcaseItem(editingId, payload);
      } else {
        await createPlatformShowcaseItem(payload);
      }

      setIsDrawerOpen(false);
      await fetchShowcase();
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Gagal menyimpan penempatan etalase.');
    } finally {
      setSaving(false);
    }
  };

  const openPreview = async () => {
    setIsPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const res = await getPublicShowcase(activeSection === 'ALL' ? undefined : activeSection);
      setPreviewItems(res.items);
    } catch (err: any) {
      console.error(err);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink">Landing Showcase Control Center</h1>
          <p className="text-sm text-ink/60">
            Pusat tata kelola etalase publik Landing Page, urutan penayangan, badge marketing, dan preview langsung.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openPreview}
            className="inline-flex items-center gap-2 rounded-lg border border-ink/20 bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-xs hover:bg-ink/5"
          >
            👁️ Preview Landing Page
          </button>
          <button
            onClick={openCreateDrawer}
            className="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-paper shadow-sm hover:bg-ink/90 transition-all"
          >
            + Tambah Penempatan
          </button>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-ink/10 pb-2">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeSection === s.key ? 'bg-ink text-paper shadow-xs' : 'text-ink/60 hover:bg-ink/5 hover:text-ink'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Showcase Table */}
      <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink/10 text-left text-sm text-ink">
            <thead className="bg-ink/[0.02] font-semibold text-ink/70">
              <tr>
                <th className="px-4 py-3.5">Urutan & Section</th>
                <th className="px-4 py-3.5">Target Entitas</th>
                <th className="px-4 py-3.5">Judul Etalase & Headline</th>
                <th className="px-4 py-3.5">Badge Marketing</th>
                <th className="px-4 py-3.5">Fitur Unggulan</th>
                <th className="px-4 py-3.5">Publikasi</th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink/50">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                    <p className="mt-2 text-xs">Memuat penempatan etalase...</p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink/50">
                    Belum ada item yang ditempatkan di section ini.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-ink/[0.01] transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-ink">#{item.display_order}</div>
                      <span className="inline-flex rounded bg-ink/5 px-2 py-0.5 text-[10px] font-medium text-ink/70">
                        {item.section}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        {item.item_type}
                      </span>
                      <div className="font-mono text-xs text-ink/80 mt-0.5">
                        {item.plan_code || item.bundle_code || item.catalog_product_code || item.custom_item_code}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{item.display_name}</div>
                      {item.headline && <div className="text-xs text-ink/60 line-clamp-1">{item.headline}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {item.marketing_badge ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                          {item.marketing_badge}
                        </span>
                      ) : (
                        <span className="text-ink/30 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink/70">
                      {item.features_list?.length || 0} poin keunggulan
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleTogglePublish(item.id, item.is_published)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                          item.is_published
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${item.is_published ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {item.is_published ? 'Tayang (Live)' : 'Draft'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditDrawer(item.id)}
                          className="rounded border border-ink/20 px-2 py-1 text-xs font-semibold text-ink hover:bg-ink/5"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id, item.display_name)}
                          className="rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer Placement Editor */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-ink/10 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-ink font-display">
                  {isEditing ? 'Edit Penempatan Etalase' : 'Tambah Penempatan Landing Page'}
                </h2>
                <p className="text-xs text-ink/50">Atur copywriting marketing dan posisi tayang publik</p>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="rounded-lg p-2 text-ink/50 hover:bg-ink/5 hover:text-ink"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="m-6 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveShowcase} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Section Placement */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink">Section Penempatan</label>
                  <select
                    value={formSection}
                    onChange={(e) => setFormSection(e.target.value as any)}
                    className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink font-semibold"
                  >
                    <option value="HERO_FEATURED">Hero Featured (Beranda Utama)</option>
                    <option value="ERP_PLANS">ERP Plans (Katalog Paket ERP)</option>
                    <option value="ISP_PLANS">ISP Plans (Katalog Internet)</option>
                    <option value="BUNDLES">Bundles (Paket Promo Gabungan)</option>
                    <option value="HARDWARE">Hardware (Perangkat POS/CCTV)</option>
                    <option value="PROMOS">Promos & Diskon Khusus</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink">Tipe Target Entitas</label>
                  <select
                    value={formItemType}
                    onChange={(e) => setFormItemType(e.target.value as any)}
                    className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink font-semibold"
                  >
                    <option value="PLAN">Paket Layanan ERP (PLAN)</option>
                    <option value="BUNDLE">Commercial Bundle</option>
                    <option value="CATALOG_PRODUCT">Catalog Product (ISP/Alat)</option>
                    <option value="CUSTOM">Custom Banner Promo</option>
                  </select>
                </div>
              </div>

              {/* Target Selector */}
              <div>
                <label className="block text-xs font-semibold text-ink">Pilih Target Entitas</label>
                {formItemType === 'PLAN' ? (
                  <select
                    value={formPlanCode}
                    onChange={(e) => setFormPlanCode(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink"
                  >
                    {plans.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name} ({p.code}) — {formatMinor(p.pricing?.final_price || 0)}
                      </option>
                    ))}
                  </select>
                ) : formItemType === 'BUNDLE' ? (
                  <select
                    value={formBundleCode}
                    onChange={(e) => setFormBundleCode(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink"
                  >
                    {bundles.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name} ({b.code}) — {formatMinor(b.pricing?.monthly || 0)}/bln
                      </option>
                    ))}
                  </select>
                ) : formItemType === 'CATALOG_PRODUCT' ? (
                  <select
                    value={formCatalogCode}
                    onChange={(e) => setFormCatalogCode(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink"
                  >
                    <option value="ISP_50M">Internet Bisnis 50 Mbps (ISP_50M)</option>
                    <option value="ROUTER_MIKROTIK">Router MikroTik hEX (ROUTER_MIKROTIK)</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formCustomCode}
                    onChange={(e) => setFormCustomCode(e.target.value)}
                    placeholder="e.g. PROMO_RAMADHAN_2026"
                    className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink"
                  />
                )}
              </div>

              {/* Marketing Copy */}
              <div className="space-y-3 rounded-xl border border-ink/10 bg-ink/[0.01] p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60 border-b border-ink/10 pb-1">
                  Copywriting & Visual Marketing
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-ink">Judul Tampil di Landing Page</label>
                  <input
                    type="text"
                    value={formDisplayName}
                    onChange={(e) => setFormDisplayName(e.target.value)}
                    placeholder="e.g. Paket Juara UMKM"
                    required
                    className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink">Sub-Headline / Keterangan Singkat</label>
                  <input
                    type="text"
                    value={formHeadline}
                    onChange={(e) => setFormHeadline(e.target.value)}
                    placeholder="e.g. Solusi terlengkap kasir cepat dan pembukuan toko grosir"
                    className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink">Badge Promo (Ribbon)</label>
                    <input
                      type="text"
                      value={formMarketingBadge}
                      onChange={(e) => setFormMarketingBadge(e.target.value)}
                      placeholder="e.g. PALING POPULER, HEMAT 20%"
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink">Urutan Tampil (Display Order)</label>
                    <input
                      type="number"
                      min={0}
                      value={formDisplayOrder}
                      onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink">Poin-Poin Keunggulan (1 baris per poin)</label>
                  <textarea
                    rows={4}
                    value={formFeaturesText}
                    onChange={(e) => setFormFeaturesText(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-xs font-mono text-ink"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink">Teks Tombol CTA</label>
                    <input
                      type="text"
                      value={formCtaText}
                      onChange={(e) => setFormCtaText(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink">Target URL CTA</label>
                    <input
                      type="text"
                      value={formCtaUrl}
                      onChange={(e) => setFormCtaUrl(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm text-ink"
                    />
                  </div>
                </div>
              </div>

              {/* Publish toggle */}
              <div className="flex items-center justify-between border-t border-ink/10 pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsPublished}
                    onChange={(e) => setFormIsPublished(e.target.checked)}
                    className="h-4 w-4 rounded border-ink/30 text-ink focus:ring-ink"
                  />
                  <span className="text-xs font-bold text-ink">Tayangkan Langsung ke Publik</span>
                </label>
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
                  {saving ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Terbitkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Landing Page Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink/10 bg-ink/[0.02] px-6 py-4">
              <div>
                <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  LIVE PUBLIC PREVIEW
                </span>
                <h2 className="text-lg font-bold text-ink font-display mt-1">
                  Preview Tampilan Landing Page Publik
                </h2>
              </div>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-lg p-2 text-ink/50 hover:bg-ink/5 hover:text-ink font-bold"
              >
                ✕ Tutup
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-paper">
              {previewLoading ? (
                <div className="py-24 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-ink border-t-transparent" />
                  <p className="mt-2 text-xs text-ink/60">Mengambil data dari API publik...</p>
                </div>
              ) : previewItems.length === 0 ? (
                <div className="py-24 text-center text-ink/50">
                  Tidak ada item yang sedang tayang (is_published = true dengan target ACTIVE) di section ini.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {previewItems.map((p) => {
                    const price = Number(p.pricing?.final_price ?? p.pricing?.base_price ?? p.pricing?.monthly ?? 0);
                    return (
                      <div
                        key={p.id}
                        className="relative flex flex-col justify-between rounded-2xl border border-ink/10 bg-white p-6 shadow-md transition-all hover:shadow-xl hover:-translate-y-1"
                      >
                        {p.marketing_badge && (
                          <div className="absolute -top-3 right-6 rounded-full bg-amber-500 px-3 py-0.5 text-xs font-bold text-white shadow-xs">
                            {p.marketing_badge}
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider text-ink/40">
                            {p.section} · {p.item_type}
                          </div>
                          <h3 className="mt-2 text-xl font-bold text-ink font-display">{p.display_name}</h3>
                          {p.headline && <p className="mt-1 text-xs text-ink/60">{p.headline}</p>}

                          <div className="mt-4 border-t border-b border-ink/5 py-3">
                            <span className="text-2xl font-extrabold text-ink font-display">
                              {formatMinor(price)}
                            </span>
                            <span className="text-xs text-ink/50 ml-1">/bulan</span>
                          </div>

                          <ul className="mt-4 space-y-2 text-xs text-ink/80">
                            {p.features_list.map((f, idx) => (
                              <li key={idx} className="flex items-center gap-2">
                                <span className="text-emerald-500 font-bold">✓</span>
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="mt-6 pt-4 border-t border-ink/5">
                          <button
                            type="button"
                            className="w-full rounded-xl bg-ink py-2.5 text-center text-xs font-bold text-paper shadow-sm hover:bg-ink/90"
                          >
                            {p.cta_text}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
