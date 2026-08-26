'use client';

import React, { useState } from 'react';
import { POSProductViewModel } from '../types';
import { idr } from '../pos-helpers';

export const CATEGORY_COLORS: Record<string, string> = {
  Sembako: '#17593e',
  Minuman: '#35657f',
  Snack: '#d3921f',
  Perawatan: '#bc4b2f',
  'Rumah Tangga': '#5e7d5a',
  Makanan: '#d3921f',
  Umum: '#5e7d5a',
};

export interface POSProductCardProps {
  product: POSProductViewModel;
  onAddToCart: (product: POSProductViewModel) => void;
}

export function POSProductCard({ product, onAddToCart }: POSProductCardProps) {
  const [isPopping, setIsPopping] = useState(false);
  const [imageError, setImageError] = useState(false);
  const isOutOfStock = product.stock_status === 'out_of_stock';
  const isLowStock = product.stock_status === 'low_stock';
  const categoryColor = CATEGORY_COLORS[product.category] || '#17593e';

  const handleClick = () => {
    if (isOutOfStock) return;
    onAddToCart(product);
    setIsPopping(true);
    setTimeout(() => setIsPopping(false), 300);
  };

  const hasValidImage = Boolean(product.image_enabled && product.image_url && product.image_url.trim().length > 0 && !imageError);

  return (
    <button
      type="button"
      data-testid={`pos-product-card-${product.id}`}
      onClick={handleClick}
      disabled={isOutOfStock}
      className={`card card-hover group relative flex flex-col justify-between p-3.5 text-left cursor-pointer transition-all ${
        isOutOfStock ? 'opacity-50 cursor-not-allowed hover:translate-y-0' : ''
      } ${isPopping ? 'border-pine/60 ring-2 ring-pine/30' : ''}`}
    >
      <div className="w-full">
        {/* Category marker and stock indicator */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em]"
            style={{ color: categoryColor }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: categoryColor }} />
            {product.category}
          </span>
          {isOutOfStock ? (
            <span className="rounded-md bg-clay-soft px-1.5 py-0.5 text-[10.5px] font-bold text-clay">
              Habis
            </span>
          ) : isLowStock ? (
            <span className="rounded-md bg-honey-soft px-1.5 py-0.5 text-[10.5px] font-bold text-[#8a5f10]">
              {product.quantity_available}
            </span>
          ) : (
            <span className="num text-[10.5px] font-semibold text-fog">
              stok {product.quantity_available}
            </span>
          )}
        </div>

        {/* Product image thumbnail when present */}
        {hasValidImage && (
          <div className="mb-2.5 overflow-hidden rounded-lg border border-line/50 bg-paper/60">
            <img
              src={product.image_url!}
              alt={product.name}
              className="h-24 w-full object-cover transition-transform duration-200 group-hover:scale-105"
              onError={() => setImageError(true)}
            />
          </div>
        )}

        {/* Product title */}
        <p className="min-h-[36px] text-[13px] font-semibold leading-snug text-ink line-clamp-2">
          {product.name}
        </p>
      </div>

      {/* Price and circular add button */}
      <div className="mt-2.5 flex items-center justify-between w-full">
        <span className="num text-[15px] font-bold text-ink">{idr(product.price_minor)}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-pine-soft text-pine transition-all group-hover:bg-pine group-hover:text-[#f2efe2] group-active:scale-90">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </span>
      </div>
    </button>
  );
}
