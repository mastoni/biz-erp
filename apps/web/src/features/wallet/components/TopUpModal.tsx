import React, { useState } from 'react';
import { WalletAccount, TopUpIntent } from '../types';
import { TOPUP_PRESET_AMOUNTS, getTopUpStatusConfig } from '../wallet-helpers';
import { createTopUpIntent } from '../api';
import { formatMinor } from '@/lib/format';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  QrCode,
  Building2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Clock,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface TopUpModalProps {
  open: boolean;
  onClose: () => void;
  wallet: WalletAccount | null;
  onIntentCreated?: (intent: TopUpIntent) => void;
}

export function TopUpModal({
  open,
  onClose,
  wallet,
  onIntentCreated,
}: TopUpModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(100_000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'qris' | 'bank_transfer' | 'gopay'>('qris');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [createdIntent, setCreatedIntent] = useState<TopUpIntent | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const effectiveAmount = customAmount
    ? parseInt(customAmount, 10) || 0
    : selectedAmount;

  const handleSelectPreset = (amt: number) => {
    setSelectedAmount(amt);
    setCustomAmount('');
    setError(null);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setCustomAmount(val);
    setSelectedAmount(0);
    setError(null);
  };

  const handleClose = () => {
    setCreatedIntent(null);
    setError(null);
    setCustomAmount('');
    setSelectedAmount(100_000);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;

    if (effectiveAmount < 10_000) {
      setError('Nominal isi saldo minimal Rp 10.000');
      return;
    }

    if (effectiveAmount > 50_000_000) {
      setError('Nominal isi saldo maksimal Rp 50.000.000 per transaksi');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const intent = await createTopUpIntent(wallet.id, {
        amount: effectiveAmount,
        payment_method: paymentMethod,
        currency: wallet.currency,
        expires_in_hours: 24,
      });

      setCreatedIntent(intent);
      if (onIntentCreated) {
        onIntentCreated(intent);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Gagal membuat instruksi pengisian saldo.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyIntentNumber = () => {
    if (!createdIntent) return;
    navigator.clipboard.writeText(createdIntent.intent_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={createdIntent ? 'Instruksi Pembayaran Top Up' : 'Isi Saldo Digital Wallet'}
      description={
        createdIntent
          ? `Selesaikan pembayaran untuk nomor tagihan ${createdIntent.intent_number}`
          : `Pilih nominal isi saldo untuk akun dompet ${wallet?.wallet_number ?? ''}`
      }
      maxWidth="md"
    >
      {createdIntent ? (
        <div className="space-y-5 pt-2">
          {/* Status Banner */}
          <div className="rounded-xl border border-honey/30 bg-honey-soft/50 p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#8a5f10]">
              <Clock className="h-4 w-4" />
              Menunggu Pembayaran
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-ink">
              {formatMinor(createdIntent.total_payable)}
            </p>
            <p className="mt-1 text-xs text-fog">
              Batas waktu: {new Date(createdIntent.expires_at).toLocaleString('id-ID')}
            </p>
          </div>

          {/* Reference / Intent ID Card */}
          <div className="rounded-xl border border-line bg-surface-soft p-4">
            <span className="text-xs font-medium text-fog">Nomor Transaksi (Intent ID)</span>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-bold text-ink">
                {createdIntent.intent_number}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyIntentNumber}
                className="flex items-center gap-1.5 text-xs"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? 'Tersalin' : 'Salin'}
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-2 text-xs text-fog">
            <p className="font-semibold text-ink">Metode Pembayaran: {createdIntent.payment_method?.toUpperCase()}</p>
            <p>
              Saldo akan otomatis bertambah ke Digital Wallet setelah konfirmasi pembayaran dari Payment Gateway (Midtrans) diterima oleh sistem.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleClose}
              className="rounded-xl bg-pine px-5 py-2.5 text-xs font-semibold text-white hover:bg-pine-deep"
            >
              Selesai & Lihat Riwayat
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-clay/30 bg-clay-soft p-3 text-xs text-clay">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Preset amount buttons */}
          <div>
            <label className="text-xs font-semibold text-ink">Pilih Nominal Cepat</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {TOPUP_PRESET_AMOUNTS.map((amt) => {
                const isSelected = selectedAmount === amt && !customAmount;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleSelectPreset(amt)}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-pine bg-pine text-white shadow-xs'
                        : 'border-line bg-surface-soft/60 text-ink hover:border-pine/40 hover:bg-surface'
                    }`}
                  >
                    {formatMinor(amt)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom amount input */}
          <div>
            <label htmlFor="custom-topup-input" className="text-xs font-semibold text-ink">
              Atau Masukkan Nominal Lain (Rp)
            </label>
            <div className="mt-1.5">
              <Input
                id="custom-topup-input"
                type="text"
                inputMode="numeric"
                placeholder="Contoh: 150000"
                value={customAmount}
                onChange={handleCustomChange}
                className="rounded-xl font-mono text-sm"
              />
            </div>
            <p className="mt-1 text-[11px] text-fog">
              Minimal Rp 10.000 · Maksimal Rp 50.000.000
            </p>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="text-xs font-semibold text-ink">Metode Pembayaran</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('qris')}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all ${
                  paymentMethod === 'qris'
                    ? 'border-pine bg-pine-soft/40 text-pine font-semibold'
                    : 'border-line bg-surface text-fog hover:border-line/80'
                }`}
              >
                <QrCode className="h-5 w-5" />
                <span>QRIS Instant</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('bank_transfer')}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all ${
                  paymentMethod === 'bank_transfer'
                    ? 'border-pine bg-pine-soft/40 text-pine font-semibold'
                    : 'border-line bg-surface text-fog hover:border-line/80'
                }`}
              >
                <Building2 className="h-5 w-5" />
                <span>Virtual Account</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('gopay')}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all ${
                  paymentMethod === 'gopay'
                    ? 'border-pine bg-pine-soft/40 text-pine font-semibold'
                    : 'border-line bg-surface text-fog hover:border-line/80'
                }`}
              >
                <CheckCircle2 className="h-5 w-5" />
                <span>E-Wallet</span>
              </button>
            </div>
          </div>

          {/* Footer & Total */}
          <div className="flex items-center justify-between border-t border-line/80 pt-4">
            <div>
              <span className="text-[11px] text-fog">Total Pembayaran</span>
              <p className="font-display text-lg font-bold text-ink">
                {formatMinor(effectiveAmount)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="rounded-xl text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || effectiveAmount <= 0}
                className="flex items-center gap-1.5 rounded-xl bg-pine px-5 py-2.5 text-xs font-semibold text-white hover:bg-pine-deep shadow-xs"
              >
                {isSubmitting ? 'Memproses…' : 'Lanjutkan Pembayaran'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
