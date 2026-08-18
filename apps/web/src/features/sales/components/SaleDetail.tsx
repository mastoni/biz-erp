'use client';

import React from 'react';
import { Sale } from '@/features/sales/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMinor, formatEpochMs } from '@/lib/format';

interface SaleDetailProps {
  sale: Sale;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-3 border-b border-zinc-100 last:border-0">
      <span className="text-sm font-medium text-zinc-500 sm:w-48 shrink-0">{label}</span>
      <span className="text-sm text-zinc-900 break-all">{value}</span>
    </div>
  );
}

export function SaleDetail({ sale }: SaleDetailProps) {
  return (
    <div className="space-y-6">
      {/* Sale Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Detail Transaksi — {sale.receipt_number}
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-zinc-100">
          <DetailRow label="Receipt Number" value={sale.receipt_number} />
          <DetailRow label="Payment Method" value={sale.payment_method ?? <span className="text-zinc-400">-</span>} />
          <DetailRow label="Cashier" value={sale.cashier_id ?? <span className="text-zinc-400">-</span>} />
        </CardContent>
      </Card>

      {/* Timing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Waktu</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-zinc-100">
          <DetailRow label="Dibuat di Klien" value={formatEpochMs(sale.client_created_at)} />
          <DetailRow label="Dikonfirmasi Server" value={formatEpochMs(sale.server_created_at)} />
        </CardContent>
      </Card>

      {/* Payment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Rincian Pembayaran</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-zinc-100">
          <DetailRow label="Subtotal" value={formatMinor(sale.subtotal_minor)} />
          <DetailRow
            label="Diskon"
            value={
              sale.discount_minor > 0 ? (
                <span className="text-red-600 font-medium">-{formatMinor(sale.discount_minor)}</span>
              ) : (
                <span className="text-zinc-400">-</span>
              )
            }
          />
          <DetailRow
            label="Pajak"
            value={sale.tax_minor > 0 ? formatMinor(sale.tax_minor) : <span className="text-zinc-400">-</span>}
          />
          <DetailRow
            label="Grand Total"
            value={<span className="font-semibold text-base">{formatMinor(sale.grand_total_minor)}</span>}
          />
          <DetailRow
            label="Tunai Diterima"
            value={
              sale.cash_received_minor > 0
                ? formatMinor(sale.cash_received_minor)
                : <span className="text-zinc-400">-</span>
            }
          />
          <DetailRow
            label="Kembalian"
            value={
              sale.change_minor > 0
                ? formatMinor(sale.change_minor)
                : <span className="text-zinc-400">-</span>
            }
          />
        </CardContent>
      </Card>

      {/* Items — subtotal_minor intentionally omitted (not in backend response) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Item ({sale.items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Harga Satuan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-zinc-500 h-16">
                      Tidak ada item.
                    </TableCell>
                  </TableRow>
                ) : (
                  sale.items.map((item, i) => (
                    <TableRow key={`${sale.id}-item-${i}`}>
                      <TableCell>
                        <div className="font-medium text-sm">{item.product_name_snapshot}</div>
                        {item.product_id && (
                          <div className="text-xs text-zinc-400 font-mono">{item.product_id}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatMinor(item.unit_price_minor)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
