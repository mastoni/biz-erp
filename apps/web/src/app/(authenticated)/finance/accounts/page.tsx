'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { ChartOfAccountsView } from '@/features/finance/components/ChartOfAccountsView';
import { getAccounts, getFinanceApiErrorMessage } from '@/features/finance/api';
import type { AccountDto } from '@/features/finance/types';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function FinanceAccountsPage() {
  const { business, role } = useAuth();
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // RBAC: OWNER and STAFF allowed; CASHIER blocked
  const isAuthorized = role === 'OWNER' || role === 'STAFF';

  const loadAccounts = useCallback(async () => {
    if (!business?.id || !isAuthorized) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await getAccounts({ limit: 100 });
      setAccounts(res.items || []);
    } catch (err) {
      setError(getFinanceApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [business?.id, isAuthorized]);

  useEffect(() => {
    if (isAuthorized) {
      loadAccounts();
    }
  }, [isAuthorized, loadAccounts]);

  if (!isAuthorized) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="font-display text-xl font-bold text-ink">
          Akses Bagan Akun Dibatasi
        </h1>
        <p className="text-xs text-fog max-w-md mt-1.5 leading-relaxed">
          Halaman Bagan Akun (COA) hanya dapat diakses oleh Pemilik Usaha (OWNER) dan Staf Keuangan (STAFF).
        </p>
        <Link
          href="/finance"
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink shadow-2xs hover:bg-paper"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Ringkasan Keuangan</span>
        </Link>
      </div>
    );
  }

  return (
    <ChartOfAccountsView
      accounts={accounts}
      isLoading={isLoading}
      error={error}
      onRefresh={loadAccounts}
    />
  );
}
