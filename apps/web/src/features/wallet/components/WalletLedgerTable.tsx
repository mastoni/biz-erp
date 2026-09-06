import React from 'react';
import { WalletLedgerEntry } from '../types';
import { getTransactionTypeLabel } from '../wallet-helpers';
import { formatMinor } from '@/lib/format';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import {
  ArrowDownLeft,
  ArrowUpRight,
  History,
  FileText,
  Calendar,
  Receipt,
} from 'lucide-react';

interface WalletLedgerTableProps {
  entries: WalletLedgerEntry[];
  isLoading: boolean;
  onRefresh?: () => void;
}

export function WalletLedgerTable({
  entries,
  isLoading,
  onRefresh,
}: WalletLedgerTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-3 border-b border-line/40 last:border-0 animate-pulse"
            >
              <div className="space-y-1.5">
                <div className="h-4 w-36 bg-surface-soft rounded-md" />
                <div className="h-3 w-24 bg-surface-soft rounded-md" />
              </div>
              <div className="h-5 w-24 bg-surface-soft rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<History className="h-6 w-6" />}
        title="Belum ada riwayat transaksi"
        description="Transaksi isi saldo (top up), pembayaran tagihan, atau settlement kasir akan tercatat di sini."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-xs">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-line bg-surface-soft/40 hover:bg-surface-soft/40">
              <TableHead className="w-[180px] text-xs font-semibold text-fog">Waktu</TableHead>
              <TableHead className="text-xs font-semibold text-fog">Tipe Transaksi</TableHead>
              <TableHead className="text-xs font-semibold text-fog">Keterangan / Referensi</TableHead>
              <TableHead className="text-right text-xs font-semibold text-fog">Nominal</TableHead>
              <TableHead className="text-right text-xs font-semibold text-fog">Saldo Akhir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const isCredit = entry.entry_type === 'CREDIT';
              const typeLabel = getTransactionTypeLabel(entry.transaction_type);

              return (
                <TableRow
                  key={entry.id}
                  className="border-b border-line/60 transition-colors hover:bg-surface-soft/30 last:border-0"
                >
                  {/* Timestamp */}
                  <TableCell className="py-3.5 text-xs text-fog whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span>{new Date(entry.created_at).toLocaleString('id-ID')}</span>
                    </div>
                  </TableCell>

                  {/* Transaction Type */}
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          isCredit
                            ? 'bg-pine-soft text-pine'
                            : 'bg-clay-soft text-clay'
                        }`}
                      >
                        {isCredit ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <span className="text-xs font-semibold text-ink">
                        {typeLabel}
                      </span>
                    </div>
                  </TableCell>

                  {/* Description / Reference */}
                  <TableCell className="py-3.5 text-xs">
                    <div className="max-w-xs space-y-0.5">
                      <p className="font-medium text-ink truncate">
                        {entry.description || 'Transaksi Digital Wallet'}
                      </p>
                      {entry.reference_id && (
                        <p className="font-mono text-[11px] text-fog truncate">
                          Ref: {entry.reference_id}
                        </p>
                      )}
                    </div>
                  </TableCell>

                  {/* Amount with color code */}
                  <TableCell className="py-3.5 text-right font-mono text-xs font-bold">
                    <span className={isCredit ? 'text-pine' : 'text-clay'}>
                      {isCredit ? '+' : '-'}
                      {formatMinor(entry.amount)}
                    </span>
                  </TableCell>

                  {/* Balance After */}
                  <TableCell className="py-3.5 text-right font-mono text-xs font-semibold text-ink">
                    {formatMinor(entry.balance_after)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
