import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { formatMinor } from '@/lib/format';
import { Award, Package } from 'lucide-react';
import type { TopProductItem } from '../types';

export interface TopProductsCardProps {
  topProducts: TopProductItem[];
}

function getRankBadge(index: number) {
  if (index === 0) {
    return 'bg-[#d3921f]/15 text-[#d3921f] border border-[#d3921f]/30';
  }
  if (index === 1) {
    return 'bg-ocean-soft text-ocean border border-ocean/25';
  }
  if (index === 2) {
    return 'bg-clay-soft text-clay border border-clay/25';
  }
  return 'bg-surface-soft text-fog border border-line';
}

export function TopProductsCard({ topProducts }: TopProductsCardProps) {
  return (
    <Card className="border border-line bg-card shadow-[0_1px_3px_rgba(26,29,26,0.04)]">
      <CardHeader className="pb-3 border-b border-line/60">
        <CardTitle className="text-sm font-bold font-heading text-ink flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-honey-soft border border-honey/20 flex items-center justify-center text-honey">
            <Award className="h-3.5 w-3.5" />
          </div>
          <span>Produk Terlaris</span>
        </CardTitle>
        <p className="text-xs text-fog">Peringkat produk terlaris hari ini</p>
      </CardHeader>

      <CardContent className="pt-3 px-3 sm:px-4">
        {topProducts.length === 0 ? (
          <div className="py-12 text-center text-xs text-fog flex flex-col items-center gap-2">
            <Package className="h-6 w-6 text-fog/40" />
            <span>Belum ada penjualan produk hari ini</span>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-line/80">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-soft/80 text-[11px] hover:bg-surface-soft/80">
                  <TableHead className="w-10 text-center font-bold text-fog">#</TableHead>
                  <TableHead className="font-bold text-fog">Produk</TableHead>
                  <TableHead className="text-right font-bold text-fog">Terjual</TableHead>
                  <TableHead className="text-right font-bold text-fog">Pendapatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((product, index) => (
                  <TableRow key={product.product_id || index} className="text-xs hover:bg-surface-soft/50 transition-colors">
                    <TableCell className="text-center py-2.5">
                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${getRankBadge(index)}`}>
                        {index + 1}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-ink py-2.5">
                      <span className="truncate block max-w-[180px] sm:max-w-none">{product.product_name}</span>
                    </TableCell>
                    <TableCell className="text-right num font-bold text-ink py-2.5">
                      <span className="px-2 py-0.5 rounded bg-surface-soft border border-line/50 text-[11px]">
                        {product.quantity_sold.toLocaleString('id-ID')} unit
                      </span>
                    </TableCell>
                    <TableCell className="text-right num font-bold text-pine py-2.5">
                      {product.revenue_minor !== undefined && product.revenue_minor > 0
                        ? formatMinor(product.revenue_minor)
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
