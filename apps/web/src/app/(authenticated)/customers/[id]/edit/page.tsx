'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { getCustomer } from '@/features/customers/api';
import { Customer } from '@/features/customers/types';
import { CustomerForm } from '@/features/customers/components/CustomerForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';

export default function CustomerEditPage() {
  const params = useParams();
  const router = useRouter();
  const { business, role } = useAuth();

  const customerId = typeof params?.id === 'string' ? params.id : null;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    if (!business?.id || !customerId) return;

    (async () => {
      setLoading(true);
      try {
        const data = await getCustomer(business.id, customerId);
        if (!activeRef.current) return;
        setCustomer(data);
      } catch {
        if (!activeRef.current) return;
        setError('Pelanggan tidak ditemukan.');
      } finally {
        if (activeRef.current) setLoading(false);
      }
    })();

    return () => { activeRef.current = false; };
  }, [business?.id, customerId]);

  // RBAC: only OWNER can access edit
  if (role !== 'OWNER') {
    return (
      <div className="rounded-md bg-brick/5 border border-brick/20 p-6 text-center">
        <p className="text-sm font-semibold text-brick">Akses ditolak</p>
        <p className="text-sm text-brick/80 mt-1">Anda tidak memiliki izin untuk halaman ini.</p>
        <Button variant="outline" size="sm" className="mt-4 border-ink/20 text-ink hover:bg-ink/5" onClick={() => router.push('/customers')}>
          Kembali ke Daftar
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="border-2 border-ink/10 bg-card">
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <div className="flex gap-3">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="rounded-md bg-marigold/5 border border-marigold/20 p-6 text-center">
        <p className="text-sm font-semibold text-ink">Data pelanggan tidak ditemukan</p>
        <p className="text-sm text-ink/60 mt-1">{error ?? 'Pelanggan tidak tersedia.'}</p>
        <Button variant="outline" size="sm" className="mt-4 border-ink/20 text-ink hover:bg-ink/5" onClick={() => router.push('/customers')}>
          Kembali ke Daftar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push(`/customers/${customer.id}`)} className="text-ink hover:bg-ink/5">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Detail
        </Button>
      </div>

      <div>
        <h2 className="text-3xl font-display font-bold tracking-tight text-ink">Edit Pelanggan</h2>
        <p className="text-ink/50 text-sm mt-1 font-mono">{customer.id}</p>
      </div>

      <CustomerForm businessId={business!.id} customer={customer} />
    </div>
  );
}
