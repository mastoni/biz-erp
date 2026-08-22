'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { getCustomer } from '@/features/customers/api';
import { Customer } from '@/features/customers/types';
import { CustomerDetail } from '@/features/customers/components/CustomerDetail';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { AxiosError } from 'axios';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { business, role } = useAuth();
  const isOwner = role === 'OWNER';

  const customerId = typeof params?.id === 'string' ? params.id : null;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    if (!business?.id || !customerId) return;

    (async () => {
      setLoading(true);
      setError(null);
      setRequestId(null);

      try {
        const data = await getCustomer(business.id, customerId);
        if (!activeRef.current) return;
        setCustomer(data);
      } catch (err) {
        if (!activeRef.current) return;
        let msg = 'Terjadi kesalahan saat mengambil data pelanggan.';
        let rid: string | null = null;
        if (err instanceof AxiosError) {
          msg = err.response?.data?.message || err.message || msg;
          rid = err.response?.headers?.['x-request-id'] ?? null;
        }
        setError(msg);
        setRequestId(rid);
      } finally {
        if (activeRef.current) setLoading(false);
      }
    })();

    return () => { activeRef.current = false; };
  }, [business?.id, customerId]);

  return (
    <div className="space-y-6">
      {/* Back */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push('/customers')} className="text-ink hover:bg-ink/5">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Daftar Pelanggan
        </Button>
      </div>

      {/* Title */}
      <div>
        <h2 className="text-3xl font-display font-bold tracking-tight text-ink">Detail Pelanggan</h2>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <Card className="border-2 border-ink/10 bg-card">
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 404 / Not Found */}
      {!loading && error && error.includes('not found') && (
        <div className="rounded-md bg-marigold/5 border border-marigold/20 p-6 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-marigold" />
          <p className="text-sm font-semibold text-ink">Data pelanggan tidak ditemukan</p>
          <p className="text-sm text-ink/60 mt-1">
            Pelanggan untuk ID ini tidak tersedia atau telah dihapus.
          </p>
          <Button variant="outline" size="sm" className="mt-4 border-ink/20 text-ink hover:bg-ink/5" onClick={() => router.push('/customers')}>
            Kembali ke Daftar
          </Button>
        </div>
      )}

      {/* Other errors */}
      {!loading && error && !error.includes('not found') && (
        <div className="rounded-md bg-brick/5 border border-brick/20 p-4">
          <p className="text-sm text-brick font-medium">Gagal memuat detail pelanggan</p>
          <p className="text-sm text-brick/80 mt-1">{error}</p>
          {requestId && (
            <p className="text-xs text-brick/60 mt-2 font-mono">Request ID: {requestId}</p>
          )}
          <Button variant="outline" size="sm" className="mt-3 border-ink/20 text-ink hover:bg-ink/5" onClick={() => router.push('/customers')}>
            Kembali ke Daftar
          </Button>
        </div>
      )}

      {/* Detail */}
      {!loading && !error && customer && (
        <CustomerDetail customer={customer} isOwner={isOwner} />
      )}
    </div>
  );
}
