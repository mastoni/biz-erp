import React from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Package } from 'lucide-react';

interface ProductEmptyStateProps {
  hasFilter?: boolean;
  onAddProduct?: () => void;
  onClearFilter?: () => void;
  isOwner?: boolean;
}

export function ProductEmptyState({
  hasFilter = false,
  onAddProduct,
  onClearFilter,
  isOwner = true,
}: ProductEmptyStateProps) {
  if (hasFilter) {
    return (
      <EmptyState
        icon={<Package className="h-6 w-6 text-fog" />}
        title="Tidak ada produk ditemukan"
        description="Coba sesuaikan kata kunci pencarian Anda."
        action={
          <button
            onClick={onClearFilter}
            className="btn-outline text-xs"
          >
            Hapus Filter
          </button>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={<Package className="h-6 w-6 text-pine" />}
      title="Belum ada produk"
      description="Buat produk pertama untuk mulai mengelola katalog Anda."
      action={
        isOwner && onAddProduct ? (
          <button
            onClick={onAddProduct}
            className="btn-primary text-xs"
          >
            Tambah Produk
          </button>
        ) : undefined
      }
    />
  );
}
