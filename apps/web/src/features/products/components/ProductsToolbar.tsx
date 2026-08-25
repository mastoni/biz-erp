import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Search } from '@/components/ui/search';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Filter, X } from 'lucide-react';
import type { ProductFilterModel } from '../types';

interface ProductsToolbarProps {
  filter: ProductFilterModel;
  onFilterChange: (filter: ProductFilterModel) => void;
  categories: string[];
  onAddProduct: () => void;
  isOwner?: boolean;
  disabled?: boolean;
}

export function ProductsToolbar({
  filter,
  onFilterChange,
  categories,
  onAddProduct,
  isOwner = true,
  disabled = false,
}: ProductsToolbarProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filter, search: e.target.value });
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filter, category: e.target.value });
  };

  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filter, barcode: e.target.value });
  };

  const handleClearFilters = () => {
    onFilterChange({ search: '', category: '', barcode: '' });
  };

  const hasActiveFilter = Boolean(filter.search || filter.category || filter.barcode);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="relative flex-1 min-w-0">
        <Search
          value={filter.search}
          onChange={handleSearchChange}
          placeholder="Cari nama, SKU, atau barcode..."
          onClear={() => onFilterChange({ ...filter, search: '' })}
        />
      </div>

      <div className="flex flex-row items-center gap-2">
        <Input
          type="text"
          placeholder="Kategori"
          value={filter.category}
          onChange={handleCategoryChange}
          className="w-32 sm:w-40 text-sm"
        />

        <Input
          type="text"
          placeholder="Barcode"
          value={filter.barcode}
          onChange={handleBarcodeChange}
          className="w-32 sm:w-40 text-sm font-mono num"
        />

        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            aria-label="Clear filters"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}

        {isOwner && (
          <Button
            variant="default"
            size="sm"
            onClick={onAddProduct}
            disabled={disabled}
          >
            <Plus className="h-4 w-4" />
            <span className="ml-1.5 hidden sm:inline">Tambah</span>
          </Button>
        )}
      </div>
    </div>
  );
}

export function CategoryFilter({
  categories,
  selected,
  onSelect,
  className,
}: {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      <Badge
        variant={!selected ? 'pine' : 'outline'}
        size="sm"
        onClick={() => onSelect('')}
        className="cursor-pointer"
      >
        Semua
      </Badge>
      {categories.map((cat) => (
        <Badge
          key={cat}
          variant={selected === cat ? 'pine' : 'outline'}
          size="sm"
          onClick={() => onSelect(cat)}
          className="cursor-pointer"
        >
          {cat}
        </Badge>
      ))}
    </div>
  );
}
