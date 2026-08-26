'use client';

import React, { useState, useEffect } from 'react';
import { idrShort } from '../reports-helpers';
import type { CashFlowPoint, SalesCompositionItem } from '../types';

/* =============================================================================
   Cash Flow Pair Bars Chart
   ============================================================================= */

interface CashFlowChartProps {
  points: CashFlowPoint[];
}

export function CashFlowChart({ points }: CashFlowChartProps) {
  const [on, setOn] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setOn(true), 80);
    return () => clearTimeout(t);
  }, []);

  const maxVal = Math.max(
    1,
    ...points.map((d) => Math.max(d.inflow_minor, d.outflow_minor ?? 0))
  );

  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-sm" data-testid="cash-flow-chart">
      <h3 className="font-display text-[16px] font-bold text-ink">Arus Kas Bulanan</h3>
      <p className="mb-4 text-[11.5px] text-fog">Berdasarkan ringkasan penjualan harian · masuk vs keluar</p>

      {points.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-xs text-fog">
          Belum ada data transaksi harian.
        </div>
      ) : (
        <div className="flex h-48 items-end gap-1.5 sm:gap-2.5 overflow-x-auto pb-2">
          {points.map((d, i) => {
            const hasOutflow = d.outflow_minor !== null;
            return (
              <div
                key={d.date}
                className="group relative flex flex-1 min-w-[20px] flex-col items-center gap-1.5 cursor-pointer"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {hover === i && (
                  <div className="absolute -top-1 z-20 -translate-y-full rounded-lg bg-pine-deep px-3 py-2 text-[#f2efe2] shadow-lg whitespace-nowrap">
                    <div className="text-[10px] uppercase tracking-wider opacity-70">{d.label} ({d.date})</div>
                    <div className="num text-xs font-semibold">Masuk: {idrShort(d.inflow_minor)}</div>
                    {hasOutflow && <div className="num text-xs">Keluar: {idrShort(d.outflow_minor)}</div>}
                  </div>
                )}
                <div className="flex h-40 w-full items-end justify-center gap-1">
                  <div
                    className="w-full max-w-[14px] rounded-t-[4px] bg-pine transition-all duration-500"
                    style={{
                      height: on ? `${Math.max((d.inflow_minor / maxVal) * 100, 2)}%` : '0%',
                    }}
                  />
                  {hasOutflow && (
                    <div
                      className="w-full max-w-[14px] rounded-t-[4px] bg-honey/85 transition-all duration-500"
                      style={{
                        height: on ? `${Math.max(((d.outflow_minor ?? 0) / maxVal) * 100, 2)}%` : '0%',
                      }}
                    />
                  )}
                </div>
                <span className="num text-[10px] text-fog truncate w-full text-center">{d.label}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex gap-4 text-[11.5px] font-semibold text-fog">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-pine" /> Kas Masuk
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-honey/85" /> Kas Keluar (Beban)
        </span>
      </div>
    </div>
  );
}

/* =============================================================================
   Sales Composition Donut Chart
   ============================================================================= */

interface SalesCompositionChartProps {
  items: SalesCompositionItem[];
}

export function SalesCompositionChart({ items }: SalesCompositionChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const total = items.reduce((s, i) => s + i.quantity, 0);

  let acc = 0;

  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-sm" data-testid="sales-composition-chart">
      <h3 className="font-display text-[16px] font-bold text-ink">Komposisi Penjualan</h3>
      <p className="mb-4 text-[11.5px] text-fog">Berdasarkan unit terjual per kategori produk</p>

      {items.length === 0 ? (
        <div className="flex h-36 items-center justify-center text-xs text-fog">
          Belum ada data penjualan produk.
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative h-36 w-36 shrink-0">
            <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
              <circle cx="21" cy="21" r="15.915" fill="none" stroke="#e8e6d9" strokeWidth="4.5" />
              {items.map((it, i) => {
                const v = total > 0 ? (it.quantity / total) * 100 : 0;
                const strokeDash = Math.max(v - 1.5, 0.5);
                const el = (
                  <circle
                    key={it.category}
                    cx="21"
                    cy="21"
                    r="15.915"
                    fill="none"
                    stroke={it.color || '#68746c'}
                    strokeWidth={active === i ? 6 : 4.5}
                    strokeDasharray={`${strokeDash} ${100 - strokeDash}`}
                    strokeDashoffset={-acc - 0.75}
                    strokeLinecap="round"
                    opacity={active === null || active === i ? 1 : 0.3}
                    style={{ transition: 'all 0.25s ease' }}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    className="cursor-pointer"
                  />
                );
                acc += v;
                return el;
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] uppercase tracking-wider text-fog">
                {active !== null ? items[active].category : 'Kategori'}
              </span>
              <span className="num text-lg font-bold text-ink">
                {active !== null ? `${items[active].percentage}%` : `${items.length}`}
              </span>
            </div>
          </div>

          <ul className="min-w-0 flex-1 space-y-2 w-full">
            {items.map((it, i) => (
              <li
                key={it.category}
                className="flex items-center gap-2 text-sm cursor-pointer transition-opacity"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                style={{ opacity: active === null || active === i ? 1 : 0.4 }}
              >
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: it.color || '#68746c' }} />
                <span className="truncate text-ink/85 font-medium">{it.category}</span>
                <span className="num ml-auto font-semibold text-ink">{it.percentage}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
