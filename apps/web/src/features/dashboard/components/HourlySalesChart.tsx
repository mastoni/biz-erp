import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatMinor } from '@/lib/format';
import { BarChart3, Clock, TrendingUp } from 'lucide-react';
import type { HourlySalesBucket } from '../types';

export interface HourlySalesChartProps {
  hourlySales: HourlySalesBucket[];
}

export function HourlySalesChart({ hourlySales }: HourlySalesChartProps) {
  const maxRevenue = React.useMemo(() => {
    const values = hourlySales.map((b) => b.total_revenue_minor);
    return Math.max(...values, 100000); // baseline minimum scale
  }, [hourlySales]);

  const totalDayRevenue = React.useMemo(() => {
    return hourlySales.reduce((acc, b) => acc + b.total_revenue_minor, 0);
  }, [hourlySales]);

  const activeHoursCount = React.useMemo(() => {
    return hourlySales.filter((b) => b.total_revenue_minor > 0).length;
  }, [hourlySales]);

  return (
    <Card className="border border-line bg-card shadow-[0_1px_3px_rgba(26,29,26,0.04)]">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-line/60">
        <div className="space-y-0.5">
          <CardTitle className="text-sm font-bold font-heading text-ink flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-pine-soft border border-pine/20 flex items-center justify-center text-pine">
              <BarChart3 className="h-3.5 w-3.5" />
            </div>
            <span>Distribusi Penjualan Per Jam</span>
          </CardTitle>
          <p className="text-xs text-fog flex items-center gap-1">
            <Clock className="h-3 w-3" />
            24 jam operasional hari ini · {activeHoursCount} jam aktif
          </p>
        </div>
        <div className="text-right bg-surface-soft px-3 py-1.5 rounded-lg border border-line/80">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-fog block">Total Terakumulasi</span>
          <p className="num text-base font-extrabold text-pine">{formatMinor(totalDayRevenue)}</p>
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        <div className="h-48 sm:h-52 w-full flex flex-col justify-between">
          {/* Chart Bars Area with Grid Lines */}
          <div className="relative flex-1 flex items-end justify-between gap-1 w-full px-1">
            {/* Horizontal Guide Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
              <div className="border-b border-dashed border-line w-full" />
              <div className="border-b border-dashed border-line w-full" />
              <div className="border-b border-dashed border-line w-full" />
            </div>

            {/* 24-Hour Histogram Bars */}
            {hourlySales.map((bucket) => {
              const heightPct = (bucket.total_revenue_minor / maxRevenue) * 100;
              const hasSales = bucket.total_revenue_minor > 0;

              return (
                <div
                  key={bucket.hour}
                  className="group relative flex-1 flex flex-col items-center justify-end h-full z-10"
                >
                  {/* Interactive Floating Tooltip */}
                  <div className="pointer-events-none absolute -top-12 z-30 hidden rounded-md bg-[#1a1d1a] border border-[#f0efe7]/15 px-2.5 py-1 text-[11px] text-[#f0efe7] shadow-lg group-hover:flex flex-col items-center whitespace-nowrap">
                    <span className="font-bold text-[10px] text-[#d3921f] uppercase tracking-wider">
                      Pukul {String(bucket.hour).padStart(2, '0')}:00
                    </span>
                    <span className="num font-bold text-xs">{formatMinor(bucket.total_revenue_minor)}</span>
                    <span className="text-[9px] text-[#f0efe7]/70 font-sans">{bucket.transaction_count} transaksi</span>
                  </div>

                  {/* Hourly Bar */}
                  <div
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                    className={`w-full rounded-t transition-all duration-200 ${
                      hasSales
                        ? 'bg-pine group-hover:bg-[#124530] group-hover:scale-y-105 origin-bottom shadow-xs'
                        : 'bg-line/50 group-hover:bg-line'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* X-Axis Hour Labels */}
          <div className="flex justify-between border-t border-line/80 pt-2 px-1 text-[10px] text-fog font-mono font-medium">
            <span>00:00</span>
            <span>04:00</span>
            <span>08:00</span>
            <span>12:00</span>
            <span>16:00</span>
            <span>20:00</span>
            <span>23:00</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
