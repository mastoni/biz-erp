'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { getCustomers } from '@/features/customers/api';
import { Customer } from '@/features/customers/types';
import { CustomersTable } from '@/features/customers/components/CustomersTable';
import { CustomerEmptyState } from '@/features/customers/components/CustomerEmptyState';
import {
  CUSTOMERS_PAGE_SIZE,
  CUSTOMERS_PAGE_TITLE,
  CUSTOMERS_PAGE_SUBTITLE,
  CUSTOMERS_ADD_ACTION_LABEL,
  CUSTOMERS_FETCH_FALLBACK,
  CUSTOMERS_PAGE_FALLBACK,
  canAddCustomer,
  getApiErrorInfo,
  formatRangeLabel,
  isNextDisabled,
  isPreviousDisabled,
  shouldShowEmpty,
  shouldShowError,
  shouldShowSkeleton,
  shouldShowTable,
} from '@/features/customers/list-helpers';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus } from 'lucide-react';

export default function CustomersPage() {
  const router = useRouter();
  const { business, role } = useAuth();
  const isOwner = canAddCustomer(role);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    if (!business?.id) return;

    (async () => {
      setLoading(true);
      setError(null);
      setRequestId(null);
      setOffset(0);

      try {
        const data = await getCustomers(business.id, CUSTOMERS_PAGE_SIZE, 0);
        if (!activeRef.current) return;
        setCustomers(data.items);
        setTotal(data.total);
        setHasMore(data.has_more);
      } catch (err) {
        if (!activeRef.current) return;
        const info = getApiErrorInfo(err, CUSTOMERS_FETCH_FALLBACK);
        setError(info.message);
        setRequestId(info.requestId);
      } finally {
        if (activeRef.current) setLoading(false);
      }
    })();

    return () => { activeRef.current = false; };
  }, [business?.id, reloadKey]);

  const handleNextPage = async () => {
    if (!business?.id || loading) return;

    const nextOffset = offset + CUSTOMERS_PAGE_SIZE;
    setLoading(true);
    setError(null);

    try {
      const data = await getCustomers(business.id, CUSTOMERS_PAGE_SIZE, nextOffset);
      if (!activeRef.current) return;
      setCustomers(data.items);
      setTotal(data.total);
      setOffset(nextOffset);
      setHasMore(data.has_more);
    } catch (err) {
      if (!activeRef.current) return;
      const info = getApiErrorInfo(err, CUSTOMERS_PAGE_FALLBACK);
      setError(info.message);
      setRequestId(info.requestId);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  };

  const handlePrevPage = async () => {
    if (!business?.id || loading || offset === 0) return;

    const prevOffset = Math.max(0, offset - CUSTOMERS_PAGE_SIZE);
    setLoading(true);
    setError(null);

    try {
      const data = await getCustomers(business.id, CUSTOMERS_PAGE_SIZE, prevOffset);
      if (!activeRef.current) return;
      setCustomers(data.items);
      setTotal(data.total);
      setOffset(prevOffset);
      setHasMore(data.has_more);
    } catch (err) {
      if (!activeRef.current) return;
      const info = getApiErrorInfo(err, CUSTOMERS_PAGE_FALLBACK);
      setError(info.message);
      setRequestId(info.requestId);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  };

  const handleRetry = () => {
    setReloadKey((key) => key + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold tracking-tight text-ink">{CUSTOMERS_PAGE_TITLE}</h2>
          <p className="text-ink/60 mt-1">{CUSTOMERS_PAGE_SUBTITLE}</p>
        </div>
        {isOwner && (
          <Button onClick={() => router.push('/customers/new')} className="bg-ink text-paper hover:bg-ink-2">
            <Plus className="mr-2 h-4 w-4" />
            {CUSTOMERS_ADD_ACTION_LABEL}
          </Button>
        )}
      </div>

      {/* Loading skeleton */}
      {shouldShowSkeleton(loading) && (
        <div className="bg-card border-2 border-ink/10 rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Telepon</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead>Diperbarui</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Error state */}
      {shouldShowError(loading, error) && (
        <div className="rounded-md bg-brick/5 border border-brick/20 p-4">
          <p className="text-sm text-brick font-medium">Gagal memuat data pelanggan</p>
          <p className="text-sm text-brick/80 mt-1">{error}</p>
          {requestId && (
            <p className="text-xs text-brick/60 mt-2 font-mono">Request ID: {requestId}</p>
          )}
          <Button variant="outline" size="sm" className="mt-3 border-ink/20 text-ink hover:bg-ink/5" onClick={handleRetry}>
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Empty state */}
      {shouldShowEmpty(loading, error, customers.length) && (
        <CustomerEmptyState
          isOwner={isOwner}
          onAddClick={() => router.push('/customers/new')}
        />
      )}

      {/* Table */}
      {shouldShowTable(loading, error, customers.length) && (
        <>
          <div className="bg-card border-2 border-ink/10 rounded-md overflow-hidden">
            <CustomersTable customers={customers} isOwner={isOwner} />
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink/60">
              {formatRangeLabel(total, offset, CUSTOMERS_PAGE_SIZE)}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={isPreviousDisabled(loading, offset)}
                className="border-ink/20 text-ink hover:bg-ink/5"
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={isNextDisabled(loading, hasMore)}
                className="border-ink/20 text-ink hover:bg-ink/5"
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
