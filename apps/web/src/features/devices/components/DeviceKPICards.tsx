import React from 'react';
import { HardDrive, CheckCircle2, UserCheck, AlertTriangle, Archive } from 'lucide-react';
import { DeviceSummaryDto } from '../types';

interface DeviceKPICardsProps {
  summary?: DeviceSummaryDto;
  isLoading?: boolean;
}

export function DeviceKPICards({ summary, isLoading }: DeviceKPICardsProps) {
  const cards = [
    {
      title: 'Total Perangkat',
      value: summary?.total ?? 0,
      icon: HardDrive,
      color: 'text-pine dark:text-emerald-400',
      bg: 'bg-pine/10 dark:bg-emerald-950/30',
      description: 'Seluruh serial teregistrasi',
    },
    {
      title: 'Tersedia di Gudang',
      value: (summary?.in_stock ?? 0) + (summary?.reserved ?? 0),
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      description: `${summary?.in_stock ?? 0} ready, ${summary?.reserved ?? 0} reserved`,
    },
    {
      title: 'Terpasang di Pelanggan',
      value: summary?.installed ?? 0,
      icon: UserCheck,
      color: 'text-teal-600 dark:text-teal-400',
      bg: 'bg-teal-50 dark:bg-teal-950/30',
      description: 'Aktif di lapangan',
    },
    {
      title: 'Rusak / Dalam Servis',
      value: (summary?.defective ?? 0) + (summary?.in_repair ?? 0),
      icon: AlertTriangle,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      description: `${summary?.defective ?? 0} rusak, ${summary?.in_repair ?? 0} perbaikan`,
    },
    {
      title: 'Nonaktif / Dikembalikan',
      value: (summary?.decommissioned ?? 0) + (summary?.returned ?? 0),
      icon: Archive,
      color: 'text-slate-600 dark:text-slate-400',
      bg: 'bg-slate-100 dark:bg-slate-900/40',
      description: `${summary?.returned ?? 0} kembali, ${summary?.decommissioned ?? 0} retired`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm transition-all hover:border-ink/20 dark:border-ink/20"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink/70 dark:text-ink/60">{card.title}</span>
              <div className={`rounded-lg p-2 ${card.bg}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <div className="mt-2">
              {isLoading ? (
                <div className="h-7 w-16 animate-pulse rounded bg-ink/10" />
              ) : (
                <div className="font-display text-2xl font-bold tracking-tight text-ink">
                  {card.value.toLocaleString('id-ID')}
                </div>
              )}
              <p className="mt-0.5 text-[11px] text-ink/50 dark:text-ink/40">{card.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
