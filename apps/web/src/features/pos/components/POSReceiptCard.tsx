'use client';

import React from 'react';
import { POSReceiptViewModel } from '../types';
import { idr } from '../pos-helpers';

export interface POSReceiptCardProps {
  receipt: POSReceiptViewModel;
  onPrint?: () => void;
  onNewTransaction: () => void;
}

export function POSReceiptCard({
  receipt,
  onPrint,
  onNewTransaction,
}: POSReceiptCardProps) {
  return (
    <div className="p-6">
      <div className="flex flex-col items-center text-center">
        <span className="check-pop flex h-14 w-14 items-center justify-center rounded-full bg-pine text-[#f2efe2]">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <h3 className="font-display mt-3 text-xl font-bold text-ink">Pembayaran Berhasil</h3>
        <p className="text-[12.5px] text-fog">
          {receipt.method} · {receipt.receipt_number}
        </p>
        {receipt.method === 'CASH' && receipt.change_minor > 0 && (
          <p className="num mt-2 rounded-lg bg-honey-soft px-4 py-1.5 text-[17px] font-bold text-[#8a5f10]">
            Kembalian {idr(receipt.change_minor)}
          </p>
        )}
      </div>

      {/* Thermal Struk Monospace Card */}
      <div className="mx-auto mt-5 w-[280px] rounded-md border border-line bg-white p-4 shadow-sm font-mono text-[11px] leading-relaxed text-ink">
        <div className="text-center">
          <p className="text-[13px] font-bold tracking-wide">{receipt.business_name.toUpperCase()}</p>
          <p className="text-fog text-[10px]">{receipt.address}</p>
          <div className="my-2 border-t border-dashed border-linedark" />
          <p className="flex justify-between">
            <span>{receipt.receipt_number}</span>
            <span>{receipt.timestamp}</span>
          </p>
          <p className="flex justify-between">
            <span>Kasir: {receipt.cashier}</span>
            <span>{receipt.customer}</span>
          </p>
          <div className="my-2 border-t border-dashed border-linedark" />
          {receipt.lines.map((l, i) => (
            <div key={i} className="mb-1 text-left">
              <p className="truncate">{l.name}</p>
              <p className="flex justify-between text-fog">
                <span>{l.qty} × {idr(l.price_minor).replace('Rp ', '')}</span>
                <span className="font-semibold text-ink">{idr(l.subtotal_minor).replace('Rp ', '')}</span>
              </p>
            </div>
          ))}
          <div className="my-2 border-t border-dashed border-linedark" />
          <p className="flex justify-between">
            <span>Subtotal</span>
            <span>{idr(receipt.subtotal_minor).replace('Rp ', '')}</span>
          </p>
          {receipt.discount_minor > 0 && (
            <p className="flex justify-between text-clay">
              <span>Diskon</span>
              <span>−{idr(receipt.discount_minor).replace('Rp ', '')}</span>
            </p>
          )}
          <p className="flex justify-between">
            <span>PPN 11%</span>
            <span>{idr(receipt.tax_minor).replace('Rp ', '')}</span>
          </p>
          <p className="flex justify-between text-[13px] font-bold">
            <span>TOTAL</span>
            <span>{idr(receipt.total_minor)}</span>
          </p>
          <p className="flex justify-between">
            <span>{receipt.method}</span>
            <span>{idr(receipt.paid_minor).replace('Rp ', '')}</span>
          </p>
          {receipt.method === 'CASH' && (
            <p className="flex justify-between">
              <span>Kembalian</span>
              <span>{idr(receipt.change_minor).replace('Rp ', '')}</span>
            </p>
          )}
          <div className="my-2 border-t border-dashed border-linedark" />
          <p className="text-fog text-[10px]">{receipt.footer}</p>
          <p className="mt-1 font-bold">· terima kasih ·</p>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          className="btn-outline flex-1 py-2.5 inline-flex items-center justify-center gap-1.5 font-semibold cursor-pointer"
          onClick={onPrint || (() => window.print())}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Cetak
        </button>
        <button
          type="button"
          className="btn-primary flex-1 py-2.5 inline-flex items-center justify-center font-semibold cursor-pointer"
          onClick={onNewTransaction}
        >
          Transaksi Baru
        </button>
      </div>
    </div>
  );
}
