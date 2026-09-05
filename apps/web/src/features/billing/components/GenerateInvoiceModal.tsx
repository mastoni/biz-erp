import React, { useState, useEffect } from 'react';
import { X, FileText, AlertCircle, ArrowRight } from 'lucide-react';
import { CustomerSubscriptionDto } from '../types';
import { generateCustomerInvoice, getBillingApiErrorMessage } from '../api';
import { formatMinor } from '@/lib/format';

interface GenerateInvoiceModalProps {
  subscription: CustomerSubscriptionDto | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function GenerateInvoiceModal({
  subscription,
  isOpen,
  onClose,
  onSuccess,
}: GenerateInvoiceModalProps) {
  if (!isOpen || !subscription) return null;

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (subscription) {
      const baseDateStr = subscription.next_billing_date || new Date().toISOString().slice(0, 10);
      const baseDate = new Date(baseDateStr);

      // Estimate period end based on billing cycle
      const endPeriodDate = new Date(baseDate);
      if (subscription.billing_cycle === 'QUARTERLY') {
        endPeriodDate.setMonth(endPeriodDate.getMonth() + 3);
      } else if (subscription.billing_cycle === 'SEMI_ANNUAL') {
        endPeriodDate.setMonth(endPeriodDate.getMonth() + 6);
      } else if (subscription.billing_cycle === 'ANNUAL') {
        endPeriodDate.setFullYear(endPeriodDate.getFullYear() + 1);
      } else {
        endPeriodDate.setMonth(endPeriodDate.getMonth() + 1);
      }
      endPeriodDate.setDate(endPeriodDate.getDate() - 1);

      // Due date defaults to 7 days after start
      const due = new Date(baseDate);
      due.setDate(due.getDate() + 7);

      setStartDate(baseDateStr);
      setEndDate(endPeriodDate.toISOString().slice(0, 10));
      setDueDate(due.toISOString().slice(0, 10));
    }
  }, [subscription]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subscription) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await generateCustomerInvoice(subscription.id, {
        billing_period_start: startDate || undefined,
        billing_period_end: endDate || undefined,
        due_date: dueDate || undefined,
        notes: notes.trim() || undefined,
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
            <div className="rounded-lg bg-sky-500/10 p-2 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-ink">Terbitkan Tagihan Manual</h2>
              <p className="text-xs text-ink/60">Generate invoice & piutang (AR) untuk siklus terpilih</p>
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
            <div className="flex justify-between font-semibold text-ink">
              <span>{subscription.name}</span>
              <span className="font-display font-bold text-emerald-600 dark:text-emerald-400">
                {formatMinor(subscription.total_minor)}
              </span>
            </div>
            <p className="text-[11px] text-ink/50 mt-0.5">
              Pelanggan: {subscription.customer_name || subscription.customer_id}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink">Periode Mulai</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/25"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink">Periode Selesai</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/25"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink">Jatuh Tempo Pembayaran</label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/25"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink">Catatan Invoice (opsional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan pada cetakan tagihan..."
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
              className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              Terbitkan Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
