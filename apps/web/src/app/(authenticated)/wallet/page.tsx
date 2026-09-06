'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { getWallets, getWalletLedger } from '@/features/wallet/api';
import { WalletAccount, WalletLedgerEntry } from '@/features/wallet/types';
import { WalletBalanceCard } from '@/features/wallet/components/WalletBalanceCard';
import { TopUpModal } from '@/features/wallet/components/TopUpModal';
import { WalletLedgerTable } from '@/features/wallet/components/WalletLedgerTable';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from '@/components/ui/button';
import { Wallet, RefreshCw, PlusCircle, AlertCircle } from 'lucide-react';

export default function TenantWalletPage() {
  const { business, status } = useAuth();

  const [wallet, setWallet] = useState<WalletAccount | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<WalletLedgerEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [ledgerLoading, setLedgerLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [topUpOpen, setTopUpOpen] = useState<boolean>(false);
  const [reloadTick, setReloadTick] = useState<number>(0);

  const tenantId = business?.id;

  const loadWalletData = useCallback(async () => {
    if (!tenantId || status !== 'authenticated') {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const walletRes = await getWallets({ limit: 1 });
      if (walletRes.items && walletRes.items.length > 0) {
        const activeWallet = walletRes.items[0];
        setWallet(activeWallet);

        // Fetch ledger
        setLedgerLoading(true);
        try {
          const ledgerRes = await getWalletLedger(activeWallet.id, { limit: 50 });
          setLedgerEntries(ledgerRes.items || []);
        } catch {
          // Non-fatal ledger fetch error
          setLedgerEntries([]);
        } finally {
          setLedgerLoading(false);
        }
      } else {
        setWallet(null);
        setLedgerEntries([]);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Gagal memuat informasi Digital Wallet.';
      setError(msg);
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId, status]);

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData, reloadTick]);

  const handleRefresh = () => {
    setReloadTick((t) => t + 1);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
            Digital Wallet
          </h1>
          <p className="mt-1 text-sm text-fog">
            Kelola saldo tersimpan, isi saldo instan, dan pantau riwayat mutasi pembayaran bisnis Anda.
          </p>
          <p className="mt-1 text-xs text-fog/70">
            {business?.name ?? '—'} · Layanan Finansial Terpadu
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || ledgerLoading}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading || ledgerLoading ? 'animate-spin' : ''}`} />
            Segarkan
          </Button>

          {wallet && wallet.status === 'ACTIVE' && (
            <Button
              type="button"
              onClick={() => setTopUpOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-pine px-4 py-2 text-xs font-semibold text-white hover:bg-pine-deep shadow-xs"
            >
              <PlusCircle className="h-4 w-4" />
              Isi Saldo
            </Button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && !loading && (
        <ErrorState message={error} onRetry={handleRefresh} />
      )}

      {/* Wallet Balance Card */}
      <WalletBalanceCard
        wallet={wallet}
        isLoading={loading}
        onTopUpClick={() => setTopUpOpen(true)}
      />

      {/* Empty Wallet State (if no wallet registered yet for tenant) */}
      {!loading && !error && !wallet && (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="Digital Wallet Belum Diaktifkan"
          description="Akun Digital Wallet belum terdaftar untuk bisnis ini. Hubungi platform administrator untuk aktivasi akun saldo dompet Anda."
        />
      )}

      {/* Ledger Section */}
      {wallet && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-ink">
              Riwayat Mutasi & Transaksi
            </h3>
            <span className="text-xs text-fog">
              {ledgerEntries.length} transaksi terakhir
            </span>
          </div>

          <WalletLedgerTable
            entries={ledgerEntries}
            isLoading={ledgerLoading}
            onRefresh={handleRefresh}
          />
        </div>
      )}

      {/* Top Up Modal */}
      <TopUpModal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        wallet={wallet}
        onIntentCreated={() => {
          handleRefresh();
        }}
      />
    </div>
  );
}
