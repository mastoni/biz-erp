'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { PurchasesKPICards } from './PurchasesKPICards';
import { PurchasesToolbar } from './PurchasesToolbar';
import { PurchasesTable } from './PurchasesTable';
import { PurchaseCreateModal } from './PurchaseCreateModal';
import { PurchaseReceiveModal } from './PurchaseReceiveModal';
import { PurchasePaymentModal } from './PurchasePaymentModal';
import { PurchaseEmptyState } from './PurchaseEmptyState';
import { ErrorState } from '@/components/ui/error-state';
import {
  PURCHASES_ADD_ACTION_LABEL,
  PURCHASES_PAGE_SUBTITLE,
  PURCHASES_PAGE_TITLE,
} from '../purchase-helpers';
import { usePurchasesViewModel } from '../use-purchases-viewmodel';
import type {
  PaymentMethod,
  PurchaseCreateInput,
  PurchaseReceiveItemInput,
  PurchaseViewModel,
} from '../types';

interface PurchasesPageProps {
  businessId: string;
  branchId?: string;
  role: 'OWNER' | 'CASHIER';
}

export function PurchasesPage({
  businessId,
  branchId,
  role,
}: PurchasesPageProps) {
  const {
    purchases,
    allPurchases,
    summary,
    dataState,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    termFilter,
    setTermFilter,
    mutationState,
    createPurchase,
    sendPurchase,
    receivePurchase,
    payPurchase,
    cancelPurchase,
    deleteDraftPurchase,
    refresh,
  } = usePurchasesViewModel({ businessId, branchId });

  const isOwner = role === 'OWNER';

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalError, setCreateModalError] = useState<string | null>(null);

  const [receiveModalPurchase, setReceiveModalPurchase] = useState<PurchaseViewModel | null>(null);
  const [payModalPurchase, setPayModalPurchase] = useState<PurchaseViewModel | null>(null);

  const handleCreateSubmit = async (
    input: Omit<PurchaseCreateInput, 'business_id' | 'branch_id'> & { branch_id?: string }
  ) => {
    setCreateModalError(null);
    try {
      await createPurchase(input);
    } catch (err: any) {
      setCreateModalError(err?.response?.data?.message || err?.message || 'Gagal membuat pesanan pembelian.');
      throw err;
    }
  };

  const handleSend = async (po: PurchaseViewModel) => {
    try {
      await sendPurchase(po.id);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Gagal mengirim pesanan ke supplier.');
    }
  };

  const handleReceiveSubmit = async (id: string, items: PurchaseReceiveItemInput[]) => {
    try {
      await receivePurchase(id, items);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Gagal memproses penerimaan barang.');
      throw err;
    }
  };

  const handlePaySubmit = async (
    id: string,
    amount_minor: number,
    method: PaymentMethod,
    reference?: string | null
  ) => {
    try {
      await payPurchase(id, amount_minor, method, reference);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Gagal mencatat pembayaran tagihan.');
      throw err;
    }
  };

  const handleCancel = async (po: PurchaseViewModel) => {
    if (confirm(`Yakin ingin membatalkan pesanan ${po.code}?`)) {
      try {
        await cancelPurchase(po.id);
      } catch (err: any) {
        alert(err?.response?.data?.message || err?.message || 'Gagal membatalkan pesanan.');
      }
    }
  };

  const handleDeleteDraft = async (po: PurchaseViewModel) => {
    if (confirm(`Hapus draft pesanan ${po.code}?`)) {
      try {
        await deleteDraftPurchase(po.id);
      } catch (err: any) {
        alert(err?.response?.data?.message || err?.message || 'Gagal menghapus draft.');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            {PURCHASES_PAGE_TITLE}
          </h1>
          <p className="text-xs text-fog sm:text-sm">
            {PURCHASES_PAGE_SUBTITLE}
          </p>
        </div>
        {isOwner && (
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-pine px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-pine-deep sm:mt-0 cursor-pointer"
          >
            <Plus width={15} height={15} />
            {PURCHASES_ADD_ACTION_LABEL}
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <PurchasesKPICards summary={summary} />

      {/* Toolbar */}
      <PurchasesToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        termFilter={termFilter}
        onTermFilterChange={setTermFilter}
        filteredCount={purchases.length}
      />

      {/* Loading Skeleton */}
      {dataState === 'loading' && (
        <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-line bg-paper/60">
                  <th className="w-10 px-4 py-3.5"></th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-fog">No. PO</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Supplier</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Tanggal</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Jatuh Tempo</th>
                  <th className="px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-fog">Item</th>
                  <th className="px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-fog">Nilai</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Status</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-line/60">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="h-5 w-full animate-pulse rounded-lg bg-paper/70" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Error State */}
      {dataState === 'error' && (
        <ErrorState
          message={error || 'Terjadi kesalahan saat memuat data pembelian.'}
          onRetry={refresh}
        />
      )}

      {/* Empty State */}
      {dataState === 'empty' && (
        <PurchaseEmptyState
          isOwner={isOwner}
          onAddClick={isOwner ? () => setCreateModalOpen(true) : undefined}
        />
      )}

      {/* Ready State */}
      {dataState === 'ready' && (
        <>
          {purchases.length === 0 ? (
            <div className="rounded-2xl border border-line bg-card p-8 text-center text-xs text-fog">
              Tidak ada pesanan pembelian yang sesuai dengan filter pencarian.
            </div>
          ) : (
            <PurchasesTable
              purchases={purchases}
              isOwner={isOwner}
              onSend={handleSend}
              onReceive={(po) => setReceiveModalPurchase(po)}
              onPay={(po) => setPayModalPurchase(po)}
              onCancel={handleCancel}
              onDeleteDraft={handleDeleteDraft}
            />
          )}
        </>
      )}

      {/* Create Modal */}
      <PurchaseCreateModal
        open={createModalOpen}
        businessId={businessId}
        branchId={branchId}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateSubmit}
        isSaving={mutationState === 'saving'}
        error={createModalError}
      />

      {/* Receive Modal */}
      <PurchaseReceiveModal
        open={!!receiveModalPurchase}
        purchase={receiveModalPurchase}
        onClose={() => setReceiveModalPurchase(null)}
        onSubmit={handleReceiveSubmit}
        isSaving={mutationState === 'saving'}
      />

      {/* Payment Modal */}
      <PurchasePaymentModal
        open={!!payModalPurchase}
        purchase={payModalPurchase}
        onClose={() => setPayModalPurchase(null)}
        onSubmit={handlePaySubmit}
        isSaving={mutationState === 'saving'}
      />
    </div>
  );
}
