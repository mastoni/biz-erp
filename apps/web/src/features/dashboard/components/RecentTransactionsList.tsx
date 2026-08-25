import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { formatMinor } from '@/lib/format';
import { formatPaymentMethodLabel } from '../api';
import { Receipt, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { RecentTransactionItem } from '../types';

export interface RecentTransactionsListProps {
  transactions: RecentTransactionItem[];
}

function formatShortTime(isoString: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

function getPaymentBadgeStyle(method: string) {
  const m = (method || '').toUpperCase();
  if (m.includes('QRIS')) return 'bg-pine-soft text-pine border-pine/20';
  if (m.includes('TRANSFER') || m.includes('BANK')) return 'bg-ocean-soft text-ocean border-ocean/20';
  if (m.includes('CASH') || m.includes('TUNAI')) return 'bg-honey-soft text-honey border-honey/20';
  return 'bg-surface-soft text-fog border-line';
}

export function RecentTransactionsList({ transactions }: RecentTransactionsListProps) {
  return (
    <Card className="border border-line bg-card shadow-[0_1px_3px_rgba(26,29,26,0.04)]">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-line/60">
        <div>
          <CardTitle className="text-sm font-bold font-heading text-ink flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-ocean-soft border border-ocean/20 flex items-center justify-center text-ocean">
              <Receipt className="h-3.5 w-3.5" />
            </div>
            <span>Transaksi Terbaru</span>
          </CardTitle>
          <p className="text-xs text-fog">Riwayat checkout terbaru yang tersinkron</p>
        </div>

        <Link
          href="/sales"
          className="text-xs font-semibold text-pine hover:text-pine-hover hover:underline inline-flex items-center gap-1 transition-colors"
        >
          Lihat Semua
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>

      <CardContent className="pt-3 px-3 sm:px-4">
        {transactions.length === 0 ? (
          <div className="py-12 text-center text-xs text-fog flex flex-col items-center gap-2">
            <Receipt className="h-6 w-6 text-fog/40" />
            <span>Belum ada transaksi terbaru</span>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-line/80">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-soft/80 text-[11px] hover:bg-surface-soft/80">
                  <TableHead className="font-bold text-fog">No. Struk</TableHead>
                  <TableHead className="font-bold text-fog">Waktu</TableHead>
                  <TableHead className="font-bold text-fog">Metode</TableHead>
                  <TableHead className="font-bold text-fog">Kasir</TableHead>
                  <TableHead className="text-right font-bold text-fog">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id} className="text-xs hover:bg-surface-soft/50 transition-colors">
                    <TableCell className="py-2.5">
                      <span className="font-mono font-bold text-ink text-[11px] px-2 py-0.5 rounded bg-surface-soft border border-line/60">
                        {t.receipt_number}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 text-fog">
                      <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="h-3 w-3 text-fog/60" />
                        {formatShortTime(t.created_at)}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${getPaymentBadgeStyle(t.payment_method ?? '')}`}>
                        {formatPaymentMethodLabel(t.payment_method ?? 'UNKNOWN')}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 text-fog text-[11px]">
                      <span className="font-mono truncate max-w-[80px] inline-block" title={t.cashier_id ?? undefined}>
                        {t.cashier_id ? `${t.cashier_id.substring(0, 8)}...` : 'Kasir'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right num font-extrabold text-ink py-2.5 text-xs">
                      {formatMinor(t.total_minor)}
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
