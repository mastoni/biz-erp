'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { idrShort } from '../sales-helpers';
import type { SalesRangeFilter, SalesTrendPointViewModel } from '../types';

interface RevenueTrendChartProps {
  points: SalesTrendPointViewModel[];
  range: SalesRangeFilter;
  onRangeChange: (r: SalesRangeFilter) => void;
  isLoading: boolean;
  color?: string;
}

export function RevenueTrendChart({
  points,
  range,
  onRangeChange,
  isLoading,
  color = '#17593e',
}: RevenueTrendChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const rawId = useId();
  const gid = rawId.replace(/:/g, '');

  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 60);
    return () => clearTimeout(t);
  }, []);

  if (isLoading) {
    return (
      <div className="card h-full p-5 border border-line bg-card rounded-lg" data-testid="revenue-trend-loading">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <Skeleton className="h-5 w-28 rounded" />
            <Skeleton className="mt-1 h-3 w-40 rounded" />
          </div>
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        <Skeleton className="h-56 w-full rounded" />
      </div>
    );
  }

  const data = points.length > 0 ? points : [{ date: '2026-08-26', label: 'Hari ini', total_revenue_minor: 0, transaction_count: 0 }];
  const totalOmzetMinor = data.reduce((sum, p) => sum + p.total_revenue_minor, 0);

  const n = data.length;
  const maxValue = Math.max(...data.map((d) => d.total_revenue_minor), 100000);
  const max = maxValue * 1.12;
  const X = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 50);
  const Y = (v: number) => 100 - (v / max) * 100;

  let pathD = "M " + X(0) + " " + Y(data[0].total_revenue_minor);
  for (let i = 1; i < n; i++) {
    const dx = (X(i) - X(i - 1)) / 2;
    pathD += " C " + (X(i - 1) + dx) + " " + Y(data[i - 1].total_revenue_minor) + ", " + (X(i) - dx) + " " + Y(data[i].total_revenue_minor) + ", " + X(i) + " " + Y(data[i].total_revenue_minor);
  }
  const areaD = pathD + " L 100 100 L 0 100 Z";

  const onMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || n <= 1) return;
    const idx = Math.round(((e.clientX - rect.left) / rect.width) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, idx)));
  };

  const hv = hover !== null && hover < data.length ? data[hover] : null;
  const labelEvery = n > 10 ? 5 : 1;

  return (
    <div className="card h-full p-5 border border-line bg-card rounded-lg" data-testid="revenue-trend-chart">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-[16px] font-bold text-ink">Tren Omzet</h3>
          <p className="text-[11.5px] text-fog mt-0.5" data-testid="trend-summary-label">
            Total {range === '7d' ? '7 hari' : '30 hari'} · {idrShort(totalOmzetMinor)}
          </p>
        </div>
        <div className="flex rounded-lg border border-line bg-surface p-0.5">
          {(['7d', '30d'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRangeChange(r)}
              data-testid={"range-btn-" + r}
              className={"rounded-md px-3 py-1.5 text-xs font-bold transition-all cursor-pointer " + (range === r ? 'bg-pine text-[#f2efe2] shadow-sm' : 'text-fog hover:text-ink')}
            >
              {r === '7d' ? '7 Hari' : '30 Hari'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2">
        <div
          ref={ref}
          className="relative h-56 cursor-crosshair"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* grid lines + Y-axis labels */}
          {[0.25, 0.5, 0.75].map((g) => (
            <div
              key={g}
              className="absolute left-0 right-0 border-t border-dashed border-line"
              style={{ top: (g * 100) + "%" }}
            >
              <span className="num absolute -top-2.5 right-0 text-[10px] text-fog/80 bg-surface/70 px-1 rounded">
                {idrShort(Math.round(max * (1 - g)))}
              </span>
            </div>
          ))}

          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
          >
            <defs>
              <linearGradient id={"ag-" + gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={color} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path
              d={areaD}
              fill={"url(#ag-" + gid + ")"}
              style={{ opacity: drawn ? 1 : 0, transition: 'opacity 1s ease 0.3s' }}
            />
            <path
              d={pathD}
              fill="none"
              stroke={color}
              strokeWidth="2.4"
              vectorEffect="non-scaling-stroke"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={drawn ? 0 : 1}
              style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
            />
          </svg>

          {hv && hover !== null && (
            <>
              <div
                className="absolute top-0 bottom-0 w-px bg-pine/35 pointer-events-none"
                style={{ left: X(hover) + "%" }}
              />
              <div
                className="absolute h-3 w-3 rounded-full bg-pine border-[2.5px] border-surface shadow pointer-events-none"
                style={{
                  left: X(hover) + "%",
                  top: Y(hv.total_revenue_minor) + "%",
                  transform: 'translate(-50%,-50%)',
                }}
              />
              <div
                className="absolute z-10 pointer-events-none rounded-lg bg-pine-deep text-[#f2efe2] px-3 py-2 shadow-lg"
                style={{
                  left: Math.max(8, Math.min(92, X(hover))) + "%",
                  top: Math.max(6, Y(hv.total_revenue_minor) - 8) + "%",
                  transform: 'translate(-50%,-100%)',
                }}
              >
                <div className="text-[10px] uppercase tracking-wider opacity-70">{hv.label}</div>
                <div className="num text-sm font-semibold">{idrShort(hv.total_revenue_minor)}</div>
              </div>
            </>
          )}
        </div>

        <div className="mt-2 flex justify-between">
          {data.map((pt, i) => (
            <span
              key={i}
              className={"num text-[10px] " + (i % labelEvery === 0 ? 'text-fog' : 'text-transparent select-none')}
            >
              {pt.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
