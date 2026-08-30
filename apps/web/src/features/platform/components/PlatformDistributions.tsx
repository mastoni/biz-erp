'use client';

import React from 'react';
import type { PlanDistributionItem, SubscriptionStatusDistributionItem } from '../types';

interface PlatformDistributionsProps {
  planDistribution: PlanDistributionItem[];
  statusDistribution: SubscriptionStatusDistributionItem[];
  loading?: boolean;
}

export function PlatformDistributions({
  planDistribution,
  statusDistribution,
  loading,
}: PlatformDistributionsProps) {
  const totalPlansCount = planDistribution.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Plan Distribution */}
      <div className="rounded-2xl border border-line bg-card p-6 shadow-2xs">
        <h3 className="text-base font-bold text-ink">Distribusi Paket Langganan</h3>
        <p className="text-xs text-fog mt-0.5">Sebaran paket aktif yang digunakan oleh tenant</p>

        {loading ? (
          <div className="mt-6 space-y-4">
            <div className="h-4 w-full animate-pulse rounded bg-paper" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-paper" />
          </div>
        ) : planDistribution.length === 0 ? (
          <p className="mt-8 text-center text-xs text-fog py-6">Belum ada data langganan paket terdaftar.</p>
        ) : (
          <div className="mt-5 space-y-3.5">
            {planDistribution.map((item) => {
              const percent = totalPlansCount > 0 ? Math.round((item.count / totalPlansCount) * 100) : 0;
              return (
                <div key={item.plan_code} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-ink">{item.plan_name}</span>
                    <span className="num text-fog">{item.count} tenant ({percent}%)</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-paper">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Status Distribution */}
      <div className="rounded-2xl border border-line bg-card p-6 shadow-2xs">
        <h3 className="text-base font-bold text-ink">Status Operasional Tenant</h3>
        <p className="text-xs text-fog mt-0.5">Kondisi akses dan status berlangganan bisnis</p>

        {loading ? (
          <div className="mt-6 space-y-4">
            <div className="h-4 w-full animate-pulse rounded bg-paper" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-paper" />
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {statusDistribution.map((st) => (
              <div
                key={st.status}
                className="rounded-xl border border-line bg-surface p-3.5 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-fog">{st.label}</span>
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      st.tone === 'pine'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : st.tone === 'tide'
                        ? 'bg-sky-50 text-sky-800 border border-sky-200'
                        : st.tone === 'clay'
                        ? 'bg-rose-50 text-rose-800 border border-rose-200'
                        : 'bg-paper text-fog border border-line'
                    }`}
                  >
                    {st.count}
                  </span>
                </div>
                <p className="num text-xl font-bold text-ink">{st.count}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
