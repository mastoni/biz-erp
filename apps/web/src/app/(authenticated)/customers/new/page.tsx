'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { CustomerForm } from '@/features/customers/components/CustomerForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function CustomerCreatePage() {
  const router = useRouter();
  const { business, role } = useAuth();

  if (role !== 'OWNER') {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 p-6 text-center">
        <p className="text-sm font-semibold text-red-800">Akses ditolak</p>
        <p className="text-sm text-red-600 mt-1">Anda tidak memiliki izin untuk halaman ini.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push('/customers')}>
          Kembali ke Daftar
        </Button>
      </div>
    );
  }

  if (!business?.id) return null;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push('/customers')} className="text-ink hover:bg-ink/5">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Daftar Pelanggan
        </Button>
      </div>

      <div>
        <h2 className="text-3xl font-display font-bold tracking-tight text-ink">Tambah Pelanggan</h2>
      </div>

      <CustomerForm businessId={business.id} />
    </div>
  );
}
