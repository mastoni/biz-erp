'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600 mb-6">
          <AlertCircle className="h-10 w-10" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 mb-2">Akses Ditolak (403)</h1>
        <p className="text-zinc-500 mb-8">
          Anda berhasil masuk, tetapi akun Anda tidak memiliki izin yang diperlukan untuk mengakses halaman ini.
          Silakan kembali ke Dashboard.
        </p>
        <Link href="/dashboard" passHref>
          <Button size="lg" className="w-full sm:w-auto">
            Kembali ke Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
