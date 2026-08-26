'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { useBranchContext } from '@/features/branches/BranchContext';
import {
  fetchInventoryStocks,
  fetchInventorySummary,
  fetchInventoryStock,
  adjustInventory,
  getApiErrorMessage,
} from '@/features/inventory/api';
import {
  applyInventoryFilters,
  buildInventoryAdjustmentPayload,
  classifyInventoryMutationError,
  resolveInventoryOffset,
} from '@/features/inventory/inventory-helpers';
import type {
  InventoryAdjustmentFormModel,
  InventoryFilterModel,
  InventoryMutationError,
  InventoryStockViewModel,
} from '@/features/inventory/types';
import { InventoryKPICards } from '@/features/inventory/components/InventoryKPICards';
import { InventoryToolbar } from '@/features/inventory/components/InventoryToolbar';
import { StockTable, StockTableSkeleton } from '@/features/inventory/components/StockTable';
import {
  StockAdjustmentModal,
  StockAdjustmentMode,
} from '@/features/inventory/components/StockAdjustmentModal';
import { MovementHistoryModal } from '@/features/inventory/components/MovementHistoryModal';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PackageSearch } from 'lucide-react';

const STOCK_FETCH_LIMIT = 1000;
const TABLE_PAGE_SIZE = 10;

const initialFilter: InventoryFilterModel = {};

interface ToastState {
  message: string;
  tone: 'success' | 'warn';
}

export default function InventoryPage() {
  const { business, isOwner } = useAuth();
  const { branches, activeBranch, branchStatus, selectBranch } = useBranchContext();

  const tenantId = business?.id ?? '';
  const branchId = activeBranch?.id ?? '';
  const canMutate = isOwner();

  // Branch-scoped server state. Cleared immediately on tenant/branch change so
  // stale stock is never displayed.
  const [stocks, setStocks] = useState<InventoryStockViewModel[]>([]);
  const [summary, setSummary] = useState<{
    total_stock_value_minor: number;
    low_stock_count: number;
    out_of_stock_count: number;
    total_skus: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [filter, setFilter] = useState<InventoryFilterModel>(initialFilter);
  const [pageOffset, setPageOffset] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<StockAdjustmentMode>('adjust');
  const [modalProductId, setModalProductId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictError, setConflictError] = useState<InventoryMutationError | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);
  const idempotencyKeyRef = React.useRef<string>(crypto.randomUUID());

  const showToast = useCallback((message: string, tone: ToastState['tone']) => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Load stocks + summary for the ACTIVE branch ───────────────────────────
  // Keyed by tenant + branch + reloadTick: any context change or mutation
  // refetch clears previous state first (never display old branch data).
  useEffect(() => {
    if (!tenantId || !branchId) return;

    let active = true;
    setStocks([]);
    setSummary(null);
    setError(null);
    setLoading(true);
    setPageOffset(0);

    const load = async () => {
      try {
        const [stockList, summaryData] = await Promise.all([
          fetchInventoryStocks(branchId, tenantId, { limit: STOCK_FETCH_LIMIT }),
          fetchInventorySummary(branchId, tenantId),
        ]);
        if (!active) return;
        setStocks(stockList.items);
        setSummary(summaryData);
      } catch (err) {
        if (!active) return;
        setError(getApiErrorMessage(err, 'Gagal memuat stok cabang'));
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [tenantId, branchId, reloadTick]);

  const handleRefresh = () => setReloadTick((t) => t + 1);

  const handleFilterChange = (next: InventoryFilterModel) => {
    setFilter(next);
    setPageOffset(0);
  };

  // ── Client-side filtering + pagination over the branch dataset ────────────
  const filtered = useMemo(
    () =>
      applyInventoryFilters(stocks, {
        search: filter.search,
        category: filter.category,
        status: filter.status,
      }),
    [stocks, filter.search, filter.category, filter.status]
  );

  const { limit: tableLimit, offset: tableOffsetResolved } = resolveInventoryOffset({
    page: undefined,
    limit: TABLE_PAGE_SIZE,
    offset: pageOffset,
  });
  const pagedStocks = filtered.slice(tableOffsetResolved, tableOffsetResolved + tableLimit);
  const hasMorePages = tableOffsetResolved + tableLimit < filtered.length;

  const categories = useMemo(
    () =>
      [...new Set(stocks.map((s) => s.category).filter((c): c is string => Boolean(c)))].sort(),
    [stocks]
  );

  const productNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of stocks) map.set(s.product_id, s.product_name);
    return map;
  }, [stocks]);

  // ── Modal orchestration ────────────────────────────────────────────────────

  const openModal = (mode: StockAdjustmentMode, productId?: string | null) => {
    setModalMode(mode);
    setModalProductId(productId ?? null);
    setConflictError(null);
    setValidationMessage(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalProductId(null);
    setConflictError(null);
    setValidationMessage(null);
  };

  // Idempotency lifecycle: rotate on success/conflict; keep on validation and
  // network errors so a retry deduplicates.
  const handleSubmit = async (form: InventoryAdjustmentFormModel) => {
    if (!tenantId || !branchId) return;
    setIsSubmitting(true);
    setConflictError(null);
    setValidationMessage(null);

    let payload;
    try {
      payload = buildInventoryAdjustmentPayload(form, tenantId, branchId);
    } catch (err) {
      setValidationMessage(err instanceof Error ? err.message : 'Payload tidak valid');
      setIsSubmitting(false);
      return;
    }

    try {
      await adjustInventory(payload, idempotencyKeyRef.current);
      idempotencyKeyRef.current = crypto.randomUUID(); // Rule 1: new key after success
      const verb =
        form.movement_type === 'STOCK_IN'
          ? 'ditambahkan'
          : form.movement_type === 'STOCK_OUT'
            ? 'dikurangi'
            : 'disesuaikan';
      showToast(`Stok ${verb}. Perubahan tercatat di riwayat.`, 'success');
      closeModal();
      setReloadTick((t) => t + 1);
    } catch (err) {
      const classified = classifyInventoryMutationError(err, 'Penyesuaian stok gagal');
      if (classified.type === 'conflict') {
        idempotencyKeyRef.current = crypto.randomUUID(); // Rule 2: new key after conflict
        setConflictError(classified);
      } else if (classified.type === 'validation') {
        setValidationMessage(classified.message); // Rule 3: keep key for retry
      } else {
        setValidationMessage(classified.message); // Rule 4: keep key on network error
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Conflict resolution: pull the freshest server_version for the product and
  // update the local row so the next attempt targets the current version.
  const handleResolveConflict = async (productId: string) => {
    if (!tenantId || !branchId) return;
    try {
      const fresh = await fetchInventoryStock(productId, branchId, tenantId);
      setStocks((prev) =>
        prev.map((s) =>
          s.product_id === productId
            ? { ...s, quantity: fresh.quantity, server_version: fresh.server_version }
            : s,
        ),
      );
      setConflictError(null);
      showToast('Versi stok terbaru dimuat. Silakan simpan ulang.', 'success');
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Gagal memuat versi terbaru'), 'warn');
    }
  };

  const hasFilter = Boolean(filter.search || filter.category || filter.status);
  const isLoadingBranches = branchStatus === 'loading' || branchStatus === 'switching';

  return (
    <div className="space-y-4">
      {/* Page header + tenant/branch context */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
            Inventaris
          </h1>
          <p className="mt-1 text-sm text-fog">
            Kelola stok, harga, dan pergerakan barang di gudang toko.
          </p>
          <p className="mt-1 text-xs text-fog/70">
            {business?.name ?? '—'}
            {activeBranch && (
              <>
                {' · Cabang aktif: '}
                <span className="font-medium text-ink">{activeBranch.name}</span>
              </>
            )}
            {branchStatus === 'switching' && ' · memuat…'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="label mb-0" htmlFor="inv-branch-select">Cabang</label>
          <select
            id="inv-branch-select"
            className="input w-auto py-2 text-[13px]"
            value={branchId}
            onChange={(e) => selectBranch(e.target.value)}
            disabled={isLoadingBranches}
          >
            {!activeBranch && <option value="">Pilih cabang</option>}
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI row */}
      <InventoryKPICards summary={summary} isLoading={loading || isLoadingBranches} />

      {/* Toolbar */}
      <InventoryToolbar
        filter={filter}
        onFilterChange={handleFilterChange}
        categories={categories}
        resultCount={filtered.length}
        onRefresh={handleRefresh}
        onStockIn={() => openModal('in')}
        onStockOut={() => openModal('out')}
        onAdjust={() => openModal('adjust')}
        canMutate={canMutate}
        disabled={loading || isLoadingBranches}
      />

      {/* Error */}
      {error && !loading && (
        <ErrorState message={error} onRetry={handleRefresh} />
      )}

      {/* Loading skeletons matching final table dimensions */}
      {(loading || isLoadingBranches) && !error && <StockTableSkeleton rows={6} />}

      {/* Empty branch / no stock */}
      {!loading && !isLoadingBranches && !error && stocks.length === 0 && (
        <EmptyState
          icon={<PackageSearch className="h-6 w-6" />}
          title="Belum ada stok di cabang ini"
          description="Stok akan muncul setelah ada penyesuaian stok masuk untuk produk Anda."
        />
      )}

      {/* No search results */}
      {!loading && !isLoadingBranches && !error && stocks.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={<PackageSearch className="h-6 w-6" />}
          title="Tidak ada produk yang cocok dengan filter"
          description="Ubah kata kunci pencarian atau reset filter."
          action={
            <button
              type="button"
              className="btn-outline px-4 py-2 text-xs"
              onClick={() => handleFilterChange(initialFilter)}
            >
              Reset Filter
            </button>
          }
        />
      )}

      {/* Stock grid/table */}
      {!loading && !isLoadingBranches && !error && filtered.length > 0 && (
        <>
          <StockTable
            stocks={pagedStocks}
            canMutate={canMutate}
            onAdjust={(product) => openModal('adjust', product.product_id)}
            onHistory={(product) => {
              setHistoryProductId(product.product_id);
              setHistoryOpen(true);
            }}
          />

          {(tableOffsetResolved > 0 || hasMorePages) && (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setPageOffset((o) => Math.max(0, o - TABLE_PAGE_SIZE))}
                disabled={tableOffsetResolved === 0}
                className="btn-outline px-3 py-2 text-[12px] disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <span className="num text-[12px] font-semibold text-fog">
                {filtered.length} item · halaman {Math.floor(tableOffsetResolved / TABLE_PAGE_SIZE) + 1}
              </span>
              <button
                type="button"
                onClick={() => setPageOffset((o) => o + TABLE_PAGE_SIZE)}
                disabled={!hasMorePages}
                className="btn-outline px-3 py-2 text-[12px] disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          )}
        </>
      )}

      {/* Stock adjustment / in / out modal */}
      <StockAdjustmentModal
        open={modalOpen}
        onClose={closeModal}
        mode={modalMode}
        stocks={stocks}
        initialProductId={modalProductId}
        isSubmitting={isSubmitting}
        conflictError={conflictError}
        validationMessage={validationMessage}
        onSubmit={handleSubmit}
        onResolveConflict={handleResolveConflict}
      />

      {/* Movement history modal */}
      <MovementHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        tenantId={tenantId}
        branchId={branchId}
        branchName={activeBranch?.name}
        productNameById={productNameById}
        initialProductId={historyProductId}
      />

      {/* Success/warn toast */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-4 right-4 z-50 rounded-lg border px-4 py-2.5 text-xs shadow-lg ${
            toast.tone === 'success'
              ? 'border-pine bg-pine-soft text-pine'
              : 'border-clay bg-clay-soft text-clay'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
