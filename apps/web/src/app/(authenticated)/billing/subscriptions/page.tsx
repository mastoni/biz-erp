'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  Plus,
  Search,
  Filter,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { getCustomers } from '@/features/customers/api';
import { Customer } from '@/features/customers/types';
import {
  CustomerSubscriptionDto,
  CustomerSubscriptionStatus,
  CustomerSubscriptionBillingCycle,
} from '@/features/billing/types';
import {
  getCustomerSubscriptions,
  getBillingApiErrorMessage,
} from '@/features/billing/api';
import { SubscriptionTable } from '@/features/billing/components/SubscriptionTable';
import { SubscriptionCreateModal } from '@/features/billing/components/SubscriptionCreateModal';
import { SubscriptionPriceModal } from '@/features/billing/components/SubscriptionPriceModal';
import { SubscriptionActionModal } from '@/features/billing/components/SubscriptionActionModal';
import { GenerateInvoiceModal } from '@/features/billing/components/GenerateInvoiceModal';

export default function SubscriptionsListPage() {
  const { role, business } = useAuth();
  const canCreate = role === 'OWNER' || role === 'STAFF';

  const [subscriptions, setSubscriptions] = useState<CustomerSubscriptionDto[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerSubscriptionStatus | ''>('');
  const [cycleFilter, setCycleFilter] = useState<CustomerSubscriptionBillingCycle | ''>('');

  // Modals
  const [isCreateSubOpen, setIsCreateSubOpen] = useState(false);
  const [selectedSubForPrice, setSelectedSubForPrice] = useState<CustomerSubscriptionDto | null>(null);
  const [selectedSubForAction, setSelectedSubForAction] = useState<CustomerSubscriptionDto | null>(null);
  const [subActionType, setSubActionType] = useState<'pause' | 'resume' | 'cancel' | null>(null);
  const [selectedSubForGenInvoice, setSelectedSubForGenInvoice] = useState<CustomerSubscriptionDto | null>(null);

  const loadSubscriptions = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [res, custRes] = await Promise.all([
        getCustomerSubscriptions({
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          billing_cycle: cycleFilter || undefined,
          limit: 100,
          offset: 0,
        }),
        business?.id ? getCustomers(business.id, 100, 0) : Promise.resolve({ items: [] as Customer[], total: 0, limit: 100, offset: 0, has_more: false }),
      ]);
      setSubscriptions(res.items || []);
      setTotalCount(res.total || 0);
      setCustomers(custRes.items || []);
    } catch (err) {
      setErrorMessage(getBillingApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, cycleFilter, business?.id]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadSubscriptions();
    }, 250);
    return () => clearTimeout(timeout);
  }, [loadSubscriptions]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-ink/20">
        <div className="flex items-start gap-3">
          <Link
            href="/billing"
            className="mt-1 rounded-lg border border-ink/15 p-2 text-ink/60 hover:bg-ink/5 hover:text-ink dark:border-ink/25"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h1 className="font-display text-xl font-bold text-ink">Langganan Pelanggan</h1>
            </div>
            <p className="text-xs text-ink/60">
              Total {totalCount} paket langganan dan penagihan berkala CRM terdaftar
            </p>
          </div>
        </div>

        {canCreate && (
          <button
            onClick={() => setIsCreateSubOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Tambah Langganan
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-4 text-xs text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-ink/20">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink/40" />
          <input
            type="text"
            placeholder="Cari nama paket, catatan, atau ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-ink/15 bg-surface py-2 pl-9 pr-3 text-xs text-ink placeholder:text-ink/40 focus:border-pine focus:outline-none dark:border-ink/25"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CustomerSubscriptionStatus | '')}
            className="rounded-lg border border-ink/15 bg-surface px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/25"
          >
            <option value="">Semua Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="PAUSED">Ditunda (Paused)</option>
            <option value="CANCELLED">Dibatalkan</option>
          </select>

          {/* Cycle Filter */}
          <select
            value={cycleFilter}
            onChange={(e) => setCycleFilter(e.target.value as CustomerSubscriptionBillingCycle | '')}
            className="rounded-lg border border-ink/15 bg-surface px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/25"
          >
            <option value="">Semua Siklus</option>
            <option value="MONTHLY">Bulanan (Monthly)</option>
            <option value="QUARTERLY">Triwulan (Quarterly)</option>
            <option value="SEMI_ANNUAL">Semester (Semi-Annual)</option>
            <option value="ANNUAL">Tahunan (Annual)</option>
          </select>
        </div>
      </div>

      {/* Subscription Table */}
      <SubscriptionTable
        subscriptions={subscriptions}
        isLoading={isLoading}
        role={role}
        onGenerateInvoice={(sub) => setSelectedSubForGenInvoice(sub)}
        onPause={(sub) => {
          setSelectedSubForAction(sub);
          setSubActionType('pause');
        }}
        onResume={(sub) => {
          setSelectedSubForAction(sub);
          setSubActionType('resume');
        }}
        onCancel={(sub) => {
          setSelectedSubForAction(sub);
          setSubActionType('cancel');
        }}
        onEditPrice={(sub) => setSelectedSubForPrice(sub)}
      />

      {/* Modals */}
      <SubscriptionCreateModal
        isOpen={isCreateSubOpen}
        customers={customers}
        onClose={() => setIsCreateSubOpen(false)}
        onSuccess={loadSubscriptions}
      />

      <SubscriptionPriceModal
        subscription={selectedSubForPrice}
        isOpen={!!selectedSubForPrice}
        onClose={() => setSelectedSubForPrice(null)}
        onSuccess={loadSubscriptions}
      />

      <SubscriptionActionModal
        subscription={selectedSubForAction}
        actionType={subActionType}
        isOpen={!!selectedSubForAction && !!subActionType}
        onClose={() => {
          setSelectedSubForAction(null);
          setSubActionType(null);
        }}
        onSuccess={loadSubscriptions}
      />

      <GenerateInvoiceModal
        subscription={selectedSubForGenInvoice}
        isOpen={!!selectedSubForGenInvoice}
        onClose={() => setSelectedSubForGenInvoice(null)}
        onSuccess={loadSubscriptions}
      />
    </div>
  );
}
