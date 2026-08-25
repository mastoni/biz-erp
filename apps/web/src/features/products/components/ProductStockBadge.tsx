import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { StockStatus } from '../types';

interface ProductStockBadgeProps {
  quantity: number | null;
  status: StockStatus;
  branchName?: string;
  className?: string;
}

const stockConfig: Record<StockStatus, { variant: 'pine' | 'honey' | 'clay' | 'neutral' | 'ocean' | 'outline'; label: string }> = {
  in_stock: { variant: 'pine', label: 'ready' },
  low_stock: { variant: 'honey', label: 'low' },
  out_of_stock: { variant: 'clay', label: 'empty' },
  unknown: { variant: 'neutral', label: '—' },
};

export function ProductStockBadge({ quantity, status, branchName, className }: ProductStockBadgeProps) {
  const cfg = stockConfig[status];

  const displayText = quantity !== null ? quantity.toString() : '—';

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Badge variant={cfg.variant} size="sm">
        <span className="num">{displayText}</span>
      </Badge>
      <span
        className="text-[10px] uppercase tracking-[0.09em]"
        style={{ color: 'var(--color-fog)' }}
      >
        {cfg.label}
      </span>
      {branchName && (
        <span className="text-[10px] text-fog/60" title={branchName}>
          • {branchName}
        </span>
      )}
    </div>
  );
}
