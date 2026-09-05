import React, { useState, useEffect } from 'react';
import { X, CreditCard, AlertCircle, Check } from 'lucide-react';
import { CustomerInvoiceDto, CustomerPaymentMethod } from '../types';
import { recordCustomerInvoicePayment, getBillingApiErrorMessage } from '../api';
import { formatMinor } from '@/lib/format';

interface InvoicePaymentModalProps {
  invoice: CustomerInvoiceDto | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function InvoicePaymentModal({
  invoice,
  isOpen,
  onClose,
  onSuccess,
}: InvoicePaymentModalProps) {
  if (!isOpen || !invoice) return null;

  const defaultOutstanding = invoice.outstanding_minor ?? invoice.total_minor;
  const [amount, setAmount] = useState<number>(defaultOutstanding);
  const [method, setMethod] = useState<CustomerPaymentMethod>('cash');
  const [reference, setReference] = useState<string>('');
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (invoice) {
      const out = invoice.outstanding_minor ?? invoice.total_minor;
      setAmount(out > 0 ? out : invoice.total_minor);
      setIdempotencyKey(`PAY-${invoice.id.slice(0, 8)}-${Date.now()}`);
    }
  }, [invoice]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice) return;
    if (amount <= 0) {
      setErrorMessage('Nominal pembayaran harus lebih besar dari 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await recordCustomerInvoicePayment(invoice.id, {
        amount_minor: Number(amount),
        method,
        reference: reference.trim() || undefined,
        idempotency_key: idempotencyKey.trim() || `PAY-${invoice.id}-${Date.now()}`,
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
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-ink">Catat Pembayaran Tagihan</h2>
              <p className="text-xs text-ink/60">Invoice: {invoice.invoice_number}</p>
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
          <div className="rounded-lg bg-ink/5 p-3 text-xs dark:bg-ink/10">
            <div className="flex justify-between">
              <span className="text-ink/60">Total Tagihan:</span>
              <span className="font-semibold text-ink">{formatMinor(invoice.total_minor)}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-ink/60">Sisa Piutang (AR):</span>
              <span className="font-display font-bold text-amber-600 dark:text-amber-400">
                {formatMinor(invoice.outstanding_minor ?? invoice.total_minor)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink">
              Nominal Pembayaran (Rp) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              required
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/25"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink">
              Metode Pembayaran <span className="text-rose-500">*</span>
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as CustomerPaymentMethod)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/25"
            >
              <option value="cash">Tunai (Cash)</option>
              <option value="bank_transfer">Transfer Bank</option>
              <option value="debit">Kartu Debit</option>
              <option value="credit">Kartu Kredit</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink">Nomor Referensi / Bukti Transfer (opsional)</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Contoh: TRF-BCA-981244"
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
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Simpan Pembayaran
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
