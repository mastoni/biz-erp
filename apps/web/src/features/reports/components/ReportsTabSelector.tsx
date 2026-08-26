'use client';

import React from 'react';
import {
  TrendingUp,
  BookOpen,
  Package,
  Truck,
  Coins,
  Zap,
} from 'lucide-react';
import type { ReportTab } from '../types';

export interface TabConfig {
  id: ReportTab;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}

export const REPORT_TABS: TabConfig[] = [
  {
    id: 'penjualan',
    label: 'Penjualan',
    desc: 'Omzet harian & struk terinci',
    icon: <TrendingUp className="h-4 w-4" />,
    color: '#17593e',
  },
  {
    id: 'labarugi',
    label: 'Laba Rugi',
    desc: 'Pendapatan, HPP & beban',
    icon: <BookOpen className="h-4 w-4" />,
    color: '#35657f',
  },
  {
    id: 'stok',
    label: 'Stok & Inventaris',
    desc: 'Valuasi stok per kategori',
    icon: <Package className="h-4 w-4" />,
    color: '#d3921f',
  },
  {
    id: 'pembelian',
    label: 'Pembelian',
    desc: 'Rekap PO ke supplier',
    icon: <Truck className="h-4 w-4" />,
    color: '#8a5f10',
  },
  {
    id: 'hutangpiutang',
    label: 'Hutang Piutang',
    desc: 'Kewajiban & tagihan berjalan',
    icon: <Coins className="h-4 w-4" />,
    color: '#bc4b2f',
  },
  {
    id: 'digital',
    label: 'Layanan Digital',
    desc: 'Volume & komisi PPOB',
    icon: <Zap className="h-4 w-4" />,
    color: '#6d3fa8',
  },
];

interface ReportsTabSelectorProps {
  activeTab: ReportTab;
  onTabChange: (tab: ReportTab) => void;
}

export function ReportsTabSelector({
  activeTab,
  onTabChange,
}: ReportsTabSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" data-testid="reports-tab-selector">
      {REPORT_TABS.map((r) => {
        const isActive = activeTab === r.id;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onTabChange(r.id)}
            data-testid={`report-tab-${r.id}`}
            className={`group flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
              isActive
                ? 'border-pine-deep bg-pine-deep shadow-md'
                : 'border-line bg-surface hover:border-pine/40 hover:bg-surface/80'
            }`}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
              style={{
                background: isActive ? 'rgba(255,255,255,0.14)' : `${r.color}16`,
                color: isActive ? '#f2d9a0' : r.color,
              }}
            >
              {r.icon}
            </span>
            <span>
              <span
                className={`block text-[12.5px] font-bold leading-tight ${
                  isActive ? 'text-[#f5f0df]' : 'text-ink'
                }`}
              >
                {r.label}
              </span>
              <span
                className={`block text-[10px] mt-0.5 ${
                  isActive ? 'text-[#f5f0df]/60' : 'text-fog'
                }`}
              >
                {r.desc}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
