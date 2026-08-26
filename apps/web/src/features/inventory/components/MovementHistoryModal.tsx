'use client';

import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchInventoryMovements } from '../api';
import { getApiErrorMessage } from '../error-helpers';
import type { InventoryMovementViewModel } from '../types';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 20;

export const MOVEMENTS_PAGE_SIZE = PAGE_SIZE;

export function getMovementRange(offset: number, total: number): {
  rangeStart: number;
  rangeEnd: number;
  hasPrev: boolean;
  hasNext: boolean;
} {
  return {
    rangeStart: total === 0 ? 0 : offset + 1,
    rangeEnd: Math.min(offset + PAGE_SIZE, total),
    hasPrev: offset > 0,
    hasNext: offset + PAGE_SIZE < total,
  };
}

const MOVEMENT_BADGE: Record<InventoryMovementViewModel['movement_type'], { variant: 'pine' | 'clay' | 'ocean'; label: string }> = {
  STOCK_IN: { variant: 'pine', label: 'Masuk' },
  STOCK_OUT: { variant: 'clay', label: 'Keluar' },
  ADJUSTMENT: { variant: 'ocean', label: 'Penyesuaian' },
};

function MovementIcon({ type }: { type: InventoryMovementViewModel['movement_type'] }) {
  if (type === 'STOCK_IN') return <ArrowDownLeft width={14} height={14} />;
  if (type === 'STOCK_OUT') return <ArrowUpRight width={14} height={14} />;
  return <ArrowLeftRight width={14} height={14} />;
}

interface MovementHistoryModalProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  branchId: string;
  branchName?: string;
  productNameById: Map<string, string>;
  initialProductId?: string | null;
}

export function MovementHistoryModal({
  open,
  onClose,
  tenantId,
  branchId,
  branchName,
  productNameById,
  initialProductId,
}: MovementHistoryModalProps) {
  const [items, setItems] = useState<InventoryMovementViewModel[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    setProductFilter(initialProductId ?? '');
    setOffset(0);
  }, [open, initialProductId]);

  const load = useCallback(async () => {
    if (!tenantId || !branchId || !open) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchInventoryMovements(branchId, tenantId, {
        ...(productFilter ? { product_id: productFilter } : {}),
        limit: PAGE_SIZE,
        offset,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Gagal memuat riwayat pergerakan'));
    } finally {
      setLoading(false);
    }
  }, [tenantId, branchId, open, productFilter, offset]);

  useEffect(() => {
    load();
  }, [load, reloadTick]);

  const handleFilterChange = (value: string) => {
    setProductFilter(value);
    setOffset(0);
  };

  const { rangeStart, rangeEnd, hasPrev, hasNext } = getMovementRange(offset, total);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Riwayat Pergerakan Stok"
      description={branchName ? `Cabang ${branchName}` : undefined}
      maxWidth="lg"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <select
          aria-label="Filter produk"
          className="input w-auto flex-1 py-2 text-[13px]"
          value={productFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
        >
          <option value="">Semua Produk</option>
          {[...productNameById.entries()].map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <span className="num text-[12px] font-semibold text-fog">{total} pergerakan</span>
      </div>

      {loading && (
        <div className="space-y-2.5" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-line p-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-2/3 rounded" />
                <Skeleton className="h-3 w-1/3 rounded" />
              </div>
              <Skeleton className="h-4 w-10 rounded" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <ErrorState message={error} onRetry={() => setReloadTick((t) => t + 1)} />
      )}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          title="Belum ada pergerakan stok"
          description={
            productFilter
              ? 'Tidak ada pergerakan untuk produk ini di cabang ini.'
              : 'Pergerakan akan tercatat saat ada stok masuk, keluar, atau penyesuaian.'
          }
        />
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <ul className="max-h-[46vh] divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {items.map((m) => {
              const cfg = MOVEMENT_BADGE[m.movement_type];
              return (
                <li key={m.id} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-paper/60">
                  <span
                    className={
                      m.movement_type === 'STOCK_IN'
                        ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pine-soft text-pine'
                        : m.movement_type === 'STOCK_OUT'
                          ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-clay-soft text-clay'
                          : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ocean-soft text-ocean'
                    }
                  >
                    <MovementIcon type={m.movement_type} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold leading-tight">
                      {productNameById.get(m.product_id) ?? m.product_id.slice(0, 8)}
                    </p>
                    <p className="truncate text-[11px] text-fog">
                      {new Date(m.timestamp).toLocaleString('id-ID')}
                      {m.reference ? ` · ${m.reference}` : ''}
                      {' · '}
                      {m.actor.slice(0, 8)}
                    </p>
                  </div>
                  <Badge variant={cfg.variant}>
                    <MovementIcon type={m.movement_type} /> {cfg.label}
                  </Badge>
                  <span
                    className={`num w-12 text-right text-[13px] font-bold ${
                      m.quantity >= 0 ? 'text-pine' : 'text-clay'
                    }`}
                  >
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              disabled={!hasPrev}
              className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] disabled:opacity-40"
            >
              <ChevronLeft width={13} height={13} /> Sebelumnya
            </button>
            <span className="num text-[12px] font-semibold text-fog">
              {rangeStart}–{rangeEnd} dari {total}
            </span>
            <button
              type="button"
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              disabled={!hasNext}
              className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] disabled:opacity-40"
            >
              Berikutnya <ChevronRight width={13} height={13} />
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
