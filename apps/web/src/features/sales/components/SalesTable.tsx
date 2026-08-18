'use client';

import React from 'react';
import { Sale } from '@/features/sales/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatMinor, formatEpochMs } from '@/lib/format';

interface SalesTableProps {
  sales: Sale[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export function SalesTable({ sales, hasMore, loadingMore, onLoadMore }: SalesTableProps) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      {/* Responsive wrapper: horizontal scroll on narrow screens */}
      <div className="bg-white border border-zinc-200 rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/80">
                <TableHead className="whitespace-nowrap font-semibold text-zinc-700">Receipt</TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-zinc-700">Date</TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-zinc-700">Payment</TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-zinc-700 text-right">Subtotal</TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-zinc-700 text-right">Discount</TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-zinc-700 text-right">Tax</TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-zinc-700 text-right">Total</TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-zinc-700 text-right">Cash</TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-zinc-700 text-right">Change</TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-zinc-700">Cashier</TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-zinc-700 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => (
                <TableRow key={sale.id} className="hover:bg-zinc-50 transition-colors">
                  <TableCell className="font-mono text-sm whitespace-nowrap">
                    {sale.receipt_number}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap text-zinc-600">
                    {formatEpochMs(sale.client_created_at)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {sale.payment_method ?? <span className="text-zinc-400">-</span>}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatMinor(sale.subtotal_minor)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {sale.discount_minor > 0
                      ? <span className="text-red-600 font-medium">-{formatMinor(sale.discount_minor)}</span>
                      : <span className="text-zinc-400">-</span>}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {sale.tax_minor > 0 ? formatMinor(sale.tax_minor) : <span className="text-zinc-400">-</span>}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">
                    {formatMinor(sale.grand_total_minor)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {sale.cash_received_minor > 0 ? formatMinor(sale.cash_received_minor) : <span className="text-zinc-400">-</span>}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {sale.change_minor > 0 ? formatMinor(sale.change_minor) : <span className="text-zinc-400">-</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {sale.cashier_id ?? <span className="text-zinc-400">-</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/sales/${sale.id}`)}
                      aria-label={`View receipt ${sale.receipt_number}`}
                    >
                      <Eye className="mr-1.5 h-4 w-4" />
                      Detail
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination — load more */}
      {hasMore && (
        <div className="flex justify-center py-2">
          <Button variant="outline" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memuat...
              </>
            ) : (
              'Muat Lebih Banyak'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
