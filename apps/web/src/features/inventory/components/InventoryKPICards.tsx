import { KPICard } from '@/components/ui/kpi-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, AlertTriangle, PackageX, Boxes } from 'lucide-react';
import type { InventorySummaryViewModel } from '../types';

interface InventoryKPICardsProps {
  summary: InventorySummaryViewModel | null;
  isLoading: boolean;
}

export function InventoryKPICards({ summary, isLoading }: InventoryKPICardsProps) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4 sm:p-5 border border-line bg-card">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="mt-2.5 h-7 w-16 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KPICard
        title="Total Nilai Stok"
        value={summary.total_stock_value_minor.toLocaleString('id-ID')}
        subtitle="minor"
        icon={<Wallet className="h-4 w-4" />}
        tone="pine"
      />
      <KPICard
        title="Stok Menipis"
        value={summary.low_stock_count.toLocaleString('id-ID')}
        subtitle={`≤ 5 unit`}
        icon={<AlertTriangle className="h-4 w-4" />}
        tone="honey"
      />
      <KPICard
        title="Stok Habis"
        value={summary.out_of_stock_count.toLocaleString('id-ID')}
        subtitle="perlu restock"
        icon={<PackageX className="h-4 w-4" />}
        tone="clay"
      />
      <KPICard
        title="Total SKU"
        value={summary.total_skus.toLocaleString('id-ID')}
        subtitle="cabang aktif"
        icon={<Boxes className="h-4 w-4" />}
        tone="neutral"
      />
    </div>
  );
}
