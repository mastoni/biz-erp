'use client';

import React from 'react';
import { POSProductViewModel } from '../types';
import { POSProductCard } from './POSProductCard';

export interface POSProductGridProps {
  products: POSProductViewModel[];
  selectedCategory: string;
  searchQuery: string;
  onAddToCart: (product: POSProductViewModel) => void;
}

export function POSProductGrid({
  products,
  selectedCategory,
  searchQuery,
  onAddToCart,
}: POSProductGridProps) {
  return (
    <section>
      <p className="mb-3 text-[12px] font-semibold text-fog">
        {products.length} produk {selectedCategory !== 'Semua' && `· ${selectedCategory}`}
      </p>

      {products.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
          {products.map((p) => (
            <POSProductCard key={p.id} product={p} onAddToCart={onAddToCart} />
          ))}
        </div>
      ) : (
        <div className="card mt-2 p-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-paper text-fog">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <h4 className="text-[14px] font-bold text-ink">Produk tidak ditemukan</h4>
          <p className="mt-1 text-[12.5px] text-fog">
            {searchQuery
              ? `Tidak ada hasil untuk "${searchQuery}". Coba kata kunci lain.`
              : 'Tidak ada produk di kategori ini.'}
          </p>
        </div>
      )}
    </section>
  );
}
