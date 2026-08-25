import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

interface ProductPaginationProps {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  isLoading?: boolean;
  onNext: () => void;
  onPrev: () => void;
}

export function ProductPagination({
  total,
  limit,
  offset,
  hasMore,
  isLoading = false,
  onNext,
  onPrev,
}: ProductPaginationProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const startIndex = offset + 1;
  const endIndex = Math.min(offset + limit, total);

  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between pt-4 text-sm text-fog">
      <div className="text-xs">
        Menampilkan <span className="num font-medium text-ink">{startIndex}</span>–
        <span className="num font-medium text-ink">{endIndex}</span> dari{' '}
        <span className="num font-medium text-ink">{total}</span> produk
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="xs"
          onClick={onPrev}
          disabled={offset === 0 || isLoading}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>

        <span className="text-xs">
          Halaman <span className="num font-medium text-ink">{currentPage}</span> dari{' '}
          <span className="num font-medium text-ink">{totalPages}</span>
        </span>

        <Button
          variant="outline"
          size="xs"
          onClick={onNext}
          disabled={!hasMore || isLoading}
          aria-label="Next page"
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
