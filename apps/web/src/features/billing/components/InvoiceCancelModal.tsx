import React, { useState } from 'react';
import { X, XCircle, AlertCircle } from 'lucide-react';
import { CustomerInvoiceDto } from '../types';
import { cancelCustomerInvoice, getBillingApiErrorMessage } from '../api';

interface InvoiceCancelModalProps {
  invoice: CustomerInvoiceDto | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function InvoiceCancelModal({
  invoice,
  isOpen,
  onClose,
  onSuccess,
}: InvoiceCancelModalProps) {
  if (!isOpen || !invoice) return null;

  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await cancelCustomerInvoice(invoice.id, {
        reason: reason.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setErrorMessage(getBillingApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-6 shadow-xl dark:border-ink/20">
        <div className="flex items-center justify-between border-b border-ink/10 pb-4 dark:border-ink/20">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-rose-500/10 p-2 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-ink">Batalkan Tagihan</h2>
              <p className="text-xs text-ink/60">Khusus OWNER: pembatalan invoice & jurnal balik AR</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-ink/40 hover:bg-ink/5 hover:text-ink dark:hover:bg-ink/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
            <p className="font-semibold">Invoice: {invoice.invoice_number}</p>
            <p className="mt-1 text-[11px] opacity-80">
              Pembatalan akan mengubah status tagihan menjadi CANCELLED, membatalkan piutang (AR) terkait, dan menerbitkan jurnal akuntansi pembalik (Dr Revenue / Cr AR). Invoice yang sudah memiliki pembayaran tidak dapat dibatalkan.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink">
              Alasan Pembatalan <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan alasan pembatalan invoice..."
              className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink/30 focus:border-pine focus:outline-none dark:border-ink/25"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-ink/15 px-4 py-2 text-xs font-medium text-ink hover:bg-ink/5 dark:border-ink/25"
            >
              Kembali
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Konfirmasi Batalkan Tagihan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
