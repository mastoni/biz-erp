'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Receipt,
  Search,
  Filter,
  AlertCircle,
  ArrowLeft,
  Calendar,
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import {
  CustomerInvoiceDto,
  CustomerInvoiceStatus,
} from '@/features/billing/types';
import {
  getCustomerInvoices,
  getBillingApiErrorMessage,
} from '@/features/billing/api';
import { InvoiceTable } from '@/features/billing/components/InvoiceTable';
import { InvoicePaymentModal } from '@/features/billing/components/InvoicePaymentModal';
import { InvoiceCancelModal } from '@/features/billing/components/InvoiceCancelModal';

export default function InvoicesListPage() {
  const { role } = useAuth();

  const [invoices, setInvoices] = useState<CustomerInvoiceDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerInvoiceStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modals
  const [selectedInvForPayment, setSelectedInvForPayment] = useState<CustomerInvoiceDto | null>(null);
  const [selectedInvForCancel, setSelectedInvForCancel] = useState<CustomerInvoiceDto | null>(null);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await getCustomerInvoices({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        limit: 100,
        offset: 0,
      });
      setInvoices(res.items || []);
      setTotalCount(res.total || 0);
    } catch (err) {
      setErrorMessage(getBillingApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadInvoices();
    }, 250);
    return () => clearTimeout(timeout);
  }, [loadInvoices]);

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
              <Receipt className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              <h1 className="font-display text-xl font-bold text-ink">Daftar Tagihan & Invoice</h1>
            </div>
            <p className="text-xs text-ink/60">
              Total {totalCount} invoice penagihan pelanggan dan pencatatan piutang usaha (AR)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/billing/subscriptions"
            className="rounded-lg border border-ink/15 px-3.5 py-2 text-xs font-medium text-ink hover:bg-ink/5 dark:border-ink/25"
          >
            Kelola Langganan
          </Link>
        </div>
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
            placeholder="Cari nomor invoice (INV-...), ID pelanggan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-ink/15 bg-surface py-2 pl-9 pr-3 text-xs text-ink placeholder:text-ink/40 focus:border-pine focus:outline-none dark:border-ink/25"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CustomerInvoiceStatus | '')}
            className="rounded-lg border border-ink/15 bg-surface px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/25"
          >
            <option value="">Semua Status</option>
            <option value="DRAFT">Draf</option>
            <option value="ISSUED">Diterbitkan (Issued)</option>
            <option value="PAID">Lunas (Paid)</option>
            <option value="OVERDUE">Jatuh Tempo (Overdue)</option>
            <option value="CANCELLED">Dibatalkan (Cancelled)</option>
          </select>

          {/* Date from */}
          <input
            type="date"
            title="Dari Tanggal"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-ink/15 bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/25"
          />

          {/* Date to */}
          <input
            type="date"
            title="Sampai Tanggal"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-ink/15 bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/25"
          />
        </div>
      </div>

      {/* Invoice Table */}
      <InvoiceTable
        invoices={invoices}
        isLoading={isLoading}
        role={role}
        onRecordPayment={(inv) => setSelectedInvForPayment(inv)}
        onCancelInvoice={(inv) => setSelectedInvForCancel(inv)}
      />

      {/* Modals */}
      <InvoicePaymentModal
        invoice={selectedInvForPayment}
        isOpen={!!selectedInvForPayment}
        onClose={() => setSelectedInvForPayment(null)}
        onSuccess={loadInvoices}
      />

      <InvoiceCancelModal
        invoice={selectedInvForCancel}
        isOpen={!!selectedInvForCancel}
        onClose={() => setSelectedInvForCancel(null)}
        onSuccess={loadInvoices}
      />
    </div>
  );
}
