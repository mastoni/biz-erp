import { WalletStatus, WalletTransactionType, TopUpIntentStatus } from './types';

export const TOPUP_PRESET_AMOUNTS = [
  50_000,
  100_000,
  250_000,
  500_000,
  1_000_000,
  2_500_000,
];

export function getTransactionTypeLabel(type: WalletTransactionType): string {
  switch (type) {
    case 'TOP_UP':
      return 'Isi Saldo (Top Up)';
    case 'INVOICE_PAYMENT':
      return 'Pembayaran Tagihan';
    case 'POS_SETTLEMENT':
      return 'Pembayaran Kasir / POS';
    case 'REFUND':
      return 'Pengembalian Dana (Refund)';
    case 'DIRECT_CREDIT':
      return 'Penyesuaian Kredit';
    case 'DIRECT_DEBIT':
      return 'Penyesuaian Debit';
    case 'REVERSAL':
      return 'Pembalikan Transaksi (Reversal)';
    default:
      return type;
  }
}

export function getWalletStatusConfig(status: WalletStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'ACTIVE':
      return {
        label: 'Aktif',
        badgeClass: 'bg-pine-soft text-pine border-pine/20',
      };
    case 'FROZEN':
      return {
        label: 'Dibekukan',
        badgeClass: 'bg-honey-soft text-[#8a5f10] border-honey/20',
      };
    case 'CLOSED':
      return {
        label: 'Ditutup',
        badgeClass: 'bg-surface-soft text-fog border-line',
      };
    default:
      return {
        label: status,
        badgeClass: 'bg-surface-soft text-fog border-line',
      };
  }
}

export function getTopUpStatusConfig(status: TopUpIntentStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'PENDING':
      return {
        label: 'Menunggu Pembayaran',
        badgeClass: 'bg-honey-soft text-[#8a5f10]',
      };
    case 'SUCCEEDED':
      return {
        label: 'Berhasil',
        badgeClass: 'bg-pine-soft text-pine',
      };
    case 'FAILED':
      return {
        label: 'Gagal',
        badgeClass: 'bg-clay-soft text-clay',
      };
    case 'EXPIRED':
      return {
        label: 'Kedaluwarsa',
        badgeClass: 'bg-surface-soft text-fog',
      };
    default:
      return {
        label: status,
        badgeClass: 'bg-surface-soft text-fog',
      };
  }
}
