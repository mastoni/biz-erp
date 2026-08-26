'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Box, Plus, Minus, TriangleAlert, RotateCw } from 'lucide-react';
import type {
  InventoryAdjustmentFormModel,
  InventoryMovementType,
  InventoryMutationError,
  InventoryStockViewModel,
} from '../types';

export type StockAdjustmentMode = 'adjust' | 'in' | 'out';

const REFERENCE_PRESETS: Record<'in' | 'out', string[]> = {
  in: ['Restok dari supplier', 'Retur pelanggan', 'Opname — selisih lebih'],
  out: ['Rusak / kedaluwarsa', 'Dipakai internal', 'Opname — selisih kurang'],
};

interface StockAdjustmentModalProps {
  open: boolean;
  onClose: () => void;
  mode: StockAdjustmentMode;
  stocks: InventoryStockViewModel[];
  initialProductId?: string | null;
  isSubmitting: boolean;
  conflictError: InventoryMutationError | null;
  validationMessage: string | null;
  onSubmit: (form: InventoryAdjustmentFormModel) => void;
  onResolveConflict: (productId: string) => void;
}

const TITLES: Record<StockAdjustmentMode, { title: string; description: string }> = {
  in: { title: 'Stok Masuk', description: 'Catat penerimaan barang ke stok cabang.' },
  out: { title: 'Stok Keluar', description: 'Catat pengeluaran barang dari stok cabang.' },
  adjust: { title: 'Atur Stok', description: 'Sesuaikan stok dengan pergerakan barang.' },
};

export function resolveQuantityChange(
  movementType: InventoryMovementType,
  amount: number,
  signedDelta: number
): number {
  switch (movementType) {
    case 'STOCK_IN':
      return Math.abs(amount);
    case 'STOCK_OUT':
      return -Math.abs(amount);
    case 'ADJUSTMENT':
      return signedDelta;
  }
}

export function isFinalStockBlocked(projectedFinal: number): boolean {
  return projectedFinal < 0;
}

export function StockAdjustmentModal({
  open,
  onClose,
  mode,
  stocks,
  initialProductId,
  isSubmitting,
  conflictError,
  validationMessage,
  onSubmit,
  onResolveConflict,
}: StockAdjustmentModalProps) {
  const [productId, setProductId] = useState('');
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [adjustMovementType, setAdjustMovementType] = useState<InventoryMovementType>('STOCK_IN');
  const [amount, setAmount] = useState(0);
  const [signedDelta, setSignedDelta] = useState(0);
  const [referencePreset, setReferencePreset] = useState('');
  const [customReference, setCustomReference] = useState('');

  // Reset local form each time the modal opens or the target product changes.
  useEffect(() => {
    if (!open) return;
    const initial =
      (initialProductId && stocks.find((s) => s.product_id === initialProductId)) ||
      stocks[0] ||
      null;
    if (initial) setProductId((prev) => (prev && prev === initial.product_id ? prev : initial.product_id));
    setDirection(mode === 'out' ? 'out' : 'in');
    setAdjustMovementType(mode === 'out' ? 'STOCK_OUT' : 'STOCK_IN');
    setAmount(0);
    setSignedDelta(0);
    setReferencePreset('');
    setCustomReference('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialProductId, mode]);

  // Selection falls back through: user choice → initial product → first stock.
  const effectiveProductId =
    productId || (initialProductId ?? '') || stocks[0]?.product_id || '';

  const selected = useMemo(
    () => stocks.find((s) => s.product_id === effectiveProductId) ?? null,
    [stocks, effectiveProductId]
  );

  const effectiveMovementType: InventoryMovementType =
    mode === 'in' ? 'STOCK_IN' : mode === 'out' ? 'STOCK_OUT' : adjustMovementType;

  const quantityChange = resolveQuantityChange(effectiveMovementType, amount, signedDelta);
  const projectedFinal = selected ? selected.quantity + quantityChange : 0;

  const needsPositiveAmount =
    effectiveMovementType === 'STOCK_IN' || effectiveMovementType === 'STOCK_OUT';

  const negativeBlocked = selected !== null && projectedFinal < 0;
  const amountInvalid = needsPositiveAmount && amount <= 0;
  const canSubmit =
    selected !== null && !amountInvalid && !negativeBlocked && !isSubmitting;

  const presets = REFERENCE_PRESETS[effectiveMovementType === 'STOCK_OUT' ? 'out' : 'in'];
  const reference = referencePreset === '__custom__' ? customReference.trim() : referencePreset;

  const handleSubmit = () => {
    if (!selected || !canSubmit) return;
    const form: InventoryAdjustmentFormModel = {
      product_id: selected.product_id,
      quantity_change: quantityChange,
      movement_type: effectiveMovementType,
      reference: reference ? reference : null,
      expected_server_version: selected.server_version,
    };
    onSubmit(form);
  };

  const meta = TITLES[mode];

  return (
    <Modal open={open} onClose={onClose} title={meta.title} description={meta.description}>
      {/* Product selector */}
      <div className="mb-3">
        <label className="label" htmlFor="inv-adjust-product">Produk</label>
        <select
          id="inv-adjust-product"
          className="input"
          value={effectiveProductId}
          onChange={(e) => setProductId(e.target.value)}
        >
          {stocks.length === 0 && <option value="">Tidak ada stok cabang</option>}
          {stocks.map((s) => (
            <option key={s.product_id} value={s.product_id}>
              {s.product_name} ({s.sku ?? s.product_id.slice(0, 8)})
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-paper px-3.5 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-pine-soft text-pine">
            <Box width={17} height={17} />
          </span>
          <div>
            <p className="text-[13.5px] font-bold leading-tight">{selected.product_name}</p>
            <p className="num text-[11px] text-fog">
              {selected.sku ?? '—'} · stok saat ini {selected.quantity} · v{selected.server_version}
            </p>
          </div>
        </div>
      )}

      {/* Movement type */}
      {mode === 'adjust' ? (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {(
            [
              { t: 'STOCK_IN' as const, label: 'Barang Masuk', active: 'border-pine bg-pine-soft text-pine' },
              { t: 'STOCK_OUT' as const, label: 'Barang Keluar', active: 'border-clay bg-clay-soft text-clay' },
              { t: 'ADJUSTMENT' as const, label: 'Penyesuaian', active: 'border-ocean bg-ocean-soft text-ocean' },
            ]
          ).map((opt) => (
            <button
              key={opt.t}
              type="button"
              onClick={() => setAdjustMovementType(opt.t)}
              className={cn(
                'rounded-lg border py-2.5 text-[12px] font-bold transition-all cursor-pointer',
                adjustMovementType === opt.t
                  ? opt.active
                  : 'border-line text-fog hover:border-pine/40'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-3">
          <Badge variant={mode === 'in' ? 'pine' : 'clay'}>
            {mode === 'in' ? 'Barang Masuk' : 'Barang Keluar'}
          </Badge>
        </div>
      )}

      {/* Amount */}
      {effectiveMovementType === 'ADJUSTMENT' ? (
        <>
          <label className="label" htmlFor="inv-adjust-delta">Selisih stok (±)</label>
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              aria-label="Kurangi selisih"
              onClick={() => setSignedDelta((d) => d - 1)}
              className="btn-outline px-3 py-2"
            >
              <Minus width={14} height={14} />
            </button>
            <input
              id="inv-adjust-delta"
              type="number"
              value={signedDelta || ''}
              onChange={(e) => setSignedDelta(Number(e.target.value) || 0)}
              placeholder="cth: -3"
              className="input num flex-1 text-center text-[15px] font-bold"
            />
            <button
              type="button"
              aria-label="Tambah selisih"
              onClick={() => setSignedDelta((d) => d + 1)}
              className="btn-outline px-3 py-2"
            >
              <Plus width={14} height={14} />
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="label" htmlFor="inv-adjust-qty">Jumlah</label>
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              aria-label="Kurangi jumlah"
              onClick={() => setAmount((a) => Math.max(0, a - 1))}
              className="btn-outline px-3 py-2"
            >
              <Minus width={14} height={14} />
            </button>
            <input
              id="inv-adjust-qty"
              type="number"
              min={1}
              value={amount || ''}
              onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              placeholder="0"
              className="input num flex-1 text-center text-[15px] font-bold"
            />
            <button
              type="button"
              aria-label="Tambah jumlah"
              onClick={() => setAmount((a) => a + 1)}
              className="btn-outline px-3 py-2"
            >
              <Plus width={14} height={14} />
            </button>
          </div>
        </>
      )}

      {/* Reference */}
      <label className="label" htmlFor="inv-adjust-reference">Referensi</label>
      <select
        id="inv-adjust-reference"
        className="input mb-3"
        value={referencePreset}
        onChange={(e) => setReferencePreset(e.target.value)}
      >
        <option value="">Pilih referensi…</option>
        {presets.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
        <option value="__custom__">Lainnya…</option>
      </select>
      {referencePreset === '__custom__' && (
        <input
          className="input mb-3"
          value={customReference}
          onChange={(e) => setCustomReference(e.target.value)}
          placeholder="Tulis referensi manual"
          aria-label="Referensi manual"
        />
      )}

      {/* Projected stock preview */}
      {selected && !negativeBlocked && (
        <p className="num mb-3 rounded-lg bg-paper px-3.5 py-2.5 text-[12.5px] font-semibold">
          Stok baru:{' '}
          <span
            className={cn(
              'font-bold',
              quantityChange >= 0 ? 'text-pine' : 'text-clay'
            )}
          >
            {projectedFinal}
          </span>
        </p>
      )}

      {negativeBlocked && (
        <p className="mb-3 flex items-start gap-2 rounded-lg bg-clay-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-clay">
          <TriangleAlert width={15} height={15} className="mt-0.5 shrink-0" />
          Stok akhir tidak boleh negatif. Kurangi jumlah keluar atau lakukan stok masuk terlebih dahulu.
        </p>
      )}

      {conflictError && (
        <div className="mb-3 rounded-lg border border-honey/30 bg-honey-soft px-3.5 py-3 text-[12.5px] text-[#8a5f10]">
          <p className="flex items-center gap-2 font-bold">
            <TriangleAlert width={15} height={15} /> Konflik versi stok
          </p>
          <p className="mt-1">{conflictError.message}</p>
          <button
            type="button"
            onClick={() => onResolveConflict(effectiveProductId)}
            className="btn-outline mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
          >
            <RotateCw width={13} height={13} /> Muat Versi Terbaru
          </button>
        </div>
      )}

      {validationMessage && (
        <p className="mb-3 rounded-lg bg-clay-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-clay">
          {validationMessage}
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" className="btn-outline flex-1 py-2.5" onClick={onClose}>
          Batal
        </button>
        <button
          type="button"
          className="btn-primary flex-1 py-2.5 disabled:opacity-50"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {isSubmitting ? 'Menyimpan…' : 'Simpan Stok'}
        </button>
      </div>
    </Modal>
  );
}
