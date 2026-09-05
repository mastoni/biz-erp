import React from 'react';
import Link from 'next/link';
import { Eye, FileText, PauseCircle, PlayCircle, XCircle, DollarSign, RefreshCw } from 'lucide-react';
import { CustomerSubscriptionDto } from '../types';
import { SubscriptionStatusPill } from './SubscriptionStatusPill';
import { BillingCyclePill } from './BillingCyclePill';
import { formatMinor } from '@/lib/format';

interface SubscriptionTableProps {
  subscriptions: CustomerSubscriptionDto[];
  isLoading: boolean;
  role: 'OWNER' | 'STAFF' | 'CASHIER' | null;
  onGenerateInvoice: (subscription: CustomerSubscriptionDto) => void;
  onPause: (subscription: CustomerSubscriptionDto) => void;
  onResume: (subscription: CustomerSubscriptionDto) => void;
  onCancel: (subscription: CustomerSubscriptionDto) => void;
  onEditPrice: (subscription: CustomerSubscriptionDto) => void;
}

export function SubscriptionTable({
  subscriptions,
  isLoading,
  role,
  onGenerateInvoice,
  onPause,
  onResume,
  onCancel,
  onEditPrice,
}: SubscriptionTableProps) {
  const isOwner = role === 'OWNER';
  const canMutate = role === 'OWNER' || role === 'STAFF';

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-ink/10 bg-surface p-12 text-center dark:border-ink/20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-pine/20 border-t-pine" />
        <p className="mt-3 text-xs text-ink/60">Memuat daftar langganan pelanggan...</p>
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink/15 bg-surface p-12 text-center dark:border-ink/20">
        <div className="rounded-full bg-ink/5 p-3 dark:bg-ink/10">
          <RefreshCw className="h-6 w-6 text-ink/40" />
        </div>
        <h3 className="mt-3 font-display text-sm font-bold text-ink">Tidak ada langganan ditemukan</h3>
        <p className="mt-1 max-w-sm text-xs text-ink/60">
          Belum ada data tagihan berkala pelanggan atau tidak ada yang sesuai filter pencarian.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm dark:border-ink/20">
      <table className="w-full text-left text-xs text-ink">
        <thead className="border-b border-ink/10 bg-ink/[0.02] text-[11px] font-semibold text-ink/60 uppercase tracking-wider dark:border-ink/20 dark:bg-ink/[0.05]">
          <tr>
            <th className="px-4 py-3">Pelanggan</th>
            <th className="px-4 py-3">Paket Layanan</th>
            <th className="px-4 py-3">Siklus</th>
            <th className="px-4 py-3">Harga Snapshot</th>
            <th className="px-4 py-3">Tanggal Tagih Berikutnya</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/5 dark:divide-ink/10">
          {subscriptions.map((sub) => {
            const isActive = sub.status === 'ACTIVE';
            const isPaused = sub.status === 'PAUSED';
            const isCancelled = sub.status === 'CANCELLED';

            return (
              <tr key={sub.id} className="transition-colors hover:bg-ink/[0.02] dark:hover:bg-ink/[0.04]">
                {/* Customer */}
                <td className="px-4 py-3 font-medium text-ink">
                  <div>
                    <span className="font-semibold">{sub.customer_name || 'Pelanggan'}</span>
                    <p className="text-[11px] text-ink/40 font-mono">{sub.customer_id.slice(0, 8)}...</p>
                  </div>
                </td>

                {/* Package Name */}
                <td className="px-4 py-3">
                  <div>
                    <span className="font-semibold text-ink">{sub.name}</span>
                    {sub.notes && <p className="text-[11px] text-ink/50 line-clamp-1">{sub.notes}</p>}
                  </div>
                </td>

                {/* Cycle */}
                <td className="px-4 py-3">
                  <BillingCyclePill cycle={sub.billing_cycle} />
                </td>

                {/* Snapshot Total */}
                <td className="px-4 py-3">
                  <span className="font-display font-semibold text-ink">
                    {formatMinor(sub.total_minor)}
                  </span>
                  {sub.tax_minor > 0 && (
                    <p className="text-[10px] text-ink/40">Inc. PPN {formatMinor(sub.tax_minor)}</p>
                  )}
                </td>

                {/* Next Billing Date */}
                <td className="px-4 py-3 font-mono text-xs">
                  {isCancelled ? (
                    <span className="text-ink/40 italic">Nonaktif</span>
                  ) : (
                    <div>
                      <span>{sub.next_billing_date}</span>
                      <p className="text-[10px] text-ink/50">Tgl {sub.anchor_day} tiap siklus</p>
                    </div>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <SubscriptionStatusPill status={sub.status} />
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {/* View Detail Link */}
                    <Link
                      href={`/billing/subscriptions/${sub.id}`}
                      className="rounded-lg p-1.5 text-ink/60 hover:bg-ink/5 hover:text-ink dark:hover:bg-ink/10"
                      title="Lihat Detail"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>

                    {/* Generate Invoice (OWNER, STAFF) */}
                    {canMutate && isActive && (
                      <button
                        onClick={() => onGenerateInvoice(sub)}
                        className="rounded-lg p-1.5 text-sky-600 hover:bg-sky-500/10 dark:text-sky-400"
                        title="Terbitkan Tagihan Manual"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    )}

                    {/* Financial Price Amendment (OWNER only) */}
                    {isOwner && !isCancelled && (
                      <button
                        onClick={() => onEditPrice(sub)}
                        className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-400"
                        title="Ubah Nominal & Harga (OWNER)"
                      >
                        <DollarSign className="h-4 w-4" />
                      </button>
                    )}

                    {/* Pause (OWNER, STAFF) */}
                    {canMutate && isActive && (
                      <button
                        onClick={() => onPause(sub)}
                        className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                        title="Tunda Langganan"
                      >
                        <PauseCircle className="h-4 w-4" />
                      </button>
                    )}

                    {/* Resume (OWNER, STAFF) */}
                    {canMutate && isPaused && (
                      <button
                        onClick={() => onResume(sub)}
                        className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                        title="Aktifkan Kembali"
                      >
                        <PlayCircle className="h-4 w-4" />
                      </button>
                    )}

                    {/* Cancel (OWNER only) */}
                    {isOwner && !isCancelled && (
                      <button
                        onClick={() => onCancel(sub)}
                        className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                        title="Batalkan Langganan (OWNER)"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
