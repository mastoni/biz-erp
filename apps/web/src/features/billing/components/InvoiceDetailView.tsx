import React from 'react';
import Link from 'next/link';
import {
  Receipt,
  User,
  RefreshCw,
  DollarSign,
  BookOpen,
  CreditCard,
  XCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
} from 'lucide-react';
import { CustomerInvoiceDetailDto, CustomerInvoiceDto } from '../types';
import { InvoiceStatusPill } from './InvoiceStatusPill';
import { BillingCyclePill } from './BillingCyclePill';
import { formatMinor } from '@/lib/format';

interface InvoiceDetailViewProps {
  invoice: CustomerInvoiceDetailDto;
  role: 'OWNER' | 'STAFF' | 'CASHIER' | null;
  onRecordPayment: (invoice: CustomerInvoiceDto) => void;
  onCancelInvoice: (invoice: CustomerInvoiceDto) => void;
}

export function InvoiceDetailView({
  invoice,
  role,
  onRecordPayment,
  onCancelInvoice,
}: InvoiceDetailViewProps) {
  const isOwner = role === 'OWNER';
  const isPayable = invoice.status === 'ISSUED' || invoice.status === 'OVERDUE';
  const isCancellable = isOwner && (invoice.status === 'ISSUED' || invoice.status === 'OVERDUE');
  const outstanding = invoice.outstanding_minor ?? (invoice.status === 'PAID' ? 0 : invoice.total_minor);
  const payments = invoice.payments || [];

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-ink/20">
        <div className="flex items-start gap-4">
          <Link
            href="/billing/invoices"
            className="mt-1 rounded-lg border border-ink/15 p-2 text-ink/60 hover:bg-ink/5 hover:text-ink dark:border-ink/25"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display font-mono text-xl font-bold text-ink">{invoice.invoice_number}</h1>
              <InvoiceStatusPill status={invoice.status} />
            </div>
            <p className="mt-1 text-xs text-ink/60">
              Diterbitkan: {invoice.issue_date} • Jatuh Tempo: {invoice.due_date}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Record Payment (All roles) */}
          {isPayable && (
            <button
              onClick={() => onRecordPayment(invoice)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              <CreditCard className="h-4 w-4" />
              Catat Pembayaran
            </button>
          )}

          {/* Cancel Invoice (OWNER only) */}
          {isCancellable && (
            <button
              onClick={() => onCancelInvoice(invoice)}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
            >
              <XCircle className="h-4 w-4" />
              Batalkan Tagihan (OWNER)
            </button>
          )}
        </div>
      </div>

      {/* Grid Details */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Customer & Subscription info */}
        <div className="rounded-2xl border border-ink/10 bg-surface p-5 shadow-sm dark:border-ink/20">
          <div className="flex items-center gap-2 border-b border-ink/10 pb-3 dark:border-ink/20">
            <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-display text-xs font-bold text-ink uppercase tracking-wider">Data Pelanggan & Paket</h2>
          </div>
          <div className="mt-4 space-y-3 text-xs">
            <div>
              <span className="text-ink/50">Pelanggan:</span>
              <p className="font-semibold text-ink">{invoice.customer_name || 'Tidak diketahui'}</p>
            </div>
            <div>
              <span className="text-ink/50">Kontak:</span>
              <p className="text-ink">
                {invoice.customer_phone}
                {invoice.customer_phone && invoice.customer_email ? ' • ' : ''}
                {invoice.customer_email}
                {!invoice.customer_phone && !invoice.customer_email ? '-' : ''}
              </p>
            </div>
            <div>
              <span className="text-ink/50">Paket Langganan:</span>
              <div className="mt-0.5 flex items-center gap-2">
                <Link
                  href={`/billing/subscriptions/${invoice.customer_subscription_id}`}
                  className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  {invoice.subscription_name || 'Lihat Langganan'}
                </Link>
                {invoice.subscription_billing_cycle && (
                  <BillingCyclePill cycle={invoice.subscription_billing_cycle} />
                )}
              </div>
            </div>
            <div>
              <span className="text-ink/50">Periode Tagihan:</span>
              <p className="font-mono text-ink">
                {invoice.billing_period_start} s/d {invoice.billing_period_end}
              </p>
            </div>
          </div>
        </div>

        {/* Financial Breakdown */}
        <div className="rounded-2xl border border-ink/10 bg-surface p-5 shadow-sm dark:border-ink/20">
          <div className="flex items-center gap-2 border-b border-ink/10 pb-3 dark:border-ink/20">
            <DollarSign className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-display text-xs font-bold text-ink uppercase tracking-wider">Rincian Finansial</h2>
          </div>
          <div className="mt-4 space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-ink/50">Subtotal:</span>
              <span className="font-medium text-ink">{formatMinor(invoice.subtotal_minor)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/50">Diskon:</span>
              <span className="font-medium text-rose-600 dark:text-rose-400">
                {invoice.discount_minor > 0 ? `-${formatMinor(invoice.discount_minor)}` : 'Rp 0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/50">PPN / Pajak:</span>
              <span className="font-medium text-ink">{formatMinor(invoice.tax_minor)}</span>
            </div>
            <div className="flex justify-between border-t border-ink/10 pt-2 font-semibold dark:border-ink/20">
              <span className="text-ink">Total Tagihan:</span>
              <span className="font-display text-sm font-bold text-ink">{formatMinor(invoice.total_minor)}</span>
            </div>
            <div className="flex justify-between border-t border-ink/10 pt-2 text-xs dark:border-ink/20">
              <span className="text-ink/60">Sudah Terbayar:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {formatMinor(invoice.paid_minor ?? (invoice.status === 'PAID' ? invoice.total_minor : 0))}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-ink/60">Sisa Piutang:</span>
              <span className="font-display font-bold text-amber-600 dark:text-amber-400">
                {formatMinor(outstanding)}
              </span>
            </div>
          </div>
        </div>

        {/* Accounting & AR Linkage */}
        <div className="rounded-2xl border border-ink/10 bg-surface p-5 shadow-sm dark:border-ink/20">
          <div className="flex items-center gap-2 border-b border-ink/10 pb-3 dark:border-ink/20">
            <BookOpen className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <h2 className="font-display text-xs font-bold text-ink uppercase tracking-wider">Integrasi Buku Besar & AR</h2>
          </div>
          <div className="mt-4 space-y-3 text-xs">
            <div>
              <span className="text-ink/50">ID Piutang Usaha (AR):</span>
              <p className="font-mono text-[11px] text-ink/80">{invoice.receivable_id}</p>
            </div>
            <div>
              <span className="text-ink/50">Status Piutang:</span>
              <p className="font-semibold text-ink">{invoice.receivable_status || invoice.status}</p>
            </div>
            <div>
              <span className="text-ink/50">Jurnal Otomatis Terposting:</span>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium mt-0.5">
                <CheckCircle className="h-3.5 w-3.5" />
                Dr Piutang Usaha / Cr Pendapatan ({formatMinor(invoice.total_minor)})
              </p>
            </div>
            {invoice.paid_at && (
              <div>
                <span className="text-ink/50">Lunas Pada:</span>
                <p className="font-mono text-ink text-[11px]">{invoice.paid_at}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment History Records */}
      <div className="rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm dark:border-ink/20">
        <div className="flex items-center justify-between border-b border-ink/10 pb-4 dark:border-ink/20">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-ink/60" />
            <h2 className="font-display text-sm font-bold text-ink">Riwayat Pembayaran Kas</h2>
          </div>
          <span className="text-xs text-ink/50">{payments.length} transaksi pembayaran</span>
        </div>

        {payments.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink/50">
            {invoice.status === 'PAID'
              ? 'Tagihan telah tercatat lunas.'
              : 'Belum ada pembayaran yang tercatat untuk tagihan ini.'}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs text-ink">
              <thead className="border-b border-ink/10 bg-ink/[0.02] text-[11px] font-semibold text-ink/60 uppercase tracking-wider dark:border-ink/20 dark:bg-ink/[0.05]">
                <tr>
                  <th className="px-4 py-3">Waktu Bayar</th>
                  <th className="px-4 py-3">Metode Pembayaran</th>
                  <th className="px-4 py-3">Nomor Referensi</th>
                  <th className="px-4 py-3 text-right">Nominal Masuk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5 dark:divide-ink/10">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-ink/[0.02] dark:hover:bg-ink/[0.04]">
                    <td className="px-4 py-3 font-mono text-ink/70">{p.created_at?.slice(0, 16).replace('T', ' ')}</td>
                    <td className="px-4 py-3 font-medium text-ink uppercase">{p.method}</td>
                    <td className="px-4 py-3 font-mono text-ink/60">{p.reference || '-'}</td>
                    <td className="px-4 py-3 text-right font-display font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatMinor(p.amount_minor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
