'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, Receipt } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import {
  CustomerInvoiceDetailDto,
  CustomerInvoiceDto,
} from '@/features/billing/types';
import {
  getCustomerInvoice,
  getBillingApiErrorMessage,
} from '@/features/billing/api';
import { InvoiceDetailView } from '@/features/billing/components/InvoiceDetailView';
import { InvoicePaymentModal } from '@/features/billing/components/InvoicePaymentModal';
import { InvoiceCancelModal } from '@/features/billing/components/InvoiceCancelModal';

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { role } = useAuth();

  const [invoice, setInvoice] = useState<CustomerInvoiceDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const loadInvoice = useCallback(async () => {
    if (!params?.id) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await getCustomerInvoice(params.id);
      setInvoice(data);
    } catch (err) {
      setErrorMessage(getBillingApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [params?.id]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-ink/10 bg-surface p-16 text-center shadow-sm dark:border-ink/20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-pine/20 border-t-pine" />
        <p className="mt-3 text-xs text-ink/60">Memuat detail tagihan...</p>
      </div>
    );
  }

  if (errorMessage || !invoice) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-8 text-center dark:bg-rose-500/10">
        <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
        <h2 className="mt-2 font-display text-sm font-bold text-ink">Gagal Memuat Detail Tagihan</h2>
        <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
          {errorMessage || 'Data invoice tidak ditemukan dalam konteks bisnis Anda.'}
        </p>
        <button
          onClick={() => router.push('/billing/invoices')}
          className="mt-4 rounded-lg bg-ink/10 px-4 py-2 text-xs font-semibold text-ink hover:bg-ink/15"
        >
          Kembali ke Daftar Tagihan
        </button>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <InvoiceDetailView
        invoice={invoice}
        role={role}
        onRecordPayment={() => setIsPaymentOpen(true)}
        onCancelInvoice={() => setIsCancelOpen(true)}
      />

      {/* Modals */}
      <InvoicePaymentModal
        invoice={invoice}
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onSuccess={loadInvoice}
      />

      <InvoiceCancelModal
        invoice={invoice}
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        onSuccess={loadInvoice}
      />
    </div>
  );
}
