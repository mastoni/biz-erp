'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { useCustomersViewModel } from '@/features/customers/use-customers-viewmodel';
import { CustomersKPICards } from '@/features/customers/components/CustomersKPICards';
import { CustomersToolbar } from '@/features/customers/components/CustomersToolbar';
import { CustomersTable } from '@/features/customers/components/CustomersTable';
import { CustomerCreateModal } from '@/features/customers/components/CustomerCreateModal';
import type { CustomerCreateFormModel } from '@/features/customers/types';

export default function CustomersPage() {
  const { business } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const {
    customers,
    allCustomers,
    summary,
    isLoading,
    error,
    search,
    setSearch,
    mutationState,
    addCustomer,
    refresh,
  } = useCustomersViewModel({
    businessId: business?.id,
  });

  const handleCreateCustomer = async (form: CustomerCreateFormModel) => {
    const created = await addCustomer(form);
    setToastMessage(`Pelanggan "${created.name}" terdaftar sebagai member ${created.tier}.`);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Toast feedback */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 rounded-xl border border-pine/30 bg-pine text-white px-4 py-2.5 text-xs font-semibold shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          {toastMessage}
        </div>
      )}

      {/* Section Head */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Pelanggan</h1>
          <p className="text-xs text-fog mt-0.5">Member terdaftar, poin loyalitas, dan riwayat belanja.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-pine px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-pine-deep cursor-pointer"
        >
          <Plus width={15} height={15} />
          Tambah Pelanggan
        </button>
      </div>

      {/* KPI Cards */}
      <CustomersKPICards summary={summary} />

      {/* Search Toolbar */}
      <CustomersToolbar
        search={search}
        onSearchChange={setSearch}
        filteredCount={customers.length}
        totalCount={allCustomers.length}
      />

      {/* Error state */}
      {error && (
        <div className="rounded-2xl border border-brick/30 bg-brick/10 p-4">
          <p className="text-xs font-semibold text-brick">Gagal memuat data pelanggan</p>
          <p className="text-xs text-brick/80 mt-1">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="mt-3 rounded-lg border border-brick/40 px-3 py-1 text-xs font-bold text-brick hover:bg-brick/10"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Customers Ledger Table */}
      <CustomersTable customers={customers} isLoading={isLoading} />

      {/* Create Modal */}
      <CustomerCreateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreateCustomer}
        isSaving={mutationState === 'saving'}
      />
    </div>
  );
}
