'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { GeneralJournalTable } from '@/features/finance/components/GeneralJournalTable';
import { JournalDetailModal } from '@/features/finance/components/JournalDetailModal';
import { JournalReversalModal } from '@/features/finance/components/JournalReversalModal';
import { getJournals, getFinanceApiErrorMessage } from '@/features/finance/api';
import type { JournalEntryDto, JournalStatus } from '@/features/finance/types';
import { getBranches } from '@/features/inventory/api';
import type { Branch } from '@/features/inventory/types';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function FinanceJournalsPage() {
  const { business, role } = useAuth();

  const [journals, setJournals] = useState<JournalEntryDto[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [branches, setBranches] = useState<Branch[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [detailJournal, setDetailJournal] = useState<JournalEntryDto | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  const [reversalJournal, setReversalJournal] = useState<JournalEntryDto | null>(null);
  const [isReversalOpen, setIsReversalOpen] = useState<boolean>(false);

  // RBAC: OWNER and STAFF allowed; CASHIER blocked
  const isAuthorized = role === 'OWNER' || role === 'STAFF';

  // Load branches
  useEffect(() => {
    if (!business?.id || !isAuthorized) return;
    let isMounted = true;
    getBranches(business.id)
      .then((items) => {
        if (isMounted) setBranches(items);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [business?.id, isAuthorized]);

  // Load Journals
  const loadJournals = useCallback(async () => {
    if (!business?.id || !isAuthorized) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await getJournals({
        limit: 50,
        offset: 0,
        status: statusFilter ? (statusFilter as JournalStatus) : undefined,
        branch_id: branchFilter || undefined,
      });
      setJournals(res.items || []);
      setTotal(res.total || (res.items || []).length);
    } catch (err) {
      setError(getFinanceApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [business?.id, isAuthorized, statusFilter, branchFilter]);

  useEffect(() => {
    if (isAuthorized) {
      loadJournals();
    }
  }, [isAuthorized, loadJournals]);

  const handleOpenDetail = (journal: JournalEntryDto) => {
    setDetailJournal(journal);
    setIsDetailOpen(true);
  };

  const handleOpenReversal = (journal: JournalEntryDto) => {
    setReversalJournal(journal);
    setIsReversalOpen(true);
  };

  if (!isAuthorized) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="font-display text-xl font-bold text-ink">
          Akses Jurnal Umum Dibatasi
        </h1>
        <p className="text-xs text-fog max-w-md mt-1.5 leading-relaxed">
          Halaman Jurnal Umum hanya dapat diakses oleh Pemilik Usaha (OWNER) dan Staf Keuangan (STAFF).
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
    <>
      <GeneralJournalTable
        journals={journals}
        total={total}
        isLoading={isLoading}
        error={error}
        role={role}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        branchFilter={branchFilter}
        onBranchFilterChange={setBranchFilter}
        branches={branches}
        onRefresh={loadJournals}
        onViewDetail={handleOpenDetail}
        onOpenReversal={handleOpenReversal}
      />

      {/* Detail Modal */}
      <JournalDetailModal
        journalId={detailJournal?.id || null}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        role={role}
        onOpenReversal={(j) => {
          setIsDetailOpen(false);
          handleOpenReversal(j);
        }}
      />

      {/* Reversal Modal */}
      <JournalReversalModal
        journal={reversalJournal}
        isOpen={isReversalOpen}
        onClose={() => setIsReversalOpen(false)}
        onSuccess={() => {
          loadJournals();
        }}
      />
    </>
  );
}
