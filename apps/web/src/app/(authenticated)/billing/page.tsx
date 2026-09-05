'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  Receipt,
  Plus,
  ArrowRight,
  AlertCircle,
  FileText,
  DollarSign,
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { getCustomers } from '@/features/customers/api';
import { Customer } from '@/features/customers/types';
import {
  CustomerSubscriptionDto,
  CustomerInvoiceDto,
  BillingDashboardKPI,
} from '@/features/billing/types';
import {
  getCustomerSubscriptions,
  getCustomerInvoices,
  getBillingDashboardKPI,
  getBillingApiErrorMessage,
} from '@/features/billing/api';
import { BillingKPICards } from '@/features/billing/components/BillingKPICards';
import { SubscriptionTable } from '@/features/billing/components/SubscriptionTable';
import { InvoiceTable } from '@/features/billing/components/InvoiceTable';
import { SubscriptionCreateModal } from '@/features/billing/components/SubscriptionCreateModal';
import { SubscriptionPriceModal } from '@/features/billing/components/SubscriptionPriceModal';
import { SubscriptionActionModal } from '@/features/billing/components/SubscriptionActionModal';
import { GenerateInvoiceModal } from '@/features/billing/components/GenerateInvoiceModal';
import { InvoicePaymentModal } from '@/features/billing/components/InvoicePaymentModal';
import { InvoiceCancelModal } from '@/features/billing/components/InvoiceCancelModal';

export default function BillingDashboardPage() {
  const { role, business } = useAuth();
  const canCreate = role === 'OWNER' || role === 'STAFF';

  const [kpi, setKpi] = useState<BillingDashboardKPI | null>(null);
  const [subscriptions, setSubscriptions] = useState<CustomerSubscriptionDto[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoiceDto[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal states
  const [isCreateSubOpen, setIsCreateSubOpen] = useState(false);
  const [selectedSubForPrice, setSelectedSubForPrice] = useState<CustomerSubscriptionDto | null>(null);
  const [selectedSubForAction, setSelectedSubForAction] = useState<CustomerSubscriptionDto | null>(null);
  const [subActionType, setSubActionType] = useState<'pause' | 'resume' | 'cancel' | null>(null);
  const [selectedSubForGenInvoice, setSelectedSubForGenInvoice] = useState<CustomerSubscriptionDto | null>(null);
  const [selectedInvForPayment, setSelectedInvForPayment] = useState<CustomerInvoiceDto | null>(null);
  const [selectedInvForCancel, setSelectedInvForCancel] = useState<CustomerInvoiceDto | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [kpiData, subData, invData, custData] = await Promise.all([
        getBillingDashboardKPI(),
        getCustomerSubscriptions({ limit: 5 }),
        getCustomerInvoices({ limit: 5 }),
        business?.id ? getCustomers(business.id, 100, 0) : Promise.resolve({ items: [] as Customer[], total: 0, limit: 100, offset: 0, has_more: false }),
      ]);
      setKpi(kpiData);
      setSubscriptions(subData.items || []);
      setInvoices(invData.items || []);
      setCustomers(custData.items || []);
    } catch (err) {
      setErrorMessage(getBillingApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [business?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-ink/20">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <RefreshCw className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-ink">Langganan & Tagihan Rutin</h1>
              <p className="text-xs text-ink/60">
                Kelola recurring billing pelanggan, otomatisasi penerbitan invoice, dan pencatatan kas piutang (AR)
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/billing/subscriptions"
            className="flex items-center gap-1.5 rounded-lg border border-ink/15 px-3.5 py-2 text-xs font-medium text-ink hover:bg-ink/5 dark:border-ink/25"
          >
            <RefreshCw className="h-4 w-4 text-ink/60" />
            Kelola Langganan
          </Link>
          <Link
            href="/billing/invoices"
            className="flex items-center gap-1.5 rounded-lg border border-ink/15 px-3.5 py-2 text-xs font-medium text-ink hover:bg-ink/5 dark:border-ink/25"
          >
            <Receipt className="h-4 w-4 text-ink/60" />
            Daftar Invoice
          </Link>
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
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-4 text-xs text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* KPI Cards */}
      <BillingKPICards kpi={kpi} isLoading={isLoading} />

      {/* Recent Subscriptions Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-display text-sm font-bold text-ink">Langganan Pelanggan Terbaru</h2>
          </div>
          <Link
            href="/billing/subscriptions"
            className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Lihat Semua Langganan
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

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
      </div>

      {/* Recent Invoices Section */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <h2 className="font-display text-sm font-bold text-ink">Tagihan & Invoice Terbaru</h2>
          </div>
          <Link
            href="/billing/invoices"
            className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
          >
            Lihat Semua Tagihan
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <InvoiceTable
          invoices={invoices}
          isLoading={isLoading}
          role={role}
          onRecordPayment={(inv) => setSelectedInvForPayment(inv)}
          onCancelInvoice={(inv) => setSelectedInvForCancel(inv)}
        />
      </div>

      {/* Modals */}
      <SubscriptionCreateModal
        isOpen={isCreateSubOpen}
        customers={customers}
        onClose={() => setIsCreateSubOpen(false)}
        onSuccess={loadData}
      />

      <SubscriptionPriceModal
        subscription={selectedSubForPrice}
        isOpen={!!selectedSubForPrice}
        onClose={() => setSelectedSubForPrice(null)}
        onSuccess={loadData}
      />

      <SubscriptionActionModal
        subscription={selectedSubForAction}
        actionType={subActionType}
        isOpen={!!selectedSubForAction && !!subActionType}
        onClose={() => {
          setSelectedSubForAction(null);
          setSubActionType(null);
        }}
        onSuccess={loadData}
      />

      <GenerateInvoiceModal
        subscription={selectedSubForGenInvoice}
        isOpen={!!selectedSubForGenInvoice}
        onClose={() => setSelectedSubForGenInvoice(null)}
        onSuccess={loadData}
      />

      <InvoicePaymentModal
        invoice={selectedInvForPayment}
        isOpen={!!selectedInvForPayment}
        onClose={() => setSelectedInvForPayment(null)}
        onSuccess={loadData}
      />

      <InvoiceCancelModal
        invoice={selectedInvForCancel}
        isOpen={!!selectedInvForCancel}
        onClose={() => setSelectedInvForCancel(null)}
        onSuccess={loadData}
      />
    </div>
  );
}
