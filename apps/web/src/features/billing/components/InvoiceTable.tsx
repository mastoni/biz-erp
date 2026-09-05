import React from 'react';
import Link from 'next/link';
import { Eye, CreditCard, XCircle, Receipt } from 'lucide-react';
import { CustomerInvoiceDto } from '../types';
import { InvoiceStatusPill } from './InvoiceStatusPill';
import { formatMinor } from '@/lib/format';

interface InvoiceTableProps {
  invoices: CustomerInvoiceDto[];
  isLoading: boolean;
  role: 'OWNER' | 'STAFF' | 'CASHIER' | null;
  onRecordPayment: (invoice: CustomerInvoiceDto) => void;
  onCancelInvoice: (invoice: CustomerInvoiceDto) => void;
}

export function InvoiceTable({
  invoices,
  isLoading,
  role,
  onRecordPayment,
  onCancelInvoice,
}: InvoiceTableProps) {
  const isOwner = role === 'OWNER';

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-ink/10 bg-surface p-12 text-center dark:border-ink/20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-pine/20 border-t-pine" />
        <p className="mt-3 text-xs text-ink/60">Memuat daftar tagihan pelanggan...</p>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink/15 bg-surface p-12 text-center dark:border-ink/20">
        <div className="rounded-full bg-ink/5 p-3 dark:bg-ink/10">
          <Receipt className="h-6 w-6 text-ink/40" />
        </div>
        <h3 className="mt-3 font-display text-sm font-bold text-ink">Tidak ada tagihan ditemukan</h3>
        <p className="mt-1 max-w-sm text-xs text-ink/60">
          Belum ada invoice yang diterbitkan atau tidak ada yang cocok dengan filter pencarian.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm dark:border-ink/20">
      <table className="w-full text-left text-xs text-ink">
        <thead className="border-b border-ink/10 bg-ink/[0.02] text-[11px] font-semibold text-ink/60 uppercase tracking-wider dark:border-ink/20 dark:bg-ink/[0.05]">
          <tr>
            <th className="px-4 py-3">No. Invoice</th>
            <th className="px-4 py-3">Pelanggan</th>
            <th className="px-4 py-3">Periode Pemakaian</th>
            <th className="px-4 py-3">Jatuh Tempo</th>
            <th className="px-4 py-3">Total Tagihan</th>
            <th className="px-4 py-3">Sisa Piutang (AR)</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/5 dark:divide-ink/10">
          {invoices.map((inv) => {
            const isPayable = inv.status === 'ISSUED' || inv.status === 'OVERDUE';
            const isCancellable = isOwner && (inv.status === 'ISSUED' || inv.status === 'OVERDUE');
            const outstanding = inv.outstanding_minor ?? (inv.status === 'PAID' ? 0 : inv.total_minor);

            return (
              <tr key={inv.id} className="transition-colors hover:bg-ink/[0.02] dark:hover:bg-ink/[0.04]">
                {/* Invoice Number */}
                <td className="px-4 py-3 font-mono font-bold text-ink">{inv.invoice_number}</td>

                {/* Customer */}
                <td className="px-4 py-3 font-medium text-ink">
                  <div>
                    <span className="font-semibold">{inv.customer_name || 'Pelanggan'}</span>
                    <p className="text-[11px] text-ink/40 font-mono">{inv.customer_id.slice(0, 8)}...</p>
                  </div>
                </td>

                {/* Period */}
                <td className="px-4 py-3 text-ink/70">
                  <span>{inv.billing_period_start}</span>
                  <p className="text-[11px] text-ink/50">s/d {inv.billing_period_end}</p>
                </td>

                {/* Due Date */}
                <td className="px-4 py-3 font-mono text-xs text-ink/80">{inv.due_date}</td>

                {/* Total */}
                <td className="px-4 py-3">
                  <span className="font-display font-semibold text-ink">{formatMinor(inv.total_minor)}</span>
                </td>

                {/* Outstanding AR */}
                <td className="px-4 py-3">
                  {inv.status === 'PAID' ? (
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Lunas (Rp 0)</span>
                  ) : inv.status === 'CANCELLED' ? (
                    <span className="text-[11px] text-ink/40 line-through">Dibatalkan</span>
                  ) : (
                    <span className="font-display font-semibold text-amber-600 dark:text-amber-400">
                      {formatMinor(outstanding)}
                    </span>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <InvoiceStatusPill status={inv.status} />
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {/* View Detail Link */}
                    <Link
                      href={`/billing/invoices/${inv.id}`}
                      className="rounded-lg p-1.5 text-ink/60 hover:bg-ink/5 hover:text-ink dark:hover:bg-ink/10"
                      title="Lihat Detail Tagihan"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>

                    {/* Record Payment (All roles) */}
                    {isPayable && (
                      <button
                        onClick={() => onRecordPayment(inv)}
                        className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                        title="Catat Pembayaran"
                      >
                        <CreditCard className="h-4 w-4" />
                      </button>
                    )}

                    {/* Cancel Invoice (OWNER only) */}
                    {isCancellable && (
                      <button
                        onClick={() => onCancelInvoice(inv)}
                        className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                        title="Batalkan Invoice (OWNER)"
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
