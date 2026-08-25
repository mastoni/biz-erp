import { Skeleton } from '@/components/ui/skeleton';
import { ProductCard } from './ProductCard';
import type { ProductViewModel } from '../types';

interface ProductGridProps {
  products: ProductViewModel[];
  isLoading?: boolean;
  skeletonCount?: number;
  branchName?: string;
  isOwner?: boolean;
  onEdit: (product: ProductViewModel) => void;
  onDeactivate: (product: ProductViewModel) => void;
}

export function ProductGrid({
  products,
  isLoading = false,
  skeletonCount = 6,
  branchName,
  isOwner = true,
  onEdit,
  onDeactivate,
}: ProductGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      data-testid="product-grid"
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          branchName={branchName}
          isOwner={isOwner}
          onEdit={onEdit}
          onDeactivate={onDeactivate}
        />
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card flex flex-col gap-2 overflow-hidden rounded-xl bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-5 w-3/4 rounded" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full rounded" />
      <Skeleton className="h-3 w-2/3 rounded" />
      <div className="grid grid-cols-2 gap-2 pt-2">
        <Skeleton className="h-8 w-full rounded" />
        <Skeleton className="h-8 w-full rounded" />
        <Skeleton className="h-8 w-full rounded" />
        <Skeleton className="h-8 w-full rounded" />
      </div>
      <div className="flex justify-end gap-1 pt-2 border-t">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-6 w-6 rounded" />
      </div>
    </div>
  );
}
