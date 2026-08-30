'use client';

import React, { useState } from 'react';
import { Database, ShieldCheck, Key, Layers, ChevronDown } from 'lucide-react';

interface SchemaTable {
  name: string;
  note: string;
  fields: { name: string; tag?: 'PK' | 'FK' | 'T' | 'UQ' }[];
}

const CANONICAL_SCHEMA: SchemaTable[] = [
  {
    name: 'businesses',
    note: 'Tenant boundary utama',
    fields: [
      { name: 'id', tag: 'PK' },
      { name: 'name' },
      { name: 'created_at' },
    ],
  },
  {
    name: 'users',
    note: 'Identitas & akses lintas platform/tenant',
    fields: [
      { name: 'id', tag: 'PK' },
      { name: 'email', tag: 'UQ' },
      { name: 'platform_role' },
      { name: 'status' },
    ],
  },
  {
    name: 'plans',
    note: 'Katalog paket langganan',
    fields: [
      { name: 'code', tag: 'PK' },
      { name: 'name' },
      { name: 'family' },
      { name: 'tier' },
    ],
  },
  {
    name: 'subscriptions',
    note: 'Kontrak aktif tenant dengan paket',
    fields: [
      { name: 'id', tag: 'PK' },
      { name: 'business_id', tag: 'T' },
      { name: 'plan_code', tag: 'FK' },
      { name: 'status' },
    ],
  },
  {
    name: 'products',
    note: 'Katalog barang terisolasi per tenant',
    fields: [
      { name: 'id', tag: 'PK' },
      { name: 'business_id', tag: 'T' },
      { name: 'sku' },
      { name: 'name' },
    ],
  },
  {
    name: 'journal_entries',
    note: 'Buku besar double-entry per cabang',
    fields: [
      { name: 'id', tag: 'PK' },
      { name: 'business_id', tag: 'T' },
      { name: 'branch_id', tag: 'FK' },
      { name: 'date' },
      { name: 'is_balanced' },
    ],
  },
];

export function PlatformSchemaViewer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-line bg-card p-6 shadow-2xs">
      <div
        className="flex cursor-pointer items-center justify-between"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800">
            <Database width={18} height={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-ink">Arsitektur Basis Data Canonical</h3>
            <p className="text-xs text-fog mt-0.5">Topologi partisi multi-tenant & buku besar double-entry</p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink">
          <span>{open ? 'Tutup Diagram' : 'Lihat Skema'}</span>
          <ChevronDown
            width={14}
            height={14}
            className={`transition-transform duration-200 ${open ? 'rotate-180 text-pine' : 'text-fog'}`}
          />
        </button>
      </div>

      {open && (
        <div className="mt-6 border-t border-line/60 pt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-xs text-fog">
            <span className="flex items-center gap-1"><span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">PK</span> Primary Key</span>
            <span className="flex items-center gap-1"><span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-900">T</span> Tenant Isolation Key</span>
            <span className="flex items-center gap-1"><span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-900">FK</span> Foreign Key</span>
            <span className="flex items-center gap-1"><span className="rounded bg-slate-500/20 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">UQ</span> Unique</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CANONICAL_SCHEMA.map((tbl) => (
              <div key={tbl.name} className="rounded-xl border border-line bg-surface overflow-hidden">
                <div className="border-b border-line bg-paper/60 px-4 py-2.5">
                  <p className="font-mono text-xs font-bold text-ink">{tbl.name}</p>
                  <p className="text-[11px] text-fog">{tbl.note}</p>
                </div>
                <div className="p-3 divide-y divide-line/40 text-xs">
                  {tbl.fields.map((f) => (
                    <div key={f.name} className="flex items-center justify-between py-1.5">
                      <span className="font-mono text-ink/80">{f.name}</span>
                      {f.tag && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold ${
                            f.tag === 'PK'
                              ? 'bg-amber-500/20 text-amber-900'
                              : f.tag === 'T'
                              ? 'bg-emerald-500/20 text-emerald-900'
                              : f.tag === 'FK'
                              ? 'bg-sky-500/20 text-sky-900'
                              : 'bg-slate-500/20 text-slate-900'
                          }`}
                        >
                          {f.tag}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
