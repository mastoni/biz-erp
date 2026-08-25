'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { useBranchContext } from '@/features/branches/BranchContext';
import {
  fetchProducts,
  fetchProduct,
  fetchBranchStocks,
  createProduct,
  updateProduct,
  deactivateProduct,
} from '@/features/products/api';
import { mapProductToViewModel, getStockStatus, classifyProductError } from '@/features/products/viewmodel';
import {
  ProductViewModel,
  ProductFilterModel,
  ProductDataState,
  ProductOperationError,
  ProductFormModel,
} from '@/features/products/types';
import { ProductsToolbar } from '@/features/products/components/ProductsToolbar';
import { ProductGrid } from '@/features/products/components/ProductGrid';
import { ProductPagination } from '@/features/products/components/ProductPagination';
import { ProductFormModal } from '@/features/products/components/ProductFormModal';
import { DeactivateConfirmModal } from '@/features/products/components/DeactivateConfirmModal';
import { ProductEmptyState } from '@/features/products/components/ProductEmptyState';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { PRODUCTS_PAGE_SIZE, filterProducts } from '@/features/products/products-helpers';
import { AxiosError } from 'axios';

const initialFilter: ProductFilterModel = {
  search: '',
  category: '',
  barcode: '',
};

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { business, isOwner } = useAuth();
  const { activeBranch, branchStatus } = useBranchContext();

  const [products, setProducts] = useState<ProductViewModel[]>([]);
  const [dataState, setDataState] = useState<ProductDataState>('loading');
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const [filter, setFilter] = useState<ProductFilterModel>(initialFilter);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingProduct, setEditingProduct] = useState<ProductViewModel | null>(null);
  const [conflictError, setConflictError] = useState<ProductOperationError | null>(null);

  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivatingProduct, setDeactivatingProduct] = useState<ProductViewModel | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const tenantId = business?.id ?? '';
  const branchId = activeBranch?.id ?? '';
  const branchName = activeBranch?.name;
  const canEdit = isOwner();

  const limit = PRODUCTS_PAGE_SIZE;

  // ── Fetch products ──────────────────────────────────────────

  const loadProducts = useCallback(async () => {
    if (!tenantId) return;

    setDataState('loading');
    setError(null);

    try {
      const res = await fetchProducts({
        business_id: tenantId,
        search: filter.search || undefined,
        category: filter.category || undefined,
        barcode: filter.barcode || undefined,
        limit,
        offset,
      });

      setProducts(res.items);
      setTotal(res.total);
      setHasMore(res.has_more);
      setDataState(res.items.length === 0 ? 'empty' : 'ready');
      setError(null);
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.message || err.message || 'Gagal memuat produk');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Gagal memuat produk');
      }
      setDataState('error');
    }
  }, [tenantId, filter.search, filter.category, filter.barcode, limit, offset]);

  // ── Fetch branch stocks ─────────────────────────────────────

  const loadBranchStocks = useCallback(async () => {
    if (!tenantId || !branchId || products.length === 0) return;

    try {
      const productIds = products.map((p) => p.id);
      const stocks = await fetchBranchStocks(tenantId, branchId, productIds);

      const stockMap = new Map(stocks.map((s) => [s.product_id, s.quantity]));

      setProducts((prev) =>
        prev.map((p) => {
          if (stockMap.has(p.id)) {
            const qty = stockMap.get(p.id) ?? 0;
            return {
              ...p,
              stock_quantity: qty,
              stock_status: getStockStatus(qty),
            };
          }
          return p;
        }),
      );
    } catch {
      // Non-blocking — products still render without stock
    }
  }, [tenantId, branchId, products]);

  // ── Initial load ────────────────────────────────────────────

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // ── Branch reactivity ───────────────────────────────────────

  useEffect(() => {
    if (branchStatus === 'active' && branchId && dataState === 'ready') {
      setProducts((prev) =>
        prev.map((p) => ({
          ...p,
          stock_quantity: null,
          stock_status: 'unknown',
        })),
      );
      loadBranchStocks();
    }
  }, [branchId, branchStatus, dataState, loadBranchStocks]);

  // ── Tenant reactivity ───────────────────────────────────────

  useEffect(() => {
    if (searchParams) {
      const newParam = searchParams.get('new');
      const editParam = searchParams.get('edit');

      if (newParam === '1' && canEdit) {
        setModalMode('create');
        setEditingProduct(null);
        setConflictError(null);
        setModalOpen(true);
      }

      if (editParam && canEdit) {
        const product = products.find((p) => p.id === editParam);
        if (product) {
          setModalMode('edit');
          setEditingProduct(product);
          setConflictError(null);
          setModalOpen(true);
        }
      }
    }
  }, [searchParams, products, canEdit]);

  // ── Filter change ────────────────────────────────────────────

  const handleFilterChange = (newFilter: ProductFilterModel) => {
    setFilter(newFilter);
    setOffset(0);
  };

  // ── Pagination ───────────────────────────────────────────────

  const handleNext = () => {
    if (hasMore) setOffset((prev) => prev + limit);
  };

  const handlePrev = () => {
    setOffset((prev) => Math.max(0, prev - limit));
  };

  // ── Modal handlers ───────────────────────────────────────────

  const handleAddProduct = () => {
    if (!canEdit) return;
    setModalMode('create');
    setEditingProduct(null);
    setConflictError(null);
    setModalOpen(true);
    router.push('/products?new=1', { scroll: false });
  };

  const handleEdit = (product: ProductViewModel) => {
    if (!canEdit) return;
    setModalMode('edit');
    setEditingProduct(product);
    setConflictError(null);
    setModalOpen(true);
    router.push(`/products?edit=${product.id}`, { scroll: false });
  };

  // ── Save handler ─────────────────────────────────────────────

  const handleSave = async (
    payload: ProductFormModel & {
      id?: string;
      business_id: string;
      expected_server_version?: number;
    },
    idempotencyKey?: string,
  ): Promise<void> => {
    if (modalMode === 'edit') {
      const result = await updateProduct(
        payload.id!,
        {
          business_id: payload.business_id,
          expected_server_version: payload.expected_server_version ?? 0,
          name: payload.name,
          price_minor: payload.price_minor,
          description: payload.description || null,
          sku: payload.sku || null,
          cost_minor: payload.cost_minor,
          category: payload.category || null,
          barcode: payload.barcode || null,
          is_active: payload.is_active,
        },
      );

      const savedVm = mapProductToViewModel(result);

      setProducts((prev) =>
        prev.map((p) =>
          p.id === savedVm.id
            ? { ...savedVm, stock_quantity: p.stock_quantity, stock_status: p.stock_status }
            : p,
        ),
      );
      setSaveSuccess('Produk berhasil diperbarui');
      setTimeout(() => setSaveSuccess(null), 3000);
    } else {
      const result = await createProduct(
        {
          id: crypto.randomUUID(),
          business_id: payload.business_id,
          name: payload.name,
          price_minor: payload.price_minor,
          description: payload.description || null,
          sku: payload.sku || null,
          cost_minor: payload.cost_minor,
          category: payload.category || null,
          barcode: payload.barcode || null,
          is_active: payload.is_active,
        },
        idempotencyKey ?? crypto.randomUUID(),
      );

      const savedVm = mapProductToViewModel(result);
      setProducts((prev) => [savedVm, ...prev]);
      setTotal((prev) => prev + 1);
      setSaveSuccess('Produk berhasil dibuat');
      setTimeout(() => setSaveSuccess(null), 3000);
    }

    setModalOpen(false);
    router.push('/products', { scroll: false });
  };

  // ── Deactivate handlers ──────────────────────────────────────

  const handleRequestDeactivate = (product: ProductViewModel) => {
    setDeactivatingProduct(product);
    setDeactivateOpen(true);
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivatingProduct || !tenantId) return;

    setIsDeactivating(true);
    try {
      await deactivateProduct(
        deactivatingProduct.id,
        tenantId,
        deactivatingProduct.server_version,
      );
      setProducts((prev) =>
        prev.map((p) =>
          p.id === deactivatingProduct.id
            ? { ...p, is_active: false, server_version: p.server_version + 1 }
            : p,
        ),
      );
      setSaveSuccess(`"${deactivatingProduct.name}" dinonaktifkan`);
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      const classified = classifyProductError(err);
      setConflictError(classified);
    } finally {
      setDeactivateOpen(false);
      setDeactivatingProduct(null);
      setIsDeactivating(false);
    }
  };

  // ── Retry ────────────────────────────────────────────────────

  const handleRetry = () => {
    setOffset(0);
    loadProducts();
  };

  // ── Filtered display ─────────────────────────────────────────

  const displayedProducts = filterProducts(products, filter);
  const hasFilter = Boolean(filter.search || filter.category || filter.barcode);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-ink tracking-tight">
          Produk
        </h1>
        <p className="text-sm text-fog">
          Kelola katalog produk Anda — harga jual, HPP, margin, dan stok cabang.
        </p>
        {branchName && (
          <p className="text-xs text-fog/60">
            Cabang aktif: <span className="font-medium text-ink">{branchName}</span>
          </p>
        )}
      </div>

      {/* Success Toast */}
      {saveSuccess && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-pine bg-pine-soft px-4 py-2.5 text-xs text-pine shadow-lg">
          {saveSuccess}
        </div>
      )}

      {/* Toolbar */}
      <ProductsToolbar
        filter={filter}
        onFilterChange={handleFilterChange}
        categories={[...new Set(products.map((p) => p.category).filter(Boolean) as string[])]}
        onAddProduct={handleAddProduct}
        isOwner={canEdit}
        disabled={dataState === 'loading'}
      />

      {/* Loading skeletons */}
      {dataState === 'loading' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Error state */}
      {dataState === 'error' && (
        <ErrorState
          message={error || 'Gagal memuat produk'}
          onRetry={handleRetry}
        />
      )}

      {/* Empty state */}
      {dataState === 'empty' && !error && (
        <ProductEmptyState
          hasFilter={hasFilter}
          onAddProduct={handleAddProduct}
          onClearFilter={() => setFilter(initialFilter)}
          isOwner={canEdit}
        />
      )}

      {/* Results: no matches for current filter */}
      {dataState === 'ready' && displayedProducts.length === 0 && hasFilter && (
        <ProductEmptyState
          hasFilter={true}
          onClearFilter={() => setFilter(initialFilter)}
          isOwner={false}
        />
      )}

      {/* Product grid */}
      {dataState === 'ready' && displayedProducts.length > 0 && (
        <>
          <ProductGrid
            products={displayedProducts}
            isLoading={false}
            skeletonCount={0}
            branchName={branchName}
            isOwner={canEdit}
            onEdit={handleEdit}
            onDeactivate={handleRequestDeactivate}
          />

          <ProductPagination
            total={total}
            limit={limit}
            offset={offset}
            hasMore={hasMore}
            onNext={handleNext}
            onPrev={handlePrev}
          />
        </>
      )}

      {/* Create/Edit Modal */}
      <ProductFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setConflictError(null);
          router.push('/products', { scroll: false });
        }}
        mode={modalMode}
        businessId={tenantId}
        branchName={branchName}
        product={editingProduct ?? undefined}
        serverVersion={editingProduct?.server_version}
        onSave={handleSave}
        conflictError={conflictError}
        onResolveConflict={() => {
          if (editingProduct && branchId && tenantId) {
            fetchProduct(editingProduct.id, tenantId)
              .then((fresh) => {
                setEditingProduct(fresh);
                setConflictError(null);
              })
              .catch(() => {});
          }
        }}
      />

      {/* Deactivate Confirmation Modal */}
      <DeactivateConfirmModal
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        onConfirm={handleConfirmDeactivate}
        product={deactivatingProduct}
        isSubmitting={isDeactivating}
      />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card flex flex-col gap-2 overflow-hidden rounded-xl bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-5 w-3/4 rounded" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full rounded" />
      <Skeleton className="h-3 w-2/3 rounded" />
      <div className="grid grid-cols-2 gap-2 pt-2">
        <Skeleton className="h-8 w-full rounded" />
        <Skeleton className="h-8 w-full rounded" />
        <Skeleton className="h-8 w-full rounded" />
        <Skeleton className="h-8 w-full rounded" />
      </div>
      <div className="flex justify-end gap-1 pt-2 border-t">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-6 w-6 rounded" />
      </div>
    </div>
  );
}
