'use client';

import React, { useEffect, useState } from 'react';
import type { JournalEntryDto } from '../types';
import type { Role } from '@/lib/rbac';
import { getJournalById, getFinanceApiErrorMessage } from '../api';
import { formatMinor } from '@/lib/format';
import {
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Scale,
  Calendar,
  Layers,
} from 'lucide-react';

export interface JournalDetailModalProps {
  journalId: string | null;
  isOpen: boolean;
  onClose: () => void;
  role?: Role | null;
  onOpenReversal?: (journal: JournalEntryDto) => void;
}

export function JournalDetailModal({
  journalId,
  isOpen,
  onClose,
  role,
  onOpenReversal,
}: JournalDetailModalProps) {
  const [journal, setJournal] = useState<JournalEntryDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !journalId) {
      setJournal(null);
      setError(null);
      return;
    }

    let isMounted = true;
    async function loadJournal() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getJournalById(journalId!);
        if (isMounted) {
          setJournal(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(getFinanceApiErrorMessage(err));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    loadJournal();
    return () => {
      isMounted = false;
    };
  }, [isOpen, journalId]);

  if (!isOpen) return null;

  const isOwner = role === 'OWNER';
  const lines = journal?.lines || [];
  const totalDebit = lines.reduce((sum, l) => sum + (l.debit_minor || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit_minor || 0), 0);
  const isBalanced = totalDebit === totalCredit;
  const isEligibleForReversal =
    isOwner && journal?.status === 'posted' && !journal?.reversed_by;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-3xl border border-line bg-surface p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pine/10 text-pine">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                Rincian Jurnal Umum
              </h2>
              <p className="text-xs text-fog font-mono">
                ID: {journalId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-fog hover:bg-paper hover:text-ink transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Loading / Error States */}
        {isLoading && (
          <div className="space-y-3 py-8 text-center">
            <div className="h-6 w-48 mx-auto animate-pulse rounded bg-paper" />
            <div className="h-32 animate-pulse rounded-2xl bg-paper" />
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Main Content */}
        {!isLoading && journal && (
          <div className="space-y-5">
            {/* Meta Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl border border-line bg-paper/50 p-3.5 text-xs">
              <div>
                <span className="text-fog flex items-center gap-1 font-medium">
                  <Calendar className="h-3.5 w-3.5" /> Tanggal
                </span>
                <p className="font-bold text-ink mt-0.5">{journal.date}</p>
              </div>

              <div>
                <span className="text-fog flex items-center gap-1 font-medium">
                  <Layers className="h-3.5 w-3.5" /> Sumber
                </span>
                <p className="font-bold text-ink mt-0.5">{journal.source_type}</p>
              </div>

              <div>
                <span className="text-fog font-medium">Referensi</span>
                <p className="font-bold text-ink mt-0.5 truncate">{journal.reference || '-'}</p>
              </div>

              <div>
                <span className="text-fog font-medium">Status</span>
                <div className="mt-0.5">
                  {journal.status === 'posted' && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="h-3 w-3" />
                      {journal.reversed_by ? 'Reversed (Dibalikkan)' : 'Posted'}
                    </span>
                  )}
                  {journal.status === 'reversed' && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
                      <RotateCcw className="h-3 w-3" />
                      Reversal Counter-Entry
                    </span>
                  )}
                  {journal.status === 'draft' && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                      Draft
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="text-xs">
              <span className="font-semibold text-fog">Keterangan / Memo:</span>
              <p className="mt-1 rounded-xl border border-line bg-surface p-3 font-medium text-ink">
                {journal.description || 'Tidak ada keterangan.'}
              </p>
            </div>

            {/* Double-Entry Journal Lines Table */}
            <div className="rounded-2xl border border-line bg-surface overflow-hidden">
              <div className="border-b border-line bg-paper/50 px-4 py-2.5 flex items-center justify-between">
                <span className="font-display text-xs font-bold text-ink flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5 text-pine" />
                  Ayat Jurnal Ganda (Double-Entry Lines)
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isBalanced
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {isBalanced ? 'Seimbang (Dr = Cr)' : 'Tidak Seimbang'}
                </span>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-paper/30 text-[10px] font-bold uppercase text-fog">
                  <tr>
                    <th className="py-2.5 px-4">Akun</th>
                    <th className="py-2.5 px-3">Keterangan Baris</th>
                    <th className="py-2.5 px-3 text-right">Debit (Dr)</th>
                    <th className="py-2.5 px-4 text-right">Kredit (Cr)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/40">
                  {lines.map((line) => (
                    <tr key={line.id} className="hover:bg-paper/20">
                      <td className="py-2.5 px-4 font-semibold text-ink font-mono text-xs">
                        {line.account_code ? `${line.account_code} - ${line.account_name}` : line.account_id}
                      </td>
                      <td className="py-2.5 px-3 text-fog">{line.description || '-'}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-ink">
                        {line.debit_minor > 0 ? formatMinor(line.debit_minor) : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium text-ink">
                        {line.credit_minor > 0 ? formatMinor(line.credit_minor) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-line bg-paper/40 font-bold">
                  <tr>
                    <td colSpan={2} className="py-3 px-4 text-ink">Total Keseimbangan Jurnal</td>
                    <td className="py-3 px-3 text-right text-emerald-700">{formatMinor(totalDebit)}</td>
                    <td className="py-3 px-4 text-right text-emerald-700">{formatMinor(totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Reversal Audit Info if applicable */}
            {journal.reversed_by && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <RotateCcw className="h-4 w-4" />
                  Jurnal Ini Telah Dibalikkan (Reversed)
                </p>
                <p className="text-[11px] text-rose-700">
                  ID Jurnal Pembalik: <span className="font-mono">{journal.reversed_by}</span>
                  {journal.reversed_at && ` pada ${new Date(journal.reversed_at).toLocaleString('id-ID')}`}
                </p>
              </div>
            )}

            {journal.reversal_of && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <RotateCcw className="h-4 w-4" />
                  Jurnal Ini Merupakan Ayat Pembalik (Counter-Entry)
                </p>
                <p className="text-[11px] text-blue-700">
                  Membalikkan jurnal asli ID: <span className="font-mono">{journal.reversal_of}</span>
                </p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-line pt-4">
              <div>
                {isEligibleForReversal && onOpenReversal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenReversal(journal);
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Balikkan Jurnal (Reversal)</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-line bg-surface px-5 py-2 text-xs font-semibold text-ink shadow-2xs hover:bg-paper cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
