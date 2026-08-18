'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { getSales } from '@/features/sales/api';
import { Sale } from '@/features/sales/types';
import { SalesTable } from '@/features/sales/components/SalesTable';
import { SalesEmptyState } from '@/features/sales/components/SalesEmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Receipt, TrendingUp } from 'lucide-react';
import { AxiosError } from 'axios';
import { formatMinor } from '@/lib/format';

const PAGE_LIMIT = 500;

export default function SalesPage() {
  const { business } = useAuth();

  const [sales, setSales] = useState<Sale[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const cursorRef = useRef<number>(0);
  const lastCursorRef = useRef<number | null>(null);

  const loadSales = async (since: number, isLoadMore: boolean) => {
    if (!business?.id) return;

    if (isLoadMore) setLoadingMore(true);
    else {
      setLoading(true);
      setError(null);
      setRequestId(null);
    }

    try {
      const data = await getSales(business.id, since, PAGE_LIMIT);

      setSales((prev) => {
        if (!isLoadMore) return data.sales;

        const existingIds = new Set(prev.map((s) => s.id));
        const newSales = data.sales.filter((s) => !existingIds.has(s.id));
        return [...prev, ...newSales];
      });

      setHasMore(data.has_more);

      if (data.sales.length > 0) {
        const lastSale = data.sales[data.sales.length - 1];
        cursorRef.current = lastSale.server_created_at;
      }
    } catch (err) {
      let msg = 'Terjadi kesalahan saat mengambil data penjualan.';
      let rid: string | null = null;

      if (err instanceof AxiosError) {
        msg = err.response?.data?.message || err.message || msg;
        rid = err.response?.headers?.['x-request-id'] ?? null;
      }

      setError(msg);
      setRequestId(rid);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (!business?.id) return;

    (async () => {
      if (!active) return;
      cursorRef.current = 0;
      lastCursorRef.current = null;
      await loadSales(0, false);
    })();

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id]);

  const handleLoadMore = () => {
    const currentCursor = cursorRef.current;

    if (lastCursorRef.current !== null && lastCursorRef.current === currentCursor) {
      setHasMore(false);
      setError('Tidak dapat melanjutkan pagination: tidak ada kemajuan cursor.');
      return;
    }

    lastCursorRef.current = currentCursor;
    loadSales(currentCursor, true);
  };

  const handleRefresh = () => {
    cursorRef.current = 0;
    lastCursorRef.current = null;
    setSales([]);
    setHasMore(false);
    loadSales(0, false);
  };

  // Compute summary metrics from local data
  const totalRevenue = sales.reduce((sum, s) => sum + s.grand_total_minor, 0);
  const totalTransactions = sales.length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Sales</h2>
          <p className="text-zinc-600 mt-1">
            Riwayat transaksi penjualan
            {sales.length > 0 && (
              <span className="ml-2 text-zinc-400 text-sm">
                ({sales.length} transaksi dimuat{hasMore ? ', ada lebih' : ''})
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards — only shown when data is loaded */}
      {!loading && !error && sales.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="rounded-md bg-blue-50 p-3">
                <Receipt className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Total Transaksi</p>
                <p className="text-xl font-semibold text-zinc-900 tabular-nums">{totalTransactions}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="rounded-md bg-emerald-50 p-3">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Total Pendapatan</p>
                <p className="text-xl font-semibold text-zinc-900 tabular-nums">{formatMinor(totalRevenue)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading state — skeleton table */}
      {loading && (
        <div className="bg-white border border-zinc-200 rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Receipt</TableHead>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead className="whitespace-nowrap">Payment</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Subtotal</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Discount</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Tax</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Total</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Cash</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Change</TableHead>
                  <TableHead className="whitespace-nowrap">Cashier</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 11 }).map((_, j) => (
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
      {!loading && error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700 font-medium">Gagal memuat data penjualan</p>
          <p className="text-sm text-red-600 mt-1">{error}</p>
          {requestId && (
            <p className="text-xs text-red-400 mt-2 font-mono">Request ID: {requestId}</p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={handleRefresh}
          >
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && sales.length === 0 && <SalesEmptyState />}

      {/* Sales table */}
      {!loading && !error && sales.length > 0 && (
        <SalesTable
          sales={sales}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={handleLoadMore}
        />
      )}
    </div>
  );
}
