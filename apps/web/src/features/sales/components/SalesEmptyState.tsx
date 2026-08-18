'use client';

import React from 'react';
import { ShoppingCart } from 'lucide-react';

export function SalesEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="rounded-full bg-zinc-100 p-5 mb-5">
        <ShoppingCart className="h-12 w-12 text-zinc-400" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-zinc-900 mb-1">
        Belum ada transaksi penjualan
      </h3>
      <p className="text-sm text-zinc-500 max-w-sm leading-relaxed">
        Transaksi yang dilakukan melalui aplikasi kasir akan muncul di sini
        setelah disinkronisasi.
      </p>
    </div>
  );
}
