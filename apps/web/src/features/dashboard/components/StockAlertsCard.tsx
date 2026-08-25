import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, ArrowRight, Package } from 'lucide-react';
import Link from 'next/link';
import type { StockAlertSummary } from '../types';

export interface StockAlertsCardProps {
  stockAlerts: StockAlertSummary;
}

export function StockAlertsCard({ stockAlerts }: StockAlertsCardProps) {
  const isAlert = stockAlerts.out_of_stock_count > 0;

  return (
    <Card className={`border shadow-[0_1px_3px_rgba(26,29,26,0.04)] ${isAlert ? 'border-clay/40 bg-clay-soft/15' : 'border-line bg-card'}`}>
      <CardHeader className="pb-3 border-b border-line/60">
        <CardTitle className="text-sm font-bold font-heading text-ink flex items-center gap-2">
          <div className={`h-6 w-6 rounded-md flex items-center justify-center border ${isAlert ? 'bg-clay-soft text-clay border-clay/30' : 'bg-pine-soft text-pine border-pine/20'}`}>
            {isAlert ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          </div>
          <span>Status Inventori Cabang</span>
        </CardTitle>
        <p className="text-xs text-fog">Peringatan ketersediaan stok produk</p>
      </CardHeader>

      <CardContent className="pt-4 space-y-3.5">
        <div className="flex items-center justify-between p-3 rounded-lg bg-surface-soft/60 border border-line/60">
          <div className="flex items-center gap-2.5">
            <Package className="h-4 w-4 text-fog" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-ink">Stok Habis (0 unit)</span>
              <span className="text-[11px] text-fog">
                {isAlert ? 'Segera lakukan restock inventori' : 'Semua produk aman'}
              </span>
            </div>
          </div>
          <span className={`num text-xl font-extrabold px-2.5 py-0.5 rounded-md ${isAlert ? 'bg-clay-soft text-clay' : 'bg-pine-soft text-pine'}`}>
            {stockAlerts.out_of_stock_count.toLocaleString('id-ID')}
          </span>
        </div>

        <div className="pt-1">
          <Link
            href="/inventory"
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-surface hover:bg-surface-soft border border-line text-xs font-semibold text-pine transition-colors group shadow-xs"
          >
            <span>Buka Manajemen Inventori</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
