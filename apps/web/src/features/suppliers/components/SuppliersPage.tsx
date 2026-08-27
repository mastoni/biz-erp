'use client';

import React, { useMemo, useState } from 'react';
import { SuppliersKPICards } from './SuppliersKPICards';
import { SuppliersToolbar } from './SuppliersToolbar';
import { SuppliersTable } from './SuppliersTable';
import { SupplierCreateModal } from './SupplierCreateModal';
import { SupplierEmptyState } from './SupplierEmptyState';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from '@/components/ui/button';
import { Package, Plus, RefreshCw } from 'lucide-react';
import {
  useSuppliersViewModel,
  SUPPLIERS_PAGE_SIZE,
} from '../use-suppliers-viewmodel';
import type {
  SupplierCreateFormModel,
  SupplierUpdateInput,
  SupplierViewModel,
} from '../types';
import { classifySupplierError } from '../api';
import { canAddSupplier } from '../supplier-helpers';

interface SuppliersPageProps {
  businessId: string;
  role: 'OWNER' | 'CASHIER';
}

export function SuppliersPage({ businessId, role }: SuppliersPageProps) {
  const {
    suppliers,
    allSuppliers,
    summary,
    dataState,
    isLoading,
    isEmpty,
    error,
    search,
    setSearch,
    mutationState,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    refresh,
  } = useSuppliersViewModel({ businessId, limit: SUPPLIERS_PAGE_SIZE });

  const isOwner = role === 'OWNER';
  const [modalOpen, setModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const handleCreate = async (form: SupplierCreateFormModel) => {
    setModalError(null);
    try {
      await addSupplier(form);
    } catch (err: any) {
      const errorType = classifySupplierError(err);
      if (errorType === 'validation_error') {
        throw err;
      }
      setModalError(err?.response?.data?.message || err?.message || 'Gagal mendaftarkan supplier.');
      throw err;
    }
  };

  const handleDelete = async (id: string) => {
    await deleteSupplier(id);
  };

  const handleStatusToggle = async (supplier: SupplierViewModel) => {
    const newStatus = supplier.status === 'aktif' ? 'nonaktif' : 'aktif';
    try {
      await updateSupplier(supplier.id, {
        status: newStatus,
      });
    } catch (err: any) {
      console.error('Failed to toggle status:', err?.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Supplier</h1>
            <p className="text-sm text-fog">
              Mitra pemasok barang, termin pembayaran, dan riwayat kerja sama.
            </p>
          </div>
          {isOwner && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus width={15} height={15} />
              Tambah Supplier
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <SuppliersKPICards summary={summary} isOwner={isOwner} />

      {/* Toolbar */}
      <SuppliersToolbar
        search={search}
        onSearchChange={setSearch}
        filteredCount={suppliers.length}
        totalCount={allSuppliers.length}
      />

      {/* Table / States */}
      {dataState === 'loading' && (
        <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-line bg-paper/60">
                  <th className="w-8 px-4 py-3"></th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Supplier</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Kategori</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Kontak</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Termin</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Rating</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Hutang Berjalan</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-fog">Status</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-line/60">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="h-5 w-full animate-pulse rounded bg-paper/70" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dataState === 'error' && (
        <ErrorState
          message={error || 'Terjadi kesalahan saat mengambil data supplier.'}
          onRetry={refresh}
        />
      )}

      {dataState === 'ready' && (
        <SuppliersTable
          suppliers={suppliers}
          isOwner={isOwner}
          onDelete={handleDelete}
          onStatusToggle={handleStatusToggle}
        />
      )}

      {dataState === 'empty' && (
        <SupplierEmptyState
          isOwner={isOwner}
          onAddClick={isOwner ? () => setModalOpen(true) : undefined}
        />
      )}

      {/* Create Modal */}
      <SupplierCreateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        isSaving={mutationState === 'saving'}
        error={modalError}
      />
    </div>
  );
}
