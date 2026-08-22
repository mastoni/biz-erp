'use client';

import React from 'react';
import { Users } from 'lucide-react';

interface CustomerEmptyStateProps {
  isOwner: boolean;
  onAddClick?: () => void;
}

export function CustomerEmptyState({ isOwner, onAddClick }: CustomerEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="rounded-full bg-ink/5 p-5 mb-5">
        <Users className="h-12 w-12 text-ink/40" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-display font-semibold text-ink mb-1">
        Pelanggan belum tersedia
      </h3>
      <p className="text-sm text-ink/50 max-w-sm leading-relaxed">
        Belum ada data pelanggan pada bisnis ini.
      </p>
      {isOwner && onAddClick && (
        <button
          type="button"
          onClick={onAddClick}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink-2 focus:outline-none focus:ring-2 focus:ring-marigold focus:ring-offset-2"
        >
          <Users className="h-4 w-4" />
          Tambah Pelanggan
        </button>
      )}
    </div>
  );
}
