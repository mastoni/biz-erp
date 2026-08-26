'use client';

import React from 'react';
import { Users } from 'lucide-react';
import type { CustomerViewModel } from '../types';
import { idrShort, num } from '../customer-helpers';

interface CustomersTableProps {
  customers: CustomerViewModel[];
  isLoading?: boolean;
}

export function CustomersTable({ customers, isLoading }: CustomersTableProps) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-line bg-paper/60 text-left">
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-fog">Pelanggan</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-fog">Telepon</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-fog">Tier</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-fog">Poin</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-fog">Total Belanja</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-fog">Kunjungan Terakhir</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-line/60">
                  <td colSpan={6} className="px-4 py-4">
                    <div className="h-5 w-full animate-pulse rounded bg-paper/70" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-line bg-paper/60 text-left">
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-fog">Pelanggan</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-fog">Telepon</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-fog">Tier</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-fog">Poin</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-fog">Total Belanja</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-fog">Kunjungan Terakhir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {customers.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-paper/60">
                {/* 1. Pelanggan */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-[12px] font-bold ${
                        c.tier === 'Gold'
                          ? 'bg-[#fae4af] text-[#17593e]'
                          : c.tier === 'Silver'
                          ? 'bg-[#d2e6ec] text-[#35657f]'
                          : 'bg-ink/8 text-fog'
                      }`}
                    >
                      {c.initials}
                    </span>
                    <div>
                      <p className="font-semibold leading-tight text-ink">{c.name}</p>
                      <p className="num text-[10.5px] text-fog">{c.code}</p>
                    </div>
                  </div>
                </td>

                {/* 2. Telepon */}
                <td className="px-4 py-3.5 num text-[12.5px] text-fog">{c.phone}</td>

                {/* 3. Tier */}
                <td className="px-4 py-3.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
                      c.tier === 'Gold'
                        ? 'bg-[#fae4af]/70 text-[#8a5f10] border border-[#fae4af]'
                        : c.tier === 'Silver'
                        ? 'bg-[#d2e6ec]/70 text-[#35657f] border border-[#d2e6ec]'
                        : 'bg-ink/5 text-fog border border-line'
                    }`}
                  >
                    {c.tier}
                  </span>
                </td>

                {/* 4. Poin */}
                <td className="px-4 py-3.5 num text-right font-semibold text-ink">{num(c.points)}</td>

                {/* 5. Total Belanja */}
                <td className="px-4 py-3.5 num text-right font-bold text-pine">{idrShort(c.spend_minor)}</td>

                {/* 6. Kunjungan Terakhir */}
                <td className="px-4 py-3.5 text-[12.5px] text-fog">{c.last_visit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {customers.length === 0 && (
        <div className="px-5 py-12 text-center">
          <Users width={24} height={24} className="mx-auto mb-2 text-fog/60" />
          <p className="text-sm font-semibold text-ink">Tidak ada pelanggan ditemukan</p>
          <p className="mt-1 text-xs text-fog">Coba kata kunci lain atau daftarkan member baru.</p>
        </div>
      )}
    </div>
  );
}
