'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import {
  CustomerSubscriptionDetailDto,
  CustomerSubscriptionDto,
} from '@/features/billing/types';
import {
  getCustomerSubscription,
  getBillingApiErrorMessage,
} from '@/features/billing/api';
import { SubscriptionDetailView } from '@/features/billing/components/SubscriptionDetailView';
import { SubscriptionPriceModal } from '@/features/billing/components/SubscriptionPriceModal';
import { SubscriptionActionModal } from '@/features/billing/components/SubscriptionActionModal';
import { GenerateInvoiceModal } from '@/features/billing/components/GenerateInvoiceModal';

export default function SubscriptionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { role } = useAuth();

  const [subscription, setSubscription] = useState<CustomerSubscriptionDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'pause' | 'resume' | 'cancel' | null>(null);
  const [isGenInvoiceOpen, setIsGenInvoiceOpen] = useState(false);

  const loadSubscription = useCallback(async () => {
    if (!params?.id) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await getCustomerSubscription(params.id);
      setSubscription(data);
    } catch (err) {
      setErrorMessage(getBillingApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [params?.id]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-ink/10 bg-surface p-16 text-center shadow-sm dark:border-ink/20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-pine/20 border-t-pine" />
        <p className="mt-3 text-xs text-ink/60">Memuat detail langganan...</p>
      </div>
    );
  }

  if (errorMessage || !subscription) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-8 text-center dark:bg-rose-500/10">
        <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
        <h2 className="mt-2 font-display text-sm font-bold text-ink">Gagal Memuat Detail Langganan</h2>
        <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
          {errorMessage || 'Data langganan tidak ditemukan dalam konteks bisnis Anda.'}
        </p>
        <button
          onClick={() => router.push('/billing/subscriptions')}
          className="mt-4 rounded-lg bg-ink/10 px-4 py-2 text-xs font-semibold text-ink hover:bg-ink/15"
        >
          Kembali ke Daftar Langganan
        </button>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <SubscriptionDetailView
        subscription={subscription}
        role={role}
        onGenerateInvoice={() => setIsGenInvoiceOpen(true)}
        onPause={() => setActionType('pause')}
        onResume={() => setActionType('resume')}
        onCancel={() => setActionType('cancel')}
        onEditPrice={() => setIsPriceModalOpen(true)}
      />

      {/* Modals */}
      <SubscriptionPriceModal
        subscription={subscription}
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        onSuccess={loadSubscription}
      />

      <SubscriptionActionModal
        subscription={subscription}
        actionType={actionType}
        isOpen={!!actionType}
        onClose={() => setActionType(null)}
        onSuccess={loadSubscription}
      />

      <GenerateInvoiceModal
        subscription={subscription}
        isOpen={isGenInvoiceOpen}
        onClose={() => setIsGenInvoiceOpen(false)}
        onSuccess={loadSubscription}
      />
    </div>
  );
}
