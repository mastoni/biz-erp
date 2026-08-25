import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProductStatusBadge } from './ProductStatusBadge';
import { ProductStockBadge } from './ProductStockBadge';
import { Edit, Power } from 'lucide-react';
import type { ProductViewModel } from '../types';
import { formatMinor } from '@/lib/format';

interface ProductCardProps {
  product: ProductViewModel;
  branchName?: string;
  onEdit: (product: ProductViewModel) => void;
  onDeactivate: (product: ProductViewModel) => void;
  isOwner?: boolean;
}

export function ProductCard({
  product,
  branchName,
  onEdit,
  onDeactivate,
  isOwner = true,
}: ProductCardProps) {
  return (
    <Card className={cn('card card-hover', !product.is_active && 'opacity-65')}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="font-display text-base leading-tight break-words pr-10">
            {product.name}
          </CardTitle>
          <ProductStatusBadge isActive={product.is_active} />
        </div>
        {product.description && (
          <CardDescription className="text-xs text-fog line-clamp-2 break-words">
            {product.description}
          </CardDescription>
        )}
        {!product.description && (
          <CardDescription className="text-xs italic text-fog/40">
            Tanpa deskripsi
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="grid gap-2.5">
        <div className="grid grid-cols-2 gap-1 text-xs">
          <span className="text-fog">SKU</span>
          <span className="num text-ink font-mono">
            {product.sku || <span className="text-fog/40">—</span>}
          </span>

          <span className="text-fog">Barcode</span>
          <span className="num text-ink font-mono">
            {product.barcode || <span className="text-fog/40">—</span>}
          </span>

          <span className="text-fog">Kategori</span>
          <span className="text-ink">
            {product.category || <span className="text-fog/40">—</span>}
          </span>

          <span className="text-fog">Stok</span>
          <ProductStockBadge
            quantity={product.stock_quantity}
            status={product.stock_status}
            branchName={branchName}
            className="inline-block"
          />
        </div>

        <div className="grid grid-cols-2 gap-1 pt-1.5 border-t border-line/80 text-xs">
          <div>
            <span className="text-fog">Harga Jual</span>
            <span className="block num text-ink font-medium mt-0.5">
              {formatMinor(product.price_minor)}
            </span>
          </div>
          <div>
            <span className="text-fog">HPP</span>
            <span className="block num text-ink font-medium mt-0.5">
              {product.cost_minor !== null ? formatMinor(product.cost_minor) : <span className="text-fog/40">—</span>}
            </span>
          </div>

          <div>
            <span className="text-fog">Margin</span>
            <span className="block num text-ink font-medium mt-0.5">
              {product.margin_minor !== null && product.margin_percent !== null
                ? `${formatMinor(product.margin_minor)} (${product.margin_percent.toFixed(1)}%)`
                : product.margin_minor !== null
                  ? formatMinor(product.margin_minor)
                  : <span className="text-fog/40">—</span>}
            </span>
          </div>
          <div>
            <span className="text-fog">Status</span>
            <span className="block mt-0.5">
              <ProductStatusBadge isActive={product.is_active} />
            </span>
          </div>
        </div>
      </CardContent>

      {isOwner && (
        <div className="flex items-center justify-end gap-1.5 border-t border-line/80 px-4 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(product)}
            aria-label={`Edit ${product.name}`}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeactivate(product)}
            aria-label={`Deactivate ${product.name}`}
          >
            <Power className="h-3.5 w-3.5 text-clay" />
          </Button>
        </div>
      )}
    </Card>
  );
}
