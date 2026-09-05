import React from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  Calendar,
  DollarSign,
  User,
  FileText,
  PauseCircle,
  PlayCircle,
  XCircle,
  ArrowLeft,
  Receipt,
  CheckCircle,
} from 'lucide-react';
import { CustomerSubscriptionDetailDto, CustomerSubscriptionDto } from '../types';
import { SubscriptionStatusPill } from './SubscriptionStatusPill';
import { BillingCyclePill } from './BillingCyclePill';
import { InvoiceStatusPill } from './InvoiceStatusPill';
import { formatMinor } from '@/lib/format';

interface SubscriptionDetailViewProps {
  subscription: CustomerSubscriptionDetailDto;
  role: 'OWNER' | 'STAFF' | 'CASHIER' | null;
  onGenerateInvoice: (subscription: CustomerSubscriptionDto) => void;
  onPause: (subscription: CustomerSubscriptionDto) => void;
  onResume: (subscription: CustomerSubscriptionDto) => void;
  onCancel: (subscription: CustomerSubscriptionDto) => void;
  onEditPrice: (subscription: CustomerSubscriptionDto) => void;
}

export function SubscriptionDetailView({
  subscription,
  role,
  onGenerateInvoice,
  onPause,
  onResume,
  onCancel,
  onEditPrice,
}: SubscriptionDetailViewProps) {
  const isOwner = role === 'OWNER';
  const canMutate = role === 'OWNER' || role === 'STAFF';

  const isActive = subscription.status === 'ACTIVE';
  const isPaused = subscription.status === 'PAUSED';
  const isCancelled = subscription.status === 'CANCELLED';

  const invoices = subscription.invoices || [];

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-ink/20">
        <div className="flex items-start gap-4">
          <Link
            href="/billing/subscriptions"
            className="mt-1 rounded-lg border border-ink/15 p-2 text-ink/60 hover:bg-ink/5 hover:text-ink dark:border-ink/25"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-xl font-bold text-ink">{subscription.name}</h1>
              <SubscriptionStatusPill status={subscription.status} />
            </div>
            <p className="mt-1 text-xs text-ink/60">ID Langganan: {subscription.id}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Generate Invoice (OWNER, STAFF) */}
          {canMutate && isActive && (
            <button
              onClick={() => onGenerateInvoice(subscription)}
              className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700"
            >
              <FileText className="h-4 w-4" />
              Terbitkan Tagihan
            </button>
          )}

          {/* Edit Price (OWNER only) */}
          {isOwner && !isCancelled && (
            <button
              onClick={() => onEditPrice(subscription)}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-400"
            >
              <DollarSign className="h-4 w-4" />
              Ubah Harga
            </button>
          )}

          {/* Pause (OWNER, STAFF) */}
          {canMutate && isActive && (
            <button
              onClick={() => onPause(subscription)}
              className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
            >
              <PauseCircle className="h-4 w-4" />
              Tunda
            </button>
          )}

          {/* Resume (OWNER, STAFF) */}
          {canMutate && isPaused && (
            <button
              onClick={() => onResume(subscription)}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
            >
              <PlayCircle className="h-4 w-4" />
              Aktifkan
            </button>
          )}

          {/* Cancel (OWNER only) */}
          {isOwner && !isCancelled && (
            <button
              onClick={() => onCancel(subscription)}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
            >
              <XCircle className="h-4 w-4" />
              Batalkan
            </button>
          )}
        </div>
      </div>

      {/* Grid Details */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Customer Information */}
        <div className="rounded-2xl border border-ink/10 bg-surface p-5 shadow-sm dark:border-ink/20">
          <div className="flex items-center gap-2 border-b border-ink/10 pb-3 dark:border-ink/20">
            <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-display text-xs font-bold text-ink uppercase tracking-wider">Informasi Pelanggan</h2>
          </div>
          <div className="mt-4 space-y-3 text-xs">
            <div>
              <span className="text-ink/50">Nama Pelanggan:</span>
              <p className="font-semibold text-ink">{subscription.customer_name || 'Tidak diketahui'}</p>
            </div>
            <div>
              <span className="text-ink/50">Kontak:</span>
              <p className="text-ink">
                {subscription.customer_phone}
                {subscription.customer_phone && subscription.customer_email ? ' • ' : ''}
                {subscription.customer_email}
                {!subscription.customer_phone && !subscription.customer_email ? '-' : ''}
              </p>
            </div>
            <div>
              <span className="text-ink/50">Alamat Pemasangan:</span>
              <p className="text-ink">{subscription.customer_address || '-'}</p>
            </div>
            <div>
              <span className="text-ink/50">ID Pelanggan (CRM):</span>
              <p className="font-mono text-[11px] text-ink/70">{subscription.customer_id}</p>
            </div>
          </div>
        </div>

        {/* Pricing Snapshot */}
        <div className="rounded-2xl border border-ink/10 bg-surface p-5 shadow-sm dark:border-ink/20">
          <div className="flex items-center gap-2 border-b border-ink/10 pb-3 dark:border-ink/20">
            <DollarSign className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-display text-xs font-bold text-ink uppercase tracking-wider">Snapshot Harga Finansial</h2>
          </div>
          <div className="mt-4 space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-ink/50">Harga Pokok (Unit):</span>
              <span className="font-medium text-ink">{formatMinor(subscription.unit_price_minor)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/50">Diskon Rutin:</span>
              <span className="font-medium text-rose-600 dark:text-rose-400">
                {subscription.discount_minor > 0 ? `-${formatMinor(subscription.discount_minor)}` : 'Rp 0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/50">PPN / Pajak:</span>
              <span className="font-medium text-ink">{formatMinor(subscription.tax_minor)}</span>
            </div>
            <div className="flex justify-between border-t border-ink/10 pt-2 font-semibold dark:border-ink/20">
              <span className="text-ink">Total per Siklus:</span>
              <span className="font-display text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {formatMinor(subscription.total_minor)}
              </span>
            </div>
            <div className="mt-2 rounded-lg bg-ink/5 p-2 text-[11px] text-ink/60 dark:bg-ink/10">
              Mata Uang: {subscription.currency || 'IDR'}
            </div>
          </div>
        </div>

        {/* Schedule & Lifecycle */}
        <div className="rounded-2xl border border-ink/10 bg-surface p-5 shadow-sm dark:border-ink/20">
          <div className="flex items-center gap-2 border-b border-ink/10 pb-3 dark:border-ink/20">
            <Calendar className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <h2 className="font-display text-xs font-bold text-ink uppercase tracking-wider">Jadwal Penagihan</h2>
          </div>
          <div className="mt-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-ink/50">Siklus:</span>
              <BillingCyclePill cycle={subscription.billing_cycle} />
            </div>
            <div className="flex justify-between">
              <span className="text-ink/50">Tanggal Tagih (Anchor):</span>
              <span className="font-semibold text-ink">Setiap tanggal {subscription.anchor_day}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/50">Jatuh Tempo Berikutnya:</span>
              <span className="font-mono font-semibold text-ink">{subscription.next_billing_date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/50">Mulai Berlangganan:</span>
              <span className="text-ink">{subscription.starts_at?.slice(0, 10)}</span>
            </div>
            {subscription.ends_at && (
              <div className="flex justify-between">
                <span className="text-ink/50">Berakhir Pada:</span>
                <span className="text-rose-600">{subscription.ends_at?.slice(0, 10)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Linked Invoices Section */}
      <div className="rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm dark:border-ink/20">
        <div className="flex items-center justify-between border-b border-ink/10 pb-4 dark:border-ink/20">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-ink/60" />
            <h2 className="font-display text-sm font-bold text-ink">Riwayat Tagihan & Invoice Terkait</h2>
          </div>
          <span className="text-xs text-ink/50">{invoices.length} tagihan tercatat</span>
        </div>

        {invoices.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink/50">
            Belum ada invoice yang diterbitkan untuk langganan ini.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs text-ink">
              <thead className="border-b border-ink/10 bg-ink/[0.02] text-[11px] font-semibold text-ink/60 uppercase tracking-wider dark:border-ink/20 dark:bg-ink/[0.05]">
                <tr>
                  <th className="px-4 py-3">Nomor Invoice</th>
                  <th className="px-4 py-3">Periode</th>
                  <th className="px-4 py-3">Tanggal Jatuh Tempo</th>
                  <th className="px-4 py-3">Total Nominal</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5 dark:divide-ink/10">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-ink/[0.02] dark:hover:bg-ink/[0.04]">
                    <td className="px-4 py-3 font-mono font-semibold text-ink">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-ink/70">
                      {inv.billing_period_start} s/d {inv.billing_period_end}
                    </td>
                    <td className="px-4 py-3 text-ink/70">{inv.due_date}</td>
                    <td className="px-4 py-3 font-display font-semibold text-ink">{formatMinor(inv.total_minor)}</td>
                    <td className="px-4 py-3">
                      <InvoiceStatusPill status={inv.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/billing/invoices/${inv.id}`}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                      >
                        Lihat Tagihan
                      </Link>
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
