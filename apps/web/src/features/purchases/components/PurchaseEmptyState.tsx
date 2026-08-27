'use client';

import React from 'react';
import { Truck, Plus } from 'lucide-react';
import {
  PURCHASES_EMPTY_TITLE,
  PURCHASES_EMPTY_DESCRIPTION,
  PURCHASES_ADD_ACTION_LABEL,
} from '../purchase-helpers';

interface PurchaseEmptyStateProps {
  isOwner: boolean;
  onAddClick?: () => void;
}

export function PurchaseEmptyState({
  isOwner,
  onAddClick,
}: PurchaseEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-card p-12 text-center shadow-xs">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-paper text-fog">
        <Truck width={24} height={24} />
      </div>
      <h3 className="mt-4 font-display text-base font-bold text-ink">
        {PURCHASES_EMPTY_TITLE}
      </h3>
      <p className="mt-1 max-w-sm text-xs text-fog">
        {PURCHASES_EMPTY_DESCRIPTION}
      </p>
      {isOwner && onAddClick && (
        <button
          type="button"
          onClick={onAddClick}
          className="mt-5 flex items-center gap-2 rounded-xl bg-pine px-4 py-2 text-xs font-bold text-white transition hover:bg-pine-deep shadow-xs cursor-pointer"
        >
          <Plus width={15} height={15} />
          {PURCHASES_ADD_ACTION_LABEL}
        </button>
      )}
    </div>
  );
}
