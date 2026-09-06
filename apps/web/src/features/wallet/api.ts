import { api } from '@/lib/api';
import {
  WalletAccount,
  WalletListResponse,
  WalletLedgerResponse,
  TopUpIntent,
  CreateTopUpPayload,
} from './types';

export async function getWallets(params?: {
  limit?: number;
  offset?: number;
  status?: string;
  currency?: string;
}): Promise<WalletListResponse> {
  const response = await api.get<WalletListResponse>('/v1/wallets', { params });
  return response.data;
}

export async function getWallet(walletId: string): Promise<WalletAccount> {
  const response = await api.get<WalletAccount>(`/v1/wallets/${walletId}`);
  return response.data;
}

export async function getWalletLedger(
  walletId: string,
  params?: {
    limit?: number;
    offset?: number;
    transaction_type?: string;
    entry_type?: string;
  }
): Promise<WalletLedgerResponse> {
  const response = await api.get<WalletLedgerResponse>(`/v1/wallets/${walletId}/ledger`, {
    params,
  });
  return response.data;
}

export async function createTopUpIntent(
  walletId: string,
  payload: CreateTopUpPayload
): Promise<TopUpIntent> {
  const response = await api.post<TopUpIntent>(
    `/v1/wallets/${walletId}/topup-intents`,
    payload
  );
  return response.data;
}
