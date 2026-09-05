'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { formatMinor } from '@/lib/format';
import { getReceivablePayments, getPurchaseById, getFinanceApiErrorMessage } from '../api';
import type { ReceivableItem, PayableItem, CustomerPaymentItem, PurchasePaymentItem } from '../types';
import { History, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';

export interface DebtAuditHistoryModalProps {
  open: boolean;
  onClose: () => void;
  kind: 'piutang' | 'hutang';
  item: ReceivableItem | PayableItem | null;
}

export function DebtAuditHistoryModal({
  open,
  onClose,
  kind,
  item,
}: DebtAuditHistoryModalProps) {
  const [payments, setPayments] = useState<Array<CustomerPaymentItem | PurchasePaymentItem>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isPiutang = kind === 'piutang';

  useEffect(() => {
    if (!open || !item) {
      setPayments([]);
      setError(null);
      return;
    }

    let isMounted = true;
    async function loadHistory() {
      setIsLoading(true);
      setError(null);
      try {
        if (isPiutang) {
          const list = await getReceivablePayments(item!.id);
          if (isMounted) {
            setPayments(list || []);
          }
        } else {
          const details = await getPurchaseById(item!.id);
          if (isMounted) {
            setPayments(details.payments || []);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(getFinanceApiErrorMessage(err));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [open, item, isPiutang]);

  if (!item) return null;

  const partyName = isPiutang
    ? (item as ReceivableItem).customer_name || (item as ReceivableItem).customer_id || 'Pelanggan'
    : (item as PayableItem).supplier_name || 'Supplier';

  const refCode = isPiutang
    ? (item as ReceivableItem).id.slice(0, 8)
    : (item as PayableItem).code || (item as PayableItem).id.slice(0, 8);

  const totalAmount = item.total_minor;
  const paidAmount = item.paid_minor || 0;
  const outstandingAmount = item.outstanding_minor;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isPiutang ? 'Riwayat Pelunasan Piutang' : 'Riwayat Pembayaran Hutang'}
      description={
        isPiutang
          ? `Catatan transaksi pembayaran yang telah diterima dari ${partyName}.`
          : `Catatan transaksi pelunasan hutang pembelian kepada ${partyName}.`
      }
      maxWidth="lg"
    >
      <div className="space-y-4 pt-2">
        {/* Summary Card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl border border-line bg-paper/50 p-3.5 text-xs">
          <div>
            <span className="text-fog font-medium">{isPiutang ? 'Pelanggan' : 'Supplier'}</span>
            <p className="font-bold text-ink mt-0.5 truncate">{partyName}</p>
          </div>
          <div>
            <span className="text-fog font-medium">No. Referensi</span>
            <p className="font-bold text-ink mt-0.5 font-mono">{refCode}</p>
          </div>
          <div>
            <span className="text-fog font-medium">Total Tagihan</span>
            <p className="font-bold text-ink mt-0.5">{formatMinor(totalAmount)}</p>
          </div>
          <div>
            <span className="text-fog font-medium">Sisa Outstanding</span>
            <p className="font-bold text-rose-700 mt-0.5">{formatMinor(outstandingAmount)}</p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="space-y-2 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-paper" />
            ))}
          </div>
        )}

        {/* Payments Table */}
        {!isLoading && !error && (
          <div className="rounded-2xl border border-line bg-surface overflow-hidden">
            <div className="border-b border-line bg-paper/40 px-4 py-2.5 flex items-center justify-between">
              <span className="font-display text-xs font-bold text-ink flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-pine" />
                Rincian Riwayat Pembayaran ({payments.length})
              </span>
              <span className="text-[11px] font-semibold text-fog">
                Total Terbayar: <span className="font-bold text-emerald-700">{formatMinor(paidAmount)}</span>
              </span>
            </div>

            {payments.length === 0 ? (
              <div className="p-8 text-center text-fog text-xs">
                <History className="h-8 w-8 mx-auto text-fog/40 mb-2" />
                <p className="font-semibold text-ink">Belum ada riwayat pembayaran yang tercatat.</p>
                <p className="text-[11px] text-fog mt-0.5">
                  Transaksi pembayaran yang dilakukan akan otomatis tercatat di sini.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-line bg-paper/60 text-[10.5px] font-bold uppercase text-fog">
                    <tr>
                      <th className="py-2.5 px-4">Tanggal</th>
                      <th className="py-2.5 px-3">Metode</th>
                      <th className="py-2.5 px-3">Referensi</th>
                      <th className="py-2.5 px-4 text-right">Nominal Dibayar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/40">
                    {payments.map((p, idx) => (
                      <tr key={p.id || idx} className="hover:bg-paper/30 transition">
                        <td className="py-2.5 px-4 font-medium text-ink whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-fog" />
                            {'date' in p && p.date ? p.date : p.created_at ? p.created_at.slice(0, 10) : '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 capitalize text-ink">
                          <span className="rounded bg-paper border border-line px-1.5 py-0.5 text-[10px] font-semibold text-fog">
                            {p.method}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-fog">
                          {p.reference || '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-700">
                          {formatMinor(p.amount_minor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-line bg-paper/40 font-bold">
                    <tr>
                      <td colSpan={3} className="py-2.5 px-4 text-ink">Total Penerimaan Tercatat</td>
                      <td className="py-2.5 px-4 text-right text-emerald-700">
                        {formatMinor(payments.reduce((sum, p) => sum + (p.amount_minor || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink shadow-2xs hover:bg-paper cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
}
