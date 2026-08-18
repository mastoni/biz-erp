'use client';

import React from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';

export default function DashboardPage() {
  const { user, business, role } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Dashboard</h2>
        <p className="text-zinc-600 mt-1">
          Selamat datang kembali, <span className="font-medium text-zinc-900">{user?.email}</span> di <span className="font-medium text-zinc-900">{business?.name}</span>.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* We cannot show real metrics because backend endpoints don't exist yet */}
        <Card className="bg-zinc-50 border-dashed border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Total Penjualan Hari Ini</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-300">Rp --</div>
            <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
              <Info className="h-3 w-3" /> BLOCKED / FUTURE PHASE
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-50 border-dashed border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Jumlah Transaksi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-300">--</div>
            <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
              <Info className="h-3 w-3" /> BLOCKED / FUTURE PHASE
            </p>
          </CardContent>
        </Card>

        {role === 'OWNER' && (
          <Card className="bg-zinc-50 border-dashed border-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">Total Produk Aktif</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-zinc-300">--</div>
              <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                <Info className="h-3 w-3" /> BLOCKED / FUTURE PHASE
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="rounded-md bg-blue-50 p-4 border border-blue-200 mt-8">
        <div className="flex">
          <div className="flex-shrink-0">
            <Info className="h-5 w-5 text-blue-400" aria-hidden="true" />
          </div>
          <div className="ml-3 flex-1 md:flex md:justify-between">
            <p className="text-sm text-blue-700">
              <strong>Info:</strong> Fitur analitik dashboard belum tersedia. Saat ini Web ERP terintegrasi menggunakan infrastruktur *One Backend* (Sinkronisasi Mobile). Modul analitik khusus dashboard akan dikerjakan pada **FUTURE PHASE** setelah tersedia endpoint/API dari backend.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
