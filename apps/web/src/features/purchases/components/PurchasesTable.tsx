'use client';

import React, { Fragment, useState } from 'react';
import {
  Check,
  ChevronDown,
  CreditCard,
  PackageCheck,
  Send,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { idr, num } from '../purchase-helpers';
import type { PurchaseViewModel } from '../types';

interface PurchasesTableProps {
  purchases: PurchaseViewModel[];
  isOwner: boolean;
  onSend: (po: PurchaseViewModel) => Promise<void>;
  onReceive: (po: PurchaseViewModel) => void;
  onPay: (po: PurchaseViewModel) => void;
  onCancel: (po: PurchaseViewModel) => Promise<void>;
  onDeleteDraft: (po: PurchaseViewModel) => Promise<void>;
}

export function PurchasesTable({
  purchases,
  isOwner,
  onSend,
  onReceive,
  onPay,
  onCancel,
  onDeleteDraft,
}: PurchasesTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleAction = async (
    id: string,
    actionFn: () => Promise<void>
  ) => {
    setActionLoadingId(id);
    try {
      await actionFn();
    } finally {
      setActionLoadingId(null);
    }
  };

  const getToneBadgeClass = (tone: string) => {
    switch (tone) {
      case 'pine':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'tide':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'clay':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'fog':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left">
          <thead>
            <tr className="border-b border-line bg-paper/60 text-[11px] font-bold uppercase tracking-wider text-fog">
              <th className="w-10 px-4 py-3.5"></th>
              <th className="px-4 py-3.5">No. PO</th>
              <th className="px-4 py-3.5">Supplier</th>
              <th className="px-4 py-3.5">Tanggal</th>
              <th className="px-4 py-3.5">Jatuh Tempo</th>
              <th className="px-4 py-3.5 text-center">Item</th>
              <th className="px-4 py-3.5 text-right">Nilai</th>
              <th className="px-4 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60 text-[13px]">
            {purchases.map((po) => {
              const isOpen = expandedId === po.id;
              const isLoading = actionLoadingId === po.id;

              return (
                <Fragment key={po.id}>
                  <tr
                    onClick={() => toggleExpand(po.id)}
                    className={`group cursor-pointer transition hover:bg-paper/50 ${
                      isOpen ? 'bg-paper/40' : ''
                    }`}
                  >
                    {/* Expand Chevron */}
                    <td className="px-4 py-3.5">
                      <ChevronDown
                        width={16}
                        height={16}
                        className={`text-fog transition-transform duration-200 group-hover:text-ink ${
                          isOpen ? 'rotate-180 text-pine' : ''
                        }`}
                      />
                    </td>

                    {/* PO Code */}
                    <td className="num px-4 py-3.5 font-bold text-ink">
                      {po.code}
                    </td>

                    {/* Supplier */}
                    <td className="px-4 py-3.5 font-medium text-ink">
                      {po.supplier_name || po.supplier_code || 'Supplier'}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3.5 text-fog">{po.date}</td>

                    {/* Due Date */}
                    <td className="px-4 py-3.5 text-fog">{po.due_date}</td>

                    {/* Items Count */}
                    <td className="num px-4 py-3.5 text-center font-medium text-ink">
                      {po.ordered_total_qty}
                    </td>

                    {/* Total Value */}
                    <td className="num px-4 py-3.5 text-right font-bold text-ink">
                      {idr(po.total_minor)}
                    </td>

                    {/* Status Badges */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${getToneBadgeClass(
                            po.status_tone
                          )}`}
                        >
                          {po.status_label}
                        </span>

                        {po.status !== 'cancelled' && po.status !== 'draft' && (
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${
                              po.payment_state === 'paid'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : po.payment_state === 'partial'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {po.payment_state === 'paid'
                              ? 'Lunas'
                              : po.payment_state === 'partial'
                              ? 'Sebagian'
                              : 'Hutang'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Detail View */}
                  {isOpen && (
                    <tr className="bg-paper/30">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid gap-4 md:grid-cols-[1fr_300px]">
                          {/* Left: Line Items */}
                          <div className="rounded-xl border border-line bg-surface shadow-2xs">
                            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-fog">
                                Item Pesanan ({po.items.length})
                              </p>
                              {po.status === 'partial' && (
                                <span className="text-xs font-bold text-sky-700">
                                  Diterima {po.receive_percentage}% ({po.received_total_qty}/{po.ordered_total_qty} unit)
                                </span>
                              )}
                            </div>
                            <ul className="divide-y divide-line/60">
                              {po.items.map((it) => (
                                <li
                                  key={it.id}
                                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-ink">
                                      {it.product_name}
                                    </p>
                                    <p className="num text-fog">
                                      {it.received_qty > 0 ? (
                                        <span>
                                          Diterima {it.received_qty} dari {it.ordered_qty} unit · {idr(it.unit_cost_minor)}
                                        </span>
                                      ) : (
                                        <span>
                                          {it.ordered_qty} unit × {idr(it.unit_cost_minor)}
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                  <span className="num font-bold text-ink">
                                    {idr(it.subtotal_minor)}
                                  </span>
                                </li>
                              ))}
                              <li className="flex items-center justify-between bg-paper/40 px-4 py-2.5 text-xs font-bold">
                                <span className="text-ink">Total Pesanan</span>
                                <span className="num text-sm text-pine">
                                  {idr(po.total_minor)}
                                </span>
                              </li>
                            </ul>
                          </div>

                          {/* Right: Info & Actions */}
                          <div className="space-y-3">
                            {/* Note */}
                            {po.note && (
                              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
                                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                                  Catatan
                                </p>
                                {po.note}
                              </div>
                            )}

                            {/* Terms & Financials */}
                            <div className="rounded-xl border border-line bg-surface p-3 text-xs space-y-1.5 shadow-2xs">
                              <div className="flex justify-between">
                                <span className="text-fog">Termin Supplier:</span>
                                <span className="font-bold text-ink">
                                  {po.supplier_term}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-fog">Diterima:</span>
                                <span className="num font-medium text-ink">
                                  {idr(po.received_minor)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-fog">Dibayar:</span>
                                <span className="num font-medium text-ink">
                                  {idr(po.paid_minor)}
                                </span>
                              </div>
                              <div className="flex justify-between border-t border-line/60 pt-1.5 font-bold">
                                <span className="text-fog">Sisa Tagihan:</span>
                                <span className="num text-clay">
                                  {idr(po.outstanding_minor)}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-2">
                              {/* 1. DRAFT Actions */}
                              {po.status === 'draft' && isOwner && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAction(po.id, () => onSend(po));
                                    }}
                                    disabled={isLoading}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-pine px-4 py-2.5 text-xs font-bold text-white transition hover:bg-pine-deep disabled:opacity-50 cursor-pointer"
                                  >
                                    <Send width={14} height={14} />
                                    {isLoading ? 'Mengirim...' : 'Kirim ke Supplier'}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAction(po.id, () => onDeleteDraft(po));
                                    }}
                                    disabled={isLoading}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-clay transition hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
                                  >
                                    <Trash2 width={14} height={14} />
                                    Hapus Draft
                                  </button>
                                </>
                              )}

                              {/* 2. SENT / PARTIAL Actions (Receive + Pay + Cancel) */}
                              {(po.status === 'sent' || po.status === 'partial') && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onReceive(po);
                                    }}
                                    disabled={isLoading}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-pine px-4 py-2.5 text-xs font-bold text-white transition hover:bg-pine-deep disabled:opacity-50 cursor-pointer"
                                  >
                                    <PackageCheck width={15} height={15} />
                                    Terima Barang (+ Stok)
                                  </button>

                                  {po.supplier_term !== 'Tunai' && po.outstanding_minor > 0 && (
                                    <button
                                      onClick={(e) => {
                                      e.stopPropagation();
                                      onPay(po);
                                    }}
                                      disabled={isLoading}
                                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50 cursor-pointer"
                                    >
                                      <CreditCard width={14} height={14} />
                                      Bayar Tagihan Tempo
                                    </button>
                                  )}

                                  {isOwner && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAction(po.id, () => onCancel(po));
                                      }}
                                      disabled={isLoading}
                                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-clay transition hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
                                    >
                                      <X width={14} height={14} />
                                      Batalkan PO
                                    </button>
                                  )}
                                </>
                              )}

                              {/* 3. RECEIVED Actions (Tempo Payment if outstanding) */}
                              {po.status === 'received' && (
                                <>
                                  {po.supplier_term !== 'Tunai' && po.outstanding_minor > 0 ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onPay(po);
                                      }}
                                      disabled={isLoading}
                                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
                                    >
                                      <CreditCard width={14} height={14} />
                                      Bayar Tagihan ({idr(po.outstanding_minor)})
                                    </button>
                                  ) : (
                                    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800">
                                      <Check width={15} height={15} />
                                      {po.supplier_term === 'Tunai'
                                        ? 'Barang diterima & lunas dibayar tunai.'
                                        : 'Barang diterima & seluruh tagihan lunas.'}
                                    </div>
                                  )}
                                </>
                              )}

                              {/* 4. CANCELLED info */}
                              {po.status === 'cancelled' && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-xs text-fog">
                                  Pesanan pembelian telah dibatalkan.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
