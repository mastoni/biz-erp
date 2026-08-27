'use client';

import React from 'react';
import { num, idrShort } from '../purchase-helpers';
import type { PurchaseSummaryKPI } from '../types';

interface PurchasesKPICardsProps {
  summary: PurchaseSummaryKPI;
}

export function PurchasesKPICards({ summary }: PurchasesKPICardsProps) {
  const activeIncoming = summary.sent_count + summary.partial_count;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* 1. PO Aktif / Dalam Pengiriman */}
      <div className="rounded-xl border border-line bg-card p-4 shadow-xs transition hover:border-line-dark">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-fog">
          PO Dalam Pengiriman
        </p>
        <p className="num mt-1 text-2xl font-bold text-tide">
          {num(activeIncoming)}
        </p>
        <p className="text-[11px] text-fog">menunggu kedatangan</p>
      </div>

      {/* 2. Nilai Belanja */}
      <div className="rounded-xl border border-line bg-card p-4 shadow-xs transition hover:border-line-dark">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-fog">
          Nilai Belanja
        </p>
        <p className="num mt-1 text-2xl font-bold text-pine">
          {idrShort(summary.total_value_minor)}
        </p>
        <p className="text-[11px] text-fog">total pesanan aktif</p>
      </div>

      {/* 3. Draft PO */}
      <div className="rounded-xl border border-line bg-card p-4 shadow-xs transition hover:border-line-dark">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-fog">
          Draft PO
        </p>
        <p className="num mt-1 text-2xl font-bold text-ink">
          {num(summary.draft_count)}
        </p>
        <p className="text-[11px] text-fog">pesanan belum dikirim</p>
      </div>

      {/* 4. Sisa Tagihan / Hutang Tempo */}
      <div className="rounded-xl border border-line bg-card p-4 shadow-xs transition hover:border-line-dark">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-fog">
          Sisa Tagihan
        </p>
        <p className="num mt-1 text-2xl font-bold text-clay">
          {idrShort(summary.outstanding_minor)}
        </p>
        <p className="text-[11px] text-fog">belum dibayar ke supplier</p>
      </div>
    </div>
  );
}
