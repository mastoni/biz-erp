import React from 'react';
import { WalletAccount } from '../types';
import { getWalletStatusConfig } from '../wallet-helpers';
import { formatMinor } from '@/lib/format';
import { Wallet, PlusCircle, ArrowUpRight, ArrowDownLeft, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WalletBalanceCardProps {
  wallet: WalletAccount | null;
  isLoading: boolean;
  onTopUpClick: () => void;
}

export function WalletBalanceCard({
  wallet,
  isLoading,
  onTopUpClick,
}: WalletBalanceCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-xs animate-pulse">
        <div className="flex items-center justify-between pb-4 border-b border-line/60">
          <div className="h-5 w-32 bg-surface-soft rounded-md" />
          <div className="h-5 w-16 bg-surface-soft rounded-full" />
        </div>
        <div className="mt-6 space-y-2">
          <div className="h-4 w-24 bg-surface-soft rounded-md" />
          <div className="h-10 w-52 bg-surface-soft rounded-md" />
        </div>
        <div className="mt-6 flex justify-end">
          <div className="h-10 w-36 bg-surface-soft rounded-lg" />
        </div>
      </div>
    );
  }

  if (!wallet) {
    return null;
  }

  const statusCfg = getWalletStatusConfig(wallet.status);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-linear-to-br from-surface to-surface-soft/80 p-6 shadow-sm">
      {/* Background visual motif */}
      <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-[0.03] pointer-events-none">
        <Wallet className="h-64 w-64 text-ink" />
      </div>

      {/* Header with Wallet Number & Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pine-soft text-pine">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-fog">
              Nomor Akun Dompet
            </p>
            <p className="font-mono text-sm font-bold text-ink">
              {wallet.wallet_number}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusCfg.badgeClass}`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Balance Body */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7">
          <span className="text-xs font-medium text-fog">Saldo Tersedia ({wallet.currency})</span>
          <div className="mt-1 flex items-baseline gap-2">
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              {formatMinor(wallet.balance)}
            </h2>
          </div>
          {(wallet.pending_credit > 0 || wallet.pending_debit > 0) && (
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-fog">
              {wallet.pending_credit > 0 && (
                <span className="flex items-center gap-1 text-pine">
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                  Tertunda masuk: {formatMinor(wallet.pending_credit)}
                </span>
              )}
              {wallet.pending_debit > 0 && (
                <span className="flex items-center gap-1 text-clay">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Tertunda keluar: {formatMinor(wallet.pending_debit)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="flex justify-start md:col-span-5 md:justify-end">
          <Button
            type="button"
            onClick={onTopUpClick}
            disabled={wallet.status !== 'ACTIVE'}
            className="flex items-center gap-2 rounded-xl bg-pine px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-pine-deep transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            Isi Saldo (Top Up)
          </Button>
        </div>
      </div>
    </div>
  );
}
