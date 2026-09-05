'use client';

import React, { useState } from 'react';
import type { JournalEntryDto } from '../types';
import { createJournalReversal, getFinanceApiErrorMessage } from '../api';
import {
  X,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export interface JournalReversalModalProps {
  journal: JournalEntryDto | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function JournalReversalModal({
  journal,
  isOpen,
  onClose,
  onSuccess,
}: JournalReversalModalProps) {
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ reversalId: string } | null>(null);

  if (!isOpen || !journal) return null;

  const handleExecuteReversal = async () => {
    if (!isConfirmed) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await createJournalReversal(journal.id);
      setSuccessResult(res);
      onSuccess();
    } catch (err) {
      setError(getFinanceApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalClose = () => {
    setIsConfirmed(false);
    setError(null);
    setSuccessResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-3xl border border-line bg-surface p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <RotateCcw className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                Pembalikan Jurnal (Reversal)
              </h2>
              <p className="text-xs text-fog">
                Tindakan khusus Pemilik Usaha (OWNER)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            disabled={isSubmitting}
            className="rounded-xl p-2 text-fog hover:bg-paper hover:text-ink transition cursor-pointer disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Success Feedback View */}
        {successResult ? (
          <div className="space-y-4 py-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mx-auto">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-ink">
                Pembalikan Jurnal Berhasil
              </h3>
              <p className="text-xs text-fog mt-1">
                Ayat jurnal pembalik (counter-entry) telah tercatat di buku besar dengan ID:
              </p>
              <p className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 rounded-xl p-2.5 mt-2 border border-emerald-200">
                {successResult.reversalId}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleModalClose}
                className="w-full rounded-xl bg-pine py-2.5 text-xs font-bold text-white shadow-sm hover:bg-pine-deep cursor-pointer"
              >
                Selesai &amp; Tutup
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Warning Box */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>Konfirmasi Tindakan Keuangan Permanen</span>
              </div>
              <p className="leading-relaxed">
                Pembalikan jurnal akan membuat ayat jurnal penyesuaian (counter-entry) yang membalikkan posisi debit dan kredit jurnal asli secara permanen.
              </p>
              <p className="text-[11px] text-amber-800">
                Jurnal yang telah dibalikkan tidak dapat dibatalkan atau dibalikkan ulang.
              </p>
            </div>

            {/* Target Journal Snapshot */}
            <div className="rounded-2xl border border-line bg-paper/50 p-3.5 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-fog">ID Jurnal:</span>
                <span className="font-mono font-semibold text-ink">{journal.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fog">Tanggal &amp; Sumber:</span>
                <span className="font-semibold text-ink">{journal.date} ({journal.source_type})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fog">Referensi:</span>
                <span className="font-semibold text-ink">{journal.reference || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fog">Keterangan:</span>
                <span className="font-semibold text-ink truncate max-w-[240px]">{journal.description}</span>
              </div>
            </div>

            {/* Error Banner if API fails */}
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Confirmation Checkbox */}
            <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 text-xs cursor-pointer select-none hover:bg-paper/40 transition">
              <input
                type="checkbox"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-line text-rose-600 focus:ring-rose-500 cursor-pointer"
              />
              <span className="font-medium text-ink leading-relaxed">
                Saya memahami konsekuensi akuntansi ini dan menyetujui pembuatan jurnal pembalik (reversal).
              </span>
            </label>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2.5 border-t border-line pt-4">
              <button
                type="button"
                onClick={handleModalClose}
                disabled={isSubmitting}
                className="rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-ink shadow-2xs hover:bg-paper cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleExecuteReversal}
                disabled={!isConfirmed || isSubmitting}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    <span>Ya, Balikkan Jurnal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
