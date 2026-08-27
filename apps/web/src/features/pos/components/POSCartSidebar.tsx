'use client';

import React from 'react';
import { POSCartViewModel, POSCustomerViewModel, POSParkedOrder } from '../types';
import { idr, idrShort } from '../pos-helpers';
import { POSCartLine } from './POSCartLine';
import { POSParkedOrders } from './POSParkedOrders';

export interface POSCartSidebarProps {
  cart: POSCartViewModel;
  customers: POSCustomerViewModel[];
  selectedCustomerId: string | null;
  onCustomerChange: (customerId: string | null) => void;
  parkedOrders: POSParkedOrder[];
  onParkOrder: () => void;
  onRestoreParkedOrder: (order: POSParkedOrder) => void;
  onDeleteParkedOrder: (transactionId: string) => void;
  onIncrementLine: (productId: string) => void;
  onDecrementLine: (productId: string) => void;
  onRemoveLine: (productId: string) => void;
  onDiscountChange: (percent: number) => void;
  onOpenPayment: () => void;
  taxRatePercent?: number;
}

export function POSCartSidebar({
  cart,
  customers,
  selectedCustomerId,
  onCustomerChange,
  parkedOrders,
  onParkOrder,
  onRestoreParkedOrder,
  onDeleteParkedOrder,
  onIncrementLine,
  onDecrementLine,
  onRemoveLine,
  onDiscountChange,
  onOpenPayment,
  taxRatePercent = 11,
}: POSCartSidebarProps) {
  const isCartEmpty = cart.lines.length === 0;

  return (
    <aside className="xl:sticky xl:top-[84px] xl:h-[calc(100vh-104px)]">
      <div className="card flex h-full flex-col overflow-hidden">
        {/* Cart Header */}
        <div className="border-b border-line px-4 py-3.5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[16px] font-bold text-ink">Keranjang</h3>
            <span className="num text-[11.5px] font-semibold text-fog">{cart.transaction_id}</span>
          </div>
          <select
            value={selectedCustomerId || ''}
            onChange={(e) => onCustomerChange(e.target.value ? e.target.value : null)}
            className="input mt-2.5 py-1.5 text-[13px] w-full"
          >
            <option value="">Umum</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.tier ? `(${c.tier})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Parked Orders queue */}
        <POSParkedOrders
          parkedOrders={parkedOrders}
          onRestore={onRestoreParkedOrder}
          onDelete={onDeleteParkedOrder}
        />

        {/* Cart Lines list */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {isCartEmpty ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-paper text-fog">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              </div>
              <h4 className="text-[14px] font-bold text-ink">Keranjang kosong</h4>
              <p className="mt-1 text-[12.5px] text-fog">
                Klik produk di sebelah kiri untuk menambahkan item.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {cart.lines.map((line) => (
                <POSCartLine
                  key={line.product_id}
                  line={line}
                  onIncrement={onIncrementLine}
                  onDecrement={onDecrementLine}
                  onRemove={onRemoveLine}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Cart Summary & Actions */}
        <div className="border-t border-line px-4 py-3.5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[12px] font-semibold text-fog">Diskon</span>
            <div className="relative ml-auto w-24">
              <input
                type="number"
                min={0}
                max={100}
                value={cart.discount_percent || ''}
                placeholder="0"
                onChange={(e) =>
                  onDiscountChange(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
                }
                className="input num py-1 pr-6 text-right text-[13px]"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] font-bold text-fog">
                %
              </span>
            </div>
          </div>

          <dl className="space-y-1.5 text-[13px]">
            <div className="flex justify-between text-fog">
              <dt>Subtotal</dt>
              <dd className="num font-semibold text-ink">{idr(cart.subtotal_minor)}</dd>
            </div>
            {cart.discount_minor > 0 && (
              <div className="flex justify-between text-clay">
                <dt>Diskon {cart.discount_percent}%</dt>
                <dd className="num font-semibold">−{idr(cart.discount_minor)}</dd>
              </div>
            )}
            <div className="flex justify-between text-fog">
              <dt>PPN {taxRatePercent}%</dt>
              <dd className="num font-semibold text-ink">{idr(cart.tax_minor)}</dd>
            </div>
            <div className="mt-1 flex items-baseline justify-between border-t border-dashed border-linedark pt-2.5">
              <dt className="font-display text-[15px] font-bold text-ink">Total</dt>
              <dd className="num text-[21px] font-bold text-pine">{idr(cart.total_minor)}</dd>
            </div>
          </dl>

          <div className="mt-3.5 flex gap-2">
            <button
              type="button"
              onClick={onParkOrder}
              disabled={isCartEmpty}
              className="btn-outline flex-1 py-2.5 inline-flex items-center justify-center gap-1.5 font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              Simpan
            </button>
            <button
              type="button"
              onClick={onOpenPayment}
              disabled={isCartEmpty}
              className="btn-primary flex-[1.5] py-2.5 inline-flex items-center justify-center font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Bayar · {idrShort(cart.total_minor)}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
