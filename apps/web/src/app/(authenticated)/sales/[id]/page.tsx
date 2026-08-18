'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { getSales } from '@/features/sales/api';
import { Sale } from '@/features/sales/types';
import { SaleDetail } from '@/features/sales/components/SaleDetail';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { AxiosError } from 'axios';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

export default function SaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { business } = useAuth();

  const saleId = typeof params?.id === 'string' ? params.id : null;

  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!business?.id || !saleId) return;

    let active = true;

    (async () => {
      setLoading(true);
      setError(null);
      setRequestId(null);
      setNotFound(false);

      try {
        let found: Sale | null = null;
        let since = 0;
        let hasMore = true;
        const limit = 500;

        while (hasMore && !found) {
          const data = await getSales(business.id, since, limit);

          if (!active) return;

          const match = data.sales.find((s) => s.id === saleId);
          if (match) {
            found = match;
            break;
          }

          if (!data.has_more || data.sales.length === 0) {
            hasMore = false;
          } else {
            const last = data.sales[data.sales.length - 1];
            if (last.server_created_at === since) {
              hasMore = false;
            } else {
              since = last.server_created_at;
            }
          }
        }

        if (!active) return;

        if (found) {
          setSale(found);
        } else {
          setNotFound(true);
        }
      } catch (err) {
        if (!active) return;

        let msg = 'Terjadi kesalahan saat mengambil data penjualan.';
        let rid: string | null = null;

        if (err instanceof AxiosError) {
          msg = err.response?.data?.message || err.message || msg;
          rid = err.response?.headers?.['x-request-id'] ?? null;
        }

        setError(msg);
        setRequestId(rid);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [business?.id, saleId]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push('/sales')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Daftar Penjualan
        </Button>
      </div>

      {/* Page title */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Detail Penjualan</h2>
        {saleId && (
          <p className="text-zinc-400 text-xs mt-1 font-mono break-all">{saleId}</p>
        )}
      </div>

      {/* Loading — skeleton detail */}
      {loading && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                      <TableHead className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableHead>
                      <TableHead className="text-right"><Skeleton className="h-4 w-24 ml-auto" /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-full ml-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-full ml-auto" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700 font-medium">Gagal memuat detail transaksi</p>
          <p className="text-sm text-red-600 mt-1">{error}</p>
          {requestId && (
            <p className="text-xs text-red-400 mt-2 font-mono">Request ID: {requestId}</p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => router.push('/sales')}
          >
            Kembali ke Daftar
          </Button>
        </div>
      )}

      {/* Not found */}
      {!loading && !error && notFound && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-6 text-center">
          <p className="text-sm font-semibold text-amber-800">Data transaksi tidak ditemukan</p>
          <p className="text-sm text-amber-700 mt-1">
            Data penjualan untuk ID ini tidak tersedia atau belum disinkronisasi.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => router.push('/sales')}
          >
            Kembali ke Daftar
          </Button>
        </div>
      )}

      {/* Detail */}
      {!loading && !error && !notFound && sale && (
        <SaleDetail sale={sale} />
      )}
    </div>
  );
}
