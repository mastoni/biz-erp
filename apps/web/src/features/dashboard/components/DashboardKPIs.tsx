import * as React from 'react';
import { KPICard } from '@/components/ui/kpi-card';
import { formatMinor } from '@/lib/format';
import { DollarSign, ShoppingCart, Package, AlertTriangle } from 'lucide-react';
import type { DashboardKpi, StockAlertSummary } from '../types';

export interface DashboardKPIsProps {
  kpis: DashboardKpi;
  stockAlerts: StockAlertSummary;
}

export function DashboardKPIs({ kpis, stockAlerts }: DashboardKPIsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Penjualan Hari Ini */}
      <KPICard
        title="Penjualan Hari Ini"
        value={formatMinor(kpis.total_revenue_minor)}
        subtitle={`${kpis.total_sales.toLocaleString('id-ID')} transaksi`}
        icon={<DollarSign className="h-4 w-4" />}
        tone="pine"
      />

      {/* 2. Total Transaksi */}
      <KPICard
        title="Total Transaksi"
        value={kpis.total_sales.toLocaleString('id-ID')}
        subtitle={
          kpis.total_sales > 0
            ? `Rata-rata ${formatMinor(kpis.average_order_value_minor)}`
            : 'Belum ada transaksi'
        }
        icon={<ShoppingCart className="h-4 w-4" />}
        tone="ocean"
      />

      {/* 3. Produk Aktif (Tenant Scoped) */}
      <KPICard
        title="Produk Aktif"
        value={kpis.total_products.toLocaleString('id-ID')}
        subtitle={
          kpis.total_customers > 0
            ? `${kpis.total_customers.toLocaleString('id-ID')} pelanggan terdaftar`
            : 'Katalog tenant'
        }
        icon={<Package className="h-4 w-4" />}
        tone="neutral"
      />

      {/* 4. Stok Habis / Peringatan (Branch Scoped) */}
      <KPICard
        title="Stok Habis"
        value={stockAlerts.out_of_stock_count.toLocaleString('id-ID')}
        subtitle={
          stockAlerts.out_of_stock_count > 0
            ? 'Produk perlu restock'
            : 'Semua stok aman'
        }
        icon={<AlertTriangle className="h-4 w-4" />}
        tone={stockAlerts.out_of_stock_count > 0 ? 'clay' : 'pine'}
      />
    </div>
  );
}
