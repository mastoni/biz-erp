'use client';

import React from 'react';
import { Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SupplierEmptyStateProps {
  isOwner: boolean;
  onAddClick?: () => void;
}

export function SupplierEmptyState({ isOwner, onAddClick }: SupplierEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="rounded-full bg-ink/5 p-5 mb-5">
        <Package className="h-12 w-12 text-ink/40" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-display font-semibold text-ink mb-1">
        Supplier tidak ditemukan
      </h3>
      <p className="text-sm text-ink/50 max-w-sm leading-relaxed">
        Belum ada data supplier pada bisnis ini.
      </p>
      {isOwner && onAddClick && (
        <button
          type="button"
          onClick={onAddClick}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-pine px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pine-deep focus:outline-none focus:ring-2 focus:ring-pine focus:ring-offset-2"
        >
          <Package className="h-4 w-4" />
          Tambah Supplier
        </button>
      )}
    </div>
  );
}
