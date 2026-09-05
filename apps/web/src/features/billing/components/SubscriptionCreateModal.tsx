import React, { useState, useEffect } from 'react';
import { X, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { Customer } from '@/features/customers/types';
import {
  CreateCustomerSubscriptionPayload,
  CustomerSubscriptionBillingCycle,
} from '../types';
import { createCustomerSubscription, getBillingApiErrorMessage } from '../api';

interface SubscriptionCreateModalProps {
  isOpen: boolean;
  customers?: Array<{ id: string; name: string; phone?: string | null; email?: string | null }>;
  isLoadingCustomers?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SubscriptionCreateModal({
  isOpen,
  customers = [],
  isLoadingCustomers = false,
  onClose,
  onSuccess,
}: SubscriptionCreateModalProps) {
  const [customerId, setCustomerId] = useState(customers[0]?.id || '');
  const [name, setName] = useState('');
  const [billingCycle, setBillingCycle] = useState<CustomerSubscriptionBillingCycle>('MONTHLY');
  const [unitPrice, setUnitPrice] = useState<number>(100000);
  const [taxMinor, setTaxMinor] = useState<number>(0);
  const [discountMinor, setDiscountMinor] = useState<number>(0);
  const [anchorDay, setAnchorDay] = useState<number>(1);
  const [startsAt, setStartsAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (customers.length > 0 && !customerId) {
      setCustomerId(customers[0].id);
    }
  }, [customers, customerId]);

  if (!isOpen) return null;

  const totalMinor = Math.max(0, unitPrice - discountMinor + taxMinor);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) {
      setErrorMessage('Pilih pelanggan terlebih dahulu.');
      return;
    }
    if (!name.trim()) {
      setErrorMessage('Nama paket/langganan wajib diisi.');
      return;
    }
    if (unitPrice <= 0) {
      setErrorMessage('Harga langganan harus lebih besar dari 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: CreateCustomerSubscriptionPayload = {
        customer_id: customerId,
        name: name.trim(),
        billing_cycle: billingCycle,
        unit_price_minor: unitPrice,
        tax_minor: taxMinor,
        discount_minor: discountMinor,
        total_minor: totalMinor,
        anchor_day: Number(anchorDay),
        starts_at: `${startsAt}T00:00:00.000Z`,
        notes: notes.trim() || undefined,
      };

      await createCustomerSubscription(payload);
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
      <div className="relative w-full max-w-lg rounded-2xl border border-ink/10 bg-surface p-6 shadow-xl dark:border-ink/20">
        <div className="flex items-center justify-between border-b border-ink/10 pb-4 dark:border-ink/20">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-ink">Tambah Langganan Pelanggan</h2>
              <p className="text-xs text-ink/60">Daftarkan tagihan rutin baru untuk pelanggan CRM</p>
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
          {/* Customer Selection */}
          <div>
            <label className="block text-xs font-semibold text-ink">
              Pelanggan CRM <span className="text-rose-500">*</span>
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              disabled={isLoadingCustomers || isSubmitting}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/25"
            >
              {isLoadingCustomers ? (
                <option>Memuat pelanggan...</option>
              ) : customers.length === 0 ? (
                <option value="">Tidak ada pelanggan ditemukan</option>
              ) : (
                customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone || c.email || 'No contact'})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Plan Name */}
          <div>
            <label className="block text-xs font-semibold text-ink">
              Nama Paket / Layanan <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Dedicated Fiber 50 Mbps, Maintenance CCTV Bulanan"
              className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink/30 focus:border-pine focus:outline-none dark:border-ink/25"
            />
          </div>

          {/* Cycle & Anchor Day */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink">
                Siklus Penagihan <span className="text-rose-500">*</span>
              </label>
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
            <div>
              <label className="block text-xs font-semibold text-ink">
                Tanggal Tagih (Anchor Day) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={31}
                required
                value={anchorDay}
                onChange={(e) => setAnchorDay(parseInt(e.target.value) || 1)}
                className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/25"
              />
            </div>
          </div>

          {/* Pricing breakdown */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink">
                Harga Pokok (Rp) <span className="text-rose-500">*</span>
              </label>
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

          {/* Starts at */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink">
                Mulai Berlaku <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/25"
              />
            </div>
            <div className="flex flex-col justify-end">
              <div className="rounded-lg bg-ink/5 p-2 text-right dark:bg-ink/10">
                <span className="text-[11px] text-ink/60">Total per Siklus:</span>
                <p className="font-display text-sm font-bold text-ink">
                  {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(
                    totalMinor
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-ink">Catatan Operasional</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan untuk tim penagihan..."
              className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink/30 focus:border-pine focus:outline-none dark:border-ink/25"
            />
          </div>

          {/* Buttons */}
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
                <Plus className="h-4 w-4" />
              )}
              Daftarkan Langganan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
