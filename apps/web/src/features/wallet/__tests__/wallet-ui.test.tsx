import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { WalletAccount, WalletLedgerEntry, TopUpIntent } from '../types';
import { WalletBalanceCard } from '../components/WalletBalanceCard';
import { TopUpModal } from '../components/TopUpModal';
import { WalletLedgerTable } from '../components/WalletLedgerTable';
import { canAccessRoute, getAuthorizedNavigation, NAVIGATION_ITEMS } from '@/lib/rbac';
import { getTransactionTypeLabel, TOPUP_PRESET_AMOUNTS } from '../wallet-helpers';
import { formatMinor } from '@/lib/format';

const mockWallet: WalletAccount = {
  id: '11111111-2222-3333-4444-555555555555',
  account_customer_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  business_id: '99999999-8888-7777-6666-555555555555',
  wallet_number: 'WAL-2026-0001',
  currency: 'IDR',
  status: 'ACTIVE',
  balance: 25000000,
  pending_credit: 5000000,
  pending_debit: 0,
  server_version: 5,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

const mockLedgerEntries: WalletLedgerEntry[] = [
  {
    id: 'ledger-1',
    wallet_id: mockWallet.id,
    transaction_type: 'TOP_UP',
    entry_type: 'CREDIT',
    amount: 10000000,
    balance_before: 15000000,
    balance_after: 25000000,
    currency: 'IDR',
    reference_type: 'TOP_UP_INTENT',
    reference_id: 'TOP-2026-001',
    description: 'Isi saldo via QRIS',
    created_at: '2026-01-02T10:30:00.000Z',
  },
  {
    id: 'ledger-2',
    wallet_id: mockWallet.id,
    transaction_type: 'POS_SETTLEMENT',
    entry_type: 'DEBIT',
    amount: 4500000,
    balance_before: 19500000,
    balance_after: 15000000,
    currency: 'IDR',
    reference_type: 'SALE',
    reference_id: 'SALE-2026-099',
    description: 'Pembayaran Kasir Order #99',
    created_at: '2026-01-01T15:00:00.000Z',
  },
];

describe('Tenant Digital Wallet UI Test Suite', () => {
  describe('WALLET-UI-001: WalletBalanceCard rendering', () => {
    it('renders wallet number, formatted balance, and active status', () => {
      const html = renderToString(
        <WalletBalanceCard
          wallet={mockWallet}
          isLoading={false}
          onTopUpClick={() => {}}
        />
      );

      expect(html).toContain('WAL-2026-0001');
      expect(html).toContain('Aktif');
      expect(html).toContain(formatMinor(mockWallet.balance));
      expect(html).toContain(formatMinor(mockWallet.pending_credit));
      expect(html).toContain('Isi Saldo (Top Up)');
    });

    it('renders skeleton animation when isLoading is true', () => {
      const html = renderToString(
        <WalletBalanceCard
          wallet={null}
          isLoading={true}
          onTopUpClick={() => {}}
        />
      );

      expect(html).toContain('animate-pulse');
      expect(html).not.toContain('WAL-2026-0001');
    });

    it('disables top up button when wallet is FROZEN', () => {
      const frozenWallet: WalletAccount = { ...mockWallet, status: 'FROZEN' };
      const html = renderToString(
        <WalletBalanceCard
          wallet={frozenWallet}
          isLoading={false}
          onTopUpClick={() => {}}
        />
      );

      expect(html).toContain('Dibekukan');
      expect(html).toContain('disabled');
    });
  });

  describe('WALLET-UI-002: TopUpModal rendering', () => {
    it('renders preset amount selector chips and payment methods', () => {
      const html = renderToString(
        <TopUpModal
          open={true}
          onClose={() => {}}
          wallet={mockWallet}
        />
      );

      expect(html).toContain('Isi Saldo Digital Wallet');
      expect(html).toContain(formatMinor(50_000));
      expect(html).toContain(formatMinor(100_000));
      expect(html).toContain(formatMinor(250_000));
      expect(html).toContain('QRIS Instant');
      expect(html).toContain('Virtual Account');
      expect(html).toContain('Lanjutkan Pembayaran');
    });

    it('returns null when modal open is false', () => {
      const html = renderToString(
        <TopUpModal
          open={false}
          onClose={() => {}}
          wallet={mockWallet}
        />
      );

      expect(html).toBe('');
    });
  });

  describe('WALLET-UI-003: WalletLedgerTable rendering', () => {
    it('renders transaction entries with color-coded CREDIT and DEBIT', () => {
      const html = renderToString(
        <WalletLedgerTable
          entries={mockLedgerEntries}
          isLoading={false}
        />
      );

      expect(html).toContain('Isi Saldo (Top Up)');
      expect(html).toContain('Pembayaran Kasir / POS');
      expect(html).toContain('Isi saldo via QRIS');
      expect(html).toContain(formatMinor(mockLedgerEntries[0].amount));
      expect(html).toContain(formatMinor(mockLedgerEntries[1].amount));
      expect(html).toContain(formatMinor(mockLedgerEntries[0].balance_after));
      expect(html).toContain('text-pine');
      expect(html).toContain('text-clay');
    });

    it('renders EmptyState when entries array is empty', () => {
      const html = renderToString(
        <WalletLedgerTable
          entries={[]}
          isLoading={false}
        />
      );

      expect(html).toContain('Belum ada riwayat transaksi');
    });

    it('renders skeleton state when isLoading is true', () => {
      const html = renderToString(
        <WalletLedgerTable
          entries={[]}
          isLoading={true}
        />
      );

      expect(html).toContain('animate-pulse');
    });
  });

  describe('WALLET-UI-004: RBAC & Navigation verification', () => {
    it('allows OWNER role access to /wallet', () => {
      expect(canAccessRoute('OWNER', '/wallet')).toBe(true);
    });

    it('denies CASHIER and STAFF access to /wallet', () => {
      expect(canAccessRoute('CASHIER', '/wallet')).toBe(false);
      expect(canAccessRoute('STAFF', '/wallet')).toBe(false);
    });

    it('contains Digital Wallet in navigation pointing to /wallet', () => {
      const walletNav = NAVIGATION_ITEMS.find((item) => item.href === '/wallet');
      expect(walletNav).toBeDefined();
      expect(walletNav?.name).toBe('Digital Wallet');
    });

    it('maintains Laporan Keuangan pointing to /finance with TrendingUp icon', () => {
      const financeNav = NAVIGATION_ITEMS.find((item) => item.href === '/finance');
      expect(financeNav).toBeDefined();
      expect(financeNav?.name).toBe('Laporan Keuangan');
      expect(financeNav?.href).toBe('/finance');
    });

    it('includes Digital Wallet in authorized navigation for OWNER only', () => {
      const ownerNav = getAuthorizedNavigation('OWNER');
      expect(ownerNav.some((item) => item.href === '/wallet')).toBe(true);

      const cashierNav = getAuthorizedNavigation('CASHIER');
      expect(cashierNav.some((item) => item.href === '/wallet')).toBe(false);

      const staffNav = getAuthorizedNavigation('STAFF');
      expect(staffNav.some((item) => item.href === '/wallet')).toBe(false);
    });
  });
});
