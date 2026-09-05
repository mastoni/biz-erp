'use client';

import React, { useState, useMemo } from 'react';
import type { AccountDto, AccountType } from '../types';
import {
  BookOpen,
  Search,
  Filter,
  CheckCircle2,
  RefreshCw,
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Boxes,
  FileSpreadsheet,
} from 'lucide-react';
import Link from 'next/link';

export interface ChartOfAccountsViewProps {
  accounts: AccountDto[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export interface AccountCategoryGroup {
  id: string;
  name: string;
  description: string;
  normalBalance: 'Debit' | 'Kredit';
  icon: React.ComponentType<{ className?: string }>;
  types: AccountType[];
  color: string;
}

export const ACCOUNT_GROUPS: AccountCategoryGroup[] = [
  {
    id: 'kas-bank',
    name: 'Kas & Setara Kas',
    description: 'Kas operasional toko, rekening bank, dan dompet digital',
    normalBalance: 'Debit',
    icon: Landmark,
    types: ['cash', 'bank', 'mobile'],
    color: 'emerald',
  },
  {
    id: 'piutang-stok',
    name: 'Piutang & Persediaan',
    description: 'Piutang usaha pelanggan dan valuasi persediaan barang',
    normalBalance: 'Debit',
    icon: Boxes,
    types: ['receivable', 'inventory'],
    color: 'blue',
  },
  {
    id: 'kewajiban',
    name: 'Kewajiban & Hutang Usaha',
    description: 'Hutang pembelian ke supplier dan komitmen jatuh tempo',
    normalBalance: 'Kredit',
    icon: ArrowDownRight,
    types: ['payable'],
    color: 'amber',
  },
  {
    id: 'pendapatan',
    name: 'Pendapatan Usaha',
    description: 'Pendapatan penjualan produk, jasa, dan pendapatan lain',
    normalBalance: 'Kredit',
    icon: ArrowUpRight,
    types: ['revenue', 'income'],
    color: 'purple',
  },
  {
    id: 'beban',
    name: 'Beban Pokok & Operasional',
    description: 'Harga pokok penjualan (HPP) dan beban operasional toko',
    normalBalance: 'Debit',
    icon: TrendingUp,
    types: ['cogs', 'expense'],
    color: 'rose',
  },
];

export function getNormalBalance(type: AccountType): 'Debit' | 'Kredit' {
  switch (type) {
    case 'cash':
    case 'bank':
    case 'mobile':
    case 'receivable':
    case 'inventory':
    case 'cogs':
    case 'expense':
      return 'Debit';
    case 'payable':
    case 'revenue':
    case 'income':
      return 'Kredit';
    default:
      return 'Debit';
  }
}

export function ChartOfAccountsView({
  accounts,
  isLoading,
  error,
  onRefresh,
}: ChartOfAccountsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const matchQuery =
        acc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.type.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchQuery) return false;

      if (selectedGroup === 'all') return true;

      const groupConfig = ACCOUNT_GROUPS.find((g) => g.id === selectedGroup);
      if (!groupConfig) return true;

      return groupConfig.types.includes(acc.type);
    });
  }, [accounts, searchQuery, selectedGroup]);

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pine/10 text-pine">
              <BookOpen className="h-4 w-4" />
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Bagan Akun (Chart of Accounts)
            </h1>
          </div>
          <p className="text-xs text-fog mt-0.5">
            Daftar akun perkiraan standar akuntansi untuk pencatatan transaksi buku besar.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/finance/reports"
            className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink shadow-2xs hover:bg-paper cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-fog" />
            <span>Laporan Keuangan</span>
          </Link>

          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink shadow-2xs hover:bg-paper cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-fog ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <div className="h-14 animate-pulse rounded-2xl border border-line bg-surface p-4" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-2xl border border-line bg-surface p-4"
              />
            ))}
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && !isLoading && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-sm font-bold text-rose-800">Gagal Memuat Bagan Akun (COA)</p>
          <p className="text-xs text-rose-600 mt-1">{error}</p>
          <button
            type="button"
            onClick={onRefresh}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-rose-700 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Coba Lagi</span>
          </button>
        </div>
      )}

      {!isLoading && !error && (
        <>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fog" />
          <input
            type="text"
            placeholder="Cari kode atau nama akun..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-line bg-paper pl-9 pr-3.5 py-2 text-xs font-medium text-ink focus:border-pine focus:outline-none"
          />
        </div>

        {/* Group Selector */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-fog mr-1 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" />
            Kategori:
          </span>
          <button
            type="button"
            onClick={() => setSelectedGroup('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
              selectedGroup === 'all'
                ? 'bg-pine text-white shadow-2xs'
                : 'bg-paper text-ink hover:bg-line/40'
            }`}
          >
            Semua ({accounts.length})
          </button>
          {ACCOUNT_GROUPS.map((group) => {
            const count = accounts.filter((a) => group.types.includes(a.type)).length;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelectedGroup(group.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  selectedGroup === group.id
                    ? 'bg-pine text-white shadow-2xs'
                    : 'bg-paper text-ink hover:bg-line/40'
                }`}
              >
                {group.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Account Groups Table View */}
      {filteredAccounts.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-12 text-center text-fog">
          <BookOpen className="h-10 w-10 mx-auto text-fog/50 mb-2" />
          <p className="text-sm font-semibold text-ink">Tidak ada akun yang sesuai kriteria.</p>
          <p className="text-xs text-fog mt-0.5">Coba ubah kata kunci pencarian atau filter kategori.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-surface shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-paper/60 text-[11px] font-bold uppercase text-fog">
                <tr>
                  <th className="py-3 px-4">Kode Akun</th>
                  <th className="py-3 px-4">Nama Akun</th>
                  <th className="py-3 px-4">Klasifikasi Tipe</th>
                  <th className="py-3 px-4 text-center">Saldo Normal</th>
                  <th className="py-3 px-4 text-center">Mata Uang</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {filteredAccounts.map((acc) => {
                  const normalBal = getNormalBalance(acc.type);
                  return (
                    <tr key={acc.id} className="hover:bg-paper/30 transition">
                      <td className="py-3 px-4 font-bold text-ink whitespace-nowrap font-mono text-xs">
                        {acc.code}
                      </td>
                      <td className="py-3 px-4 font-semibold text-ink">
                        {acc.name}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase bg-paper border border-line text-fog">
                          {acc.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                            normalBal === 'Debit'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {normalBal}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-fog">
                        {acc.currency || 'IDR'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Aktif
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
