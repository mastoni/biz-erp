'use client';

import React from 'react';

export interface POSCategoryFilterProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function POSCategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
}: POSCategoryFilterProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => {
          const isSelected = selectedCategory === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onSelectCategory(c)}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-all cursor-pointer ${
                isSelected
                  ? 'border-pine bg-pine text-[#f2efe2] shadow-xs'
                  : 'border-line bg-surface text-fog hover:border-pine/40 hover:text-ink'
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>
      <div className="relative ml-auto w-full sm:w-60">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fog"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Cari nama / SKU…"
          className="input w-full pl-8.5 text-[13px]"
        />
      </div>
    </div>
  );
}
