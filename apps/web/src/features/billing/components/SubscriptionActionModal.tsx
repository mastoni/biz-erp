import React, { useState } from 'react';
import { X, PauseCircle, PlayCircle, XCircle, AlertCircle } from 'lucide-react';
import { CustomerSubscriptionDto } from '../types';
import {
  pauseCustomerSubscription,
  resumeCustomerSubscription,
  cancelCustomerSubscription,
  getBillingApiErrorMessage,
} from '../api';

interface SubscriptionActionModalProps {
  subscription: CustomerSubscriptionDto | null;
  actionType: 'pause' | 'resume' | 'cancel' | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SubscriptionActionModal({
  subscription,
  actionType,
  isOpen,
  onClose,
  onSuccess,
}: SubscriptionActionModalProps) {
  if (!isOpen || !subscription || !actionType) return null;

  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const title =
    actionType === 'pause'
      ? 'Tunda Langganan'
      : actionType === 'resume'
      ? 'Aktifkan Kembali Langganan'
      : 'Batalkan Langganan Permanen';

  const description =
    actionType === 'pause'
      ? 'Langganan yang ditunda tidak akan otomatis menghasilkan tagihan pada siklus berikutnya.'
      : actionType === 'resume'
      ? 'Langganan akan kembali aktif dan penagihan berkala akan dilanjutkan.'
      : 'Langganan yang dibatalkan tidak dapat diaktifkan kembali. Penagihan masa depan akan dihentikan.';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subscription || !actionType) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (actionType === 'pause') {
        await pauseCustomerSubscription(subscription.id, { reason: reason.trim() || undefined });
      } else if (actionType === 'resume') {
        await resumeCustomerSubscription(subscription.id, { reason: reason.trim() || undefined });
      } else if (actionType === 'cancel') {
        await cancelCustomerSubscription(subscription.id, { reason: reason.trim() || undefined });
      }
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
            <div
              className={`rounded-lg p-2 ${
                actionType === 'pause'
                  ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                  : actionType === 'resume'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
              }`}
            >
              {actionType === 'pause' && <PauseCircle className="h-5 w-5" />}
              {actionType === 'resume' && <PlayCircle className="h-5 w-5" />}
              {actionType === 'cancel' && <XCircle className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-ink">{title}</h2>
              <p className="text-xs text-ink/60">Paket: {subscription.name}</p>
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
          <p className="text-xs text-ink/70">{description}</p>

          <div>
            <label className="block text-xs font-semibold text-ink">
              Alasan Tindakan <span className="text-ink/40 font-normal">(opsional)</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Berikan alasan perubahan status langganan..."
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
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                actionType === 'pause'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : actionType === 'resume'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : null}
              {actionType === 'pause' && 'Tunda Sekarang'}
              {actionType === 'resume' && 'Aktifkan Kembali'}
              {actionType === 'cancel' && 'Batalkan Langganan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
