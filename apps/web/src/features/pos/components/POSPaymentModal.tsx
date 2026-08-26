'use client';

import React from 'react';
import { POSCartViewModel, POSPaymentState, POSReceiptViewModel, PaymentMethod } from '../types';
import { idr, idrShort } from '../pos-helpers';
import { POSReceiptCard } from './POSReceiptCard';

/* Deterministic decorative QR code matching blueprint */
function QrSvg({ seed }: { seed: string }) {
  const N = 21;
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const rnd = () => {
    h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
    return h / 4294967296;
  };
  const cells = Array.from({ length: N * N }, () => rnd() > 0.52);
  const finderAt = (fx: number, fy: number, x: number, y: number): boolean | null => {
    const dx = x - fx, dy = y - fy;
    if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return null;
    const ring = dx === 0 || dy === 0 || dx === 6 || dy === 6;
    return ring || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
  };
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const f = finderAt(0, 0, x, y) ?? finderAt(14, 0, x, y) ?? finderAt(0, 14, x, y);
      const dark = f !== null ? f : cells[y * N + x];
      if (dark) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
    }
  }
  return (
    <svg viewBox="0 0 21 21" shapeRendering="crispEdges" className="h-40 w-40 fill-pine-deep">
      {rects}
    </svg>
  );
}

export interface POSPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: POSCartViewModel;
  paymentState: POSPaymentState;
  onMethodChange: (method: PaymentMethod) => void;
  onPaidChange: (amount: number) => void;
  onSubmitCheckout: () => void;
  isSubmitting: boolean;
  receipt: POSReceiptViewModel | null;
  onNewTransaction: () => void;
  error?: string | null;
}

export function POSPaymentModal({
  isOpen,
  onClose,
  cart,
  paymentState,
  onMethodChange,
  onPaidChange,
  onSubmitCheckout,
  isSubmitting,
  receipt,
  onNewTransaction,
  error,
}: POSPaymentModalProps) {
  if (!isOpen) return null;

  const quickCashOptions = Array.from(
    new Set([
      cart.total_minor,
      Math.ceil(cart.total_minor / 20000) * 20000,
      Math.ceil(cart.total_minor / 50000) * 50000,
      Math.ceil(cart.total_minor / 100000) * 100000,
    ])
  ).sort((a, b) => a - b);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl border border-line bg-surface shadow-2xl overflow-hidden">
        {paymentState.step === 'pay' ? (
          <>
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="font-display text-[17px] font-bold text-ink">Pembayaran</h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-fog hover:bg-paper hover:text-ink cursor-pointer"
                aria-label="Tutup modal"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5">
              {error && (
                <div className="mb-4 rounded-lg bg-clay-soft p-3 text-[13px] font-semibold text-clay">
                  {error}
                </div>
              )}

              {/* Total Banner */}
              <div className="mb-4 flex items-center justify-between rounded-lg bg-pine-deep px-4 py-3 text-[#f2efe2]">
                <div>
                  <p className="text-[10.5px] uppercase tracking-[0.16em] opacity-60">Total Tagihan</p>
                  <p className="num text-[22px] font-bold">{idr(cart.total_minor)}</p>
                </div>
                <p className="num text-[11.5px] opacity-70 text-right">
                  {cart.transaction_id}<br />{cart.item_count} item
                </p>
              </div>

              {/* Payment Methods */}
              <div className="mb-4 grid grid-cols-3 gap-2">
                {[
                  {
                    m: 'CASH' as PaymentMethod,
                    label: 'Tunai',
                    icon: (
                      <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="6" width="20" height="12" rx="2" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ),
                  },
                  {
                    m: 'QRIS' as PaymentMethod,
                    label: 'QRIS',
                    icon: (
                      <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                        <path d="M14 14h3v3h-3zM17 17h4v4h-4zM14 20h3v1h-3z" />
                      </svg>
                    ),
                  },
                  {
                    m: 'DEBIT' as PaymentMethod,
                    label: 'Debit',
                    icon: (
                      <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="5" width="20" height="14" rx="2" />
                        <line x1="2" y1="10" x2="22" y2="10" />
                      </svg>
                    ),
                  },
                ].map(({ m, label, icon }) => {
                  const isSelected = paymentState.method === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onMethodChange(m)}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border py-3 text-[12.5px] font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'border-pine bg-pine-soft text-pine shadow-xs'
                          : 'border-line bg-surface text-fog hover:border-pine/40'
                      }`}
                    >
                      {icon}
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* CASH Payment Form */}
              {paymentState.method === 'CASH' && (
                <div>
                  <label className="label text-[12px] font-semibold text-fog mb-1 block">Uang Diterima</label>
                  <input
                    type="number"
                    value={paymentState.paid_minor || ''}
                    onChange={(e) => onPaidChange(Math.max(0, Number(e.target.value) || 0))}
                    className="input num w-full text-[16px] font-bold"
                    placeholder="0"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {quickCashOptions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => onPaidChange(q)}
                        className={`btn-outline px-2.5 py-1.5 text-[11.5px] num cursor-pointer ${
                          paymentState.paid_minor === q ? 'border-pine! bg-pine-soft! text-pine font-bold' : ''
                        }`}
                      >
                        {q === cart.total_minor ? 'Uang Pas' : idrShort(q)}
                      </button>
                    ))}
                  </div>
                  <div
                    className={`mt-3 flex items-center justify-between rounded-lg px-3.5 py-2.5 text-[13px] font-bold ${
                      paymentState.is_sufficient ? 'bg-pine-soft text-pine' : 'bg-clay-soft text-clay'
                    }`}
                  >
                    <span>{paymentState.is_sufficient ? 'Kembalian' : 'Kurang'}</span>
                    <span className="num text-[16px]">
                      {idr(
                        paymentState.is_sufficient
                          ? paymentState.change_minor
                          : cart.total_minor - paymentState.paid_minor
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* QRIS Payment View */}
              {paymentState.method === 'QRIS' && (
                <div className="flex flex-col items-center rounded-lg border border-dashed border-linedark bg-white py-4">
                  <QrSvg seed={cart.transaction_id} />
                  <p className="mt-2 text-[12px] text-fog">Pelanggan dapat memindai dengan aplikasi apa pun</p>
                  <p className="num mt-1 text-[15px] font-bold text-pine">{idr(cart.total_minor)}</p>
                </div>
              )}

              {/* DEBIT Payment View */}
              {paymentState.method === 'DEBIT' && (
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-linedark bg-white px-4 py-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tide-soft text-tide">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-[13px] font-bold text-ink">Mesin EDC siap</p>
                    <p className="text-[12px] text-fog">Minta pelanggan memasukkan atau menempelkan kartu, lalu konfirmasi dari EDC.</p>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="button"
                onClick={onSubmitCheckout}
                disabled={!paymentState.is_sufficient || isSubmitting}
                className="btn-primary mt-4 w-full py-3 text-[14.5px] font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {isSubmitting
                  ? 'Memproses…'
                  : paymentState.method === 'CASH'
                  ? 'Selesaikan & Cetak Struk'
                  : 'Konfirmasi Pembayaran'}
              </button>
            </div>
          </>
        ) : (
          receipt && (
            <POSReceiptCard
              receipt={receipt}
              onNewTransaction={onNewTransaction}
            />
          )
        )}
      </div>
    </div>
  );
}
