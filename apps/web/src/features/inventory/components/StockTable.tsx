'use client';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMinor } from '@/lib/format';
import { SlidersHorizontal, History } from 'lucide-react';
import type { InventoryStockViewModel } from '../types';

const STATUS_CONFIG: Record<
  InventoryStockViewModel['stock_status'],
  { variant: 'pine' | 'honey' | 'clay'; label: string; qtyClass: string }
> = {
  in_stock: { variant: 'pine', label: 'Normal', qtyClass: 'text-ink' },
  low_stock: { variant: 'honey', label: 'Menipis', qtyClass: 'text-[#8a5f10]' },
  out_of_stock: { variant: 'clay', label: 'Habis', qtyClass: 'text-clay' },
};

interface StockTableProps {
  stocks: InventoryStockViewModel[];
  canMutate: boolean;
  onAdjust: (product: InventoryStockViewModel) => void;
  onHistory: (product: InventoryStockViewModel) => void;
}

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function StockTable({ stocks, canMutate, onAdjust, onHistory }: StockTableProps) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px]">
          <thead>
            <tr className="bg-paper/60">
              <th className="th">Produk</th>
              <th className="th">SKU</th>
              <th className="th">Barcode</th>
              <th className="th">Kategori</th>
              <th className="th text-right">Harga Jual</th>
              <th className="th text-right">HPP</th>
              <th className="th text-center">Stok</th>
              <th className="th">Status</th>
              <th className="th text-right">Diperbarui</th>
              <th className="th text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((s) => {
              const cfg = STATUS_CONFIG[s.stock_status];
              return (
                <tr key={s.product_id} className="transition-colors hover:bg-paper/60">
                  <td className="td font-semibold leading-tight">{s.product_name}</td>
                  <td className="td num text-[12px] font-semibold text-fog">{s.sku ?? '—'}</td>
                  <td className="td num text-[12px] text-fog">{s.barcode ?? '—'}</td>
                  <td className="td text-[13px] text-fog">{s.category ?? '—'}</td>
                  <td className="td num text-right font-semibold">{formatMinor(s.price_minor)}</td>
                  <td className="td num text-right text-fog">
                    {s.cost_minor !== null ? formatMinor(s.cost_minor) : '—'}
                  </td>
                  <td className={`td num text-center font-bold ${cfg.qtyClass}`}>{s.quantity}</td>
                  <td className="td">
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </td>
                  <td className="td text-right text-[12px] text-fog">{formatUpdatedAt(s.updated_at)}</td>
                  <td className="td text-right whitespace-nowrap">
                    {canMutate && (
                      <button
                        type="button"
                        onClick={() => onAdjust(s)}
                        className="btn-outline mr-1.5 px-3 py-1.5 text-[12px]"
                      >
                        <SlidersHorizontal width={13} height={13} /> Atur Stok
                      </button>
                    )}
                    {canMutate && (
                      <button
                        type="button"
                        onClick={() => onHistory(s)}
                        aria-label={`Riwayat stok ${s.product_name}`}
                        title="Riwayat Pergerakan"
                        className="btn-outline px-2.5 py-1.5 text-[12px]"
                      >
                        <History width={13} height={13} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StockTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <div className="space-y-3 p-4">
        <div className="flex gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1 rounded" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-t border-line pt-3">
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="ml-auto h-4 w-20 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-4 w-8 rounded" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-6 w-24 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
