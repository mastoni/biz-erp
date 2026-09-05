'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  getPlatformKnowledgeList,
  createPlatformKnowledgeArticle,
  updatePlatformKnowledgeArticle,
  deletePlatformKnowledgeArticle,
  PLATFORM_PAGE_SIZE,
} from '@/features/platform/api';
import type {
  PlatformKnowledgeArticle,
  CreateKnowledgeArticleInput,
  UpdateKnowledgeArticleInput,
  KnowledgeListSummary,
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
  BookOpen,
  Search,
  Plus,
  RefreshCw,
  Edit2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Power,
  Sparkles,
  Tag,
  ArrowRight,
  X,
  Layers,
  HelpCircle,
} from 'lucide-react';
import Link from 'next/link';

const FALLBACK_ERROR = 'Terjadi kesalahan saat memproses data Knowledge Base AI CS.';
const PAGE_NOUN = 'artikel';

const CATEGORY_OPTIONS = [
  'ALL',
  'PLATFORM',
  'ERP',
  'POS',
  'ISP_MANAGEMENT',
  'CCTV_MANAGEMENT',
  'BILLING',
  'TROUBLESHOOTING',
];

export default function PlatformKnowledgeBasePage() {
  const [items, setItems] = useState<PlatformKnowledgeArticle[]>([]);
  const [summary, setSummary] = useState<KnowledgeListSummary>({
    total: 0,
    active_count: 0,
    inactive_count: 0,
  });
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [reloadKey, setReloadKey] = useState(0);
  const activeRef = useRef(true);

  // Modal State for Create / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<PlatformKnowledgeArticle | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formCategory, setFormCategory] = useState('PLATFORM');
  const [formContent, setFormContent] = useState('');
  const [formKeywords, setFormKeywords] = useState('');
  const [formPriority, setFormPriority] = useState(0);
  const [formIsPublic, setFormIsPublic] = useState(true);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const load = async (nextOffset: number) => {
    setLoading(true);
    setError(null);
    setRequestId(null);
    try {
      const data = await getPlatformKnowledgeList({
        limit: PLATFORM_PAGE_SIZE,
        offset: nextOffset,
        search: search.trim() || undefined,
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
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
      const info = getApiErrorInfo(err, FALLBACK_ERROR);
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
  }, [categoryFilter, statusFilter, reloadKey]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    load(0);
  };

  const handleRefresh = () => {
    setReloadKey((prev) => prev + 1);
  };

  const handleOpenCreateModal = () => {
    setEditingArticle(null);
    setFormTitle('');
    setFormCode('');
    setFormCategory('PLATFORM');
    setFormContent('');
    setFormKeywords('');
    setFormPriority(0);
    setFormIsPublic(true);
    setFormIsActive(true);
    setFormError(null);
    setFormSuccess(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (article: PlatformKnowledgeArticle) => {
    setEditingArticle(article);
    setFormTitle(article.title);
    setFormCode(article.code || '');
    setFormCategory(article.category);
    setFormContent(article.content);
    setFormKeywords(article.keywords ? article.keywords.join(', ') : '');
    setFormPriority(article.priority_order || 0);
    setFormIsPublic(article.is_public);
    setFormIsActive(article.is_active);
    setFormError(null);
    setFormSuccess(null);
    setModalOpen(true);
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSaving(true);
    setFormError(null);
    setFormSuccess(null);

    const keywordsArray = formKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    try {
      if (editingArticle) {
        const payload: UpdateKnowledgeArticleInput = {
          title: formTitle.trim(),
          code: formCode.trim() || null,
          category: formCategory,
          content: formContent.trim(),
          keywords: keywordsArray,
          priority_order: Number(formPriority),
          is_public: formIsPublic,
          is_active: formIsActive,
        };

        const res = await updatePlatformKnowledgeArticle(editingArticle.id, payload);
        setFormSuccess(res.message || 'Artikel berhasil diperbarui');
        // Update item in local state
        setItems((prev) =>
          prev.map((item) => (item.id === editingArticle.id ? res.article : item))
        );
      } else {
        const payload: CreateKnowledgeArticleInput = {
          title: formTitle.trim(),
          code: formCode.trim() || undefined,
          category: formCategory,
          content: formContent.trim(),
          keywords: keywordsArray,
          priority_order: Number(formPriority),
          is_public: formIsPublic,
          is_active: formIsActive,
        };

        const res = await createPlatformKnowledgeArticle(payload);
        setFormSuccess(res.message || 'Artikel berhasil dibuat');
        setReloadKey((k) => k + 1);
      }

      setTimeout(() => {
        setModalOpen(false);
      }, 700);
    } catch (err) {
      const info = getApiErrorInfo(err, 'Gagal menyimpan artikel knowledge.');
      setFormError(info.message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleToggleActive = async (article: PlatformKnowledgeArticle) => {
    try {
      if (article.is_active) {
        await deletePlatformKnowledgeArticle(article.id);
        setItems((prev) =>
          prev.map((item) => (item.id === article.id ? { ...item, is_active: false } : item))
        );
      } else {
        const res = await updatePlatformKnowledgeArticle(article.id, { is_active: true });
        setItems((prev) =>
          prev.map((item) => (item.id === article.id ? res.article : item))
        );
      }
      setReloadKey((k) => k + 1);
    } catch (err) {
      const info = getApiErrorInfo(err, 'Gagal memperbarui status aktif artikel.');
      alert(info.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink font-display flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-pine-600" />
              AI CS Knowledge Base
            </h1>
            <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
              Platform Authoritative
            </span>
          </div>
          <p className="text-sm text-ink/60 mt-1">
            Manajemen basis pengetahuan resmi untuk mesin pencocokan AI Customer Service lintas penyewa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/platform/ai-cs">
            <Button variant="outline" size="sm" className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-pine-600" />
              AI CS Settings
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Segarkan
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleOpenCreateModal}
            className="bg-pine-600 hover:bg-pine-700 text-white flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Tambah Artikel
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-ink/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink/60 uppercase">Total Artikel Knowledge</span>
            <span className="p-1.5 bg-pine-50 text-pine-600 rounded-md">
              <BookOpen className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-ink mt-2">{summary.total}</p>
          <p className="text-xs text-ink/40 mt-0.5">Basis data knowledge aktif & nonaktif</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-ink/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink/60 uppercase">Artikel Aktif</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-ink mt-2">{summary.active_count}</p>
          <p className="text-xs text-ink/40 mt-0.5">Digunakan saat pencocokan AI runtime</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-ink/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink/60 uppercase">Nonaktif / Dinonaktifkan</span>
            <span className="p-1.5 bg-slate-50 text-slate-600 rounded-md">
              <XCircle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-ink mt-2">{summary.inactive_count}</p>
          <p className="text-xs text-ink/40 mt-0.5">Tidak disertakan dalam prompt jawaban</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-ink/10 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
            <Input
              type="text"
              placeholder="Cari judul, konten, kode, atau kata kunci..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-sm bg-white border border-ink/10 rounded-md px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-pine-500"
              aria-label="Filter Kategori"
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'ALL' ? 'Semua Kategori' : cat}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-sm bg-white border border-ink/10 rounded-md px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-pine-500"
              aria-label="Filter Status"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Aktif (Active)</option>
              <option value="INACTIVE">Nonaktif (Inactive)</option>
            </select>

            <Button type="submit" size="sm" variant="default" className="bg-pine-600 hover:bg-pine-700 text-white">
              Cari
            </Button>
          </div>
        </form>
      </div>

      {/* Error Alert */}
      {shouldShowError(loading, error) && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Gagal Memuat Knowledge Base</p>
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

      {/* Table Content */}
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
            <BookOpen className="w-12 h-12 text-ink/20 mx-auto mb-3" />
            <p className="text-base font-medium text-ink">Belum Ada Artikel Knowledge Base</p>
            <p className="text-sm text-ink/50 mt-1 max-w-md mx-auto">
              Tidak ada artikel yang cocok dengan filter atau pencarian saat ini.
            </p>
          </div>
        )}

        {shouldShowTable(loading, error, items.length) && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Kode / ID</TableHead>
                  <TableHead className="w-[140px]">Kategori</TableHead>
                  <TableHead>Judul & Konten Jawaban</TableHead>
                  <TableHead className="w-[180px]">Kata Kunci (Keywords)</TableHead>
                  <TableHead className="w-[90px] text-center">Prioritas</TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead className="w-[120px] text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((article) => (
                  <TableRow key={article.id} className="hover:bg-ink/5 transition-colors">
                    <TableCell className="font-mono text-xs text-ink/70">
                      {article.code || article.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {article.category}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="font-medium text-sm text-ink">{article.title}</div>
                      <div className="text-xs text-ink/60 line-clamp-2 mt-0.5 whitespace-pre-wrap">
                        {article.content}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {article.keywords && article.keywords.length > 0 ? (
                          article.keywords.slice(0, 4).map((kw, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200"
                            >
                              <Tag className="w-2.5 h-2.5 mr-0.5" />
                              {kw}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-ink/40 italic">-</span>
                        )}
                        {article.keywords && article.keywords.length > 4 && (
                          <span className="text-[10px] text-ink/40">
                            +{article.keywords.length - 4}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      {article.priority_order}
                    </TableCell>
                    <TableCell>
                      {article.is_active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-300">
                          <XCircle className="w-3 h-3 mr-1 text-slate-500" />
                          INACTIVE
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEditModal(article)}
                        className="h-8 px-2 text-xs"
                      >
                        <Edit2 className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleActive(article)}
                        className={`h-8 px-2 text-xs ${
                          article.is_active
                            ? 'text-rose-600 hover:bg-rose-50'
                            : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={article.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        <Power className="w-3.5 h-3.5" />
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

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-ink/10">
            <div className="p-4 sm:p-6 border-b border-ink/10 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-pine-600" />
                <h2 className="text-lg font-bold text-ink font-display">
                  {editingArticle ? 'Edit Artikel Knowledge' : 'Tambah Artikel Knowledge Baru'}
                </h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-ink/40 hover:text-ink p-1 rounded-md"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveArticle} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-md">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {formSuccess}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">
                    Judul Artikel <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    required
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="contoh: Siklus Pembayaran Tagihan"
                    className="text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">
                    Kode Unik (Opsional)
                  </label>
                  <Input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="contoh: KB-BILL-02"
                    className="text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">
                    Kategori / Domain Layanan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full text-sm bg-white border border-ink/10 rounded-md px-3 py-2 text-ink focus:ring-2 focus:ring-pine-500"
                  >
                    {CATEGORY_OPTIONS.filter((c) => c !== 'ALL').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">
                    Prioritas Pencocokan (Angka Rendah = Prioritas Utama)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formPriority}
                    onChange={(e) => setFormPriority(Number(e.target.value))}
                    className="text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">
                  Kata Kunci Pencarian (Pisahkan dengan koma)
                </label>
                <Input
                  type="text"
                  value={formKeywords}
                  onChange={(e) => setFormKeywords(e.target.value)}
                  placeholder="tagihan, pembayaran, invoice, transfer"
                  className="text-sm"
                />
                <p className="text-[11px] text-ink/40 mt-1">
                  AI akan mencocokkan pertanyaan pengguna terhadap kata kunci ini.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">
                  Isi Jawaban / Penjelasan Knowledge <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Tuliskan jawaban atau panduan teknis yang jelas dan akurat..."
                  className="w-full text-sm p-3 bg-white border border-ink/10 rounded-md text-ink focus:ring-2 focus:ring-pine-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded border-ink/20 text-pine-600 focus:ring-pine-500"
                  />
                  <span>Status Aktif (Ikut serta dalam pencocokan AI)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={formIsPublic}
                    onChange={(e) => setFormIsPublic(e.target.checked)}
                    className="rounded border-ink/20 text-pine-600 focus:ring-pine-500"
                  />
                  <span>Akses Publik (Dapat dilihat semua tenant)</span>
                </label>
              </div>

              <div className="p-4 border-t border-ink/10 flex items-center justify-end gap-2 bg-slate-50/50 -mx-6 -mb-6 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalOpen(false)}
                  disabled={formSaving}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  disabled={formSaving}
                  className="bg-pine-600 hover:bg-pine-700 text-white flex items-center gap-1.5"
                >
                  {formSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Artikel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
