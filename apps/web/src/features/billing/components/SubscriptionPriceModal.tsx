import React, { useState } from 'react';
import { X, DollarSign, AlertCircle, Check } from 'lucide-react';
import { CustomerSubscriptionDto, CustomerSubscriptionBillingCycle } from '../types';
import { updateCustomerSubscription, getBillingApiErrorMessage } from '../api';
import { formatMinor } from '@/lib/format';

interface SubscriptionPriceModalProps {
  subscription: CustomerSubscriptionDto | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SubscriptionPriceModal({
  subscription,
  isOpen,
  onClose,
  onSuccess,
}: SubscriptionPriceModalProps) {
  if (!isOpen || !subscription) return null;

  const [unitPrice, setUnitPrice] = useState<number>(subscription.unit_price_minor);
  const [taxMinor, setTaxMinor] = useState<number>(subscription.tax_minor);
  const [discountMinor, setDiscountMinor] = useState<number>(subscription.discount_minor);
  const [billingCycle, setBillingCycle] = useState<CustomerSubscriptionBillingCycle>(
    subscription.billing_cycle
  );
  const [notes, setNotes] = useState<string>(subscription.notes || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalMinor = Math.max(0, unitPrice - discountMinor + taxMinor);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subscription) return;
    if (unitPrice <= 0) {
      setErrorMessage('Harga pokok harus lebih besar dari 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await updateCustomerSubscription(subscription.id, {
        unit_price_minor: unitPrice,
        tax_minor: taxMinor,
        discount_minor: discountMinor,
        total_minor: totalMinor,
        billing_cycle: billingCycle,
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
            <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-ink">Perubahan Finansial & Harga</h2>
              <p className="text-xs text-ink/60">Khusus OWNER: ubah snapshot nominal & siklus penagihan</p>
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
          <div className="rounded-lg bg-ink/5 p-3 text-xs text-ink/70 dark:bg-ink/10">
            <p className="font-semibold text-ink">Paket: {subscription.name}</p>
            <p className="text-[11px] text-ink/50">Pelanggan: {subscription.customer_name || subscription.customer_id}</p>
            <p className="mt-1 text-[11px] text-ink/60 italic">
              * Perubahan harga hanya berlaku untuk periode tagihan masa depan. Tagihan yang sudah diterbitkan tidak akan terpengaruh.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink">Siklus Penagihan</label>
            <select
              value={billingCycle}
              onChange={(e) => setBillingCycle(e.target.value as CustomerSubscriptionBillingCycle)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/25"
            >
              <option value="MONTHLY">Bulanan (Monthly)</option>
              <option value="QUARTERLY">Triwulan (Quarterly)</option>
              <option value="SEMI_ANNUAL">Semester (Semi-Annual)</option>
              <option value="ANNUAL">Tahunan (Annual)</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink">Harga Pokok (Rp)</label>
              <input
                type="number"
                min={0}
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/25"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink">PPN / Pajak (Rp)</label>
              <input
                type="number"
                min={0}
                value={taxMinor}
                onChange={(e) => setTaxMinor(parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/25"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink">Diskon (Rp)</label>
              <input
                type="number"
                min={0}
                value={discountMinor}
                onChange={(e) => setDiscountMinor(parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/25"
              />
            </div>
          </div>

          <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 dark:bg-indigo-500/10">
            <div className="flex justify-between text-xs">
              <span className="text-ink/60">Total Snapshot Baru:</span>
              <span className="font-display font-bold text-indigo-600 dark:text-indigo-400">
                {formatMinor(totalMinor)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink">Alasan Perubahan / Catatan</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Upgrade bandwidth paket, penyesuaian tarif PPN..."
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
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Simpan Perubahan Finansial
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
