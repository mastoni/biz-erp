import type { AxiosError } from 'axios';
import { Product, ProductViewModel, ProductStockViewModel, ProductListViewModel, ProductOperationError, StockStatus, LOW_STOCK_THRESHOLD } from './types';

// ── Margin calculation ────────────────────────────────────────────────────────

export interface MarginResult {
  margin_minor: number | null;
  margin_percent: number | null;
}

export function calculateMargin(priceMinor: number, costMinor: number | null): MarginResult {
  if (costMinor === null) {
    return { margin_minor: null, margin_percent: null };
  }

  const marginMinor = priceMinor - costMinor;

  if (costMinor === 0) {
    return { margin_minor: marginMinor, margin_percent: null };
  }

  const marginPercent = (marginMinor / costMinor) * 100;

  return { margin_minor: marginMinor, margin_percent: marginPercent };
}

// ── Stock status ───────────────────────────────────────────────────────────────

export function getStockStatus(quantity: number | null): StockStatus {
  if (quantity === null) return 'unknown';
  if (quantity === 0) return 'out_of_stock';
  if (quantity <= LOW_STOCK_THRESHOLD) return 'low_stock';
  return 'in_stock';
}

// ── ViewModel mapping ──────────────────────────────────────────────────────────

export function mapProductToViewModel(
  product: Product,
  stockQuantity?: number
): ProductViewModel {
  const margin = calculateMargin(product.price_minor, product.cost_minor);
  const hasStock = stockQuantity !== undefined;

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    sku: product.sku,
    category: product.category,
    barcode: product.barcode,
    image_url: product.image_url ?? null,
    image_enabled: product.image_enabled ?? false,
    price_minor: product.price_minor,
    cost_minor: product.cost_minor,
    margin_minor: margin.margin_minor,
    margin_percent: margin.margin_percent,
    is_active: product.is_active,
    server_version: product.server_version,
    stock_quantity: hasStock ? stockQuantity : null,
    stock_status: getStockStatus(hasStock ? stockQuantity : null),
    created_at: product.created_at,
    updated_at: product.updated_at,
  };
}

export function mapProductListToViewModel(
  items: Product[],
  total: number,
  limit: number,
  offset: number,
  hasMore: boolean
): ProductListViewModel {
  return {
    items: items.map((p) => mapProductToViewModel(p)),
    total,
    limit,
    offset,
    has_more: hasMore,
  };
}

export function mapStockToViewModel(stock: { product_id: string; branch_id: string; quantity: number }): ProductStockViewModel {
  return {
    product_id: stock.product_id,
    branch_id: stock.branch_id,
    quantity: stock.quantity,
  };
}

export function enrichWithStock(viewModel: ProductViewModel, stock: ProductStockViewModel): ProductViewModel {
  return {
    ...viewModel,
    stock_quantity: stock.quantity,
    stock_status: getStockStatus(stock.quantity),
  };
}

// ── Error classification ───────────────────────────────────────────────────────

export function classifyProductError(error: unknown): ProductOperationError {
  if (error instanceof Error && 'response' in error) {
    const axiosError = error as AxiosError<{
      error?: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
      };
      code?: string;
      message?: string;
      details?: Record<string, unknown>;
    }>;

    const status = axiosError.response?.status;
    const body = axiosError.response?.data;

    if (status === 409) {
      const code = body?.error?.code || body?.code;
      const message = body?.error?.message || body?.message || 'A conflict occurred while modifying the product.';
      const details = body?.error?.details || body?.details;

      if (code === 'SKU_CONFLICT') {
        return {
          type: 'sku_conflict',
          sku: (details?.sku as string) ?? null,
          message: message,
        };
      }

      if (code === 'BARCODE_CONFLICT') {
        return {
          type: 'barcode_conflict',
          barcode: (details?.barcode as string) ?? null,
          message: message,
        };
      }

      if (code === 'VERSION_CONFLICT' || code === 'IDEMPOTENCY_KEY_REUSE') {
        const expected = details?.expected_server_version as number | undefined;
        const current = details?.current_server_version as number | undefined;
        return {
          type: 'version_conflict',
          expected: expected ?? 0,
          current: current ?? 0,
          message: message,
        };
      }

      return { type: 'unknown', message: `Conflict: ${message}` };
    }

    if (status === 400) {
      const message = body?.error?.message || body?.message || 'Validation error occurred.';
      const details = body?.error?.details || body?.details;
      return {
        type: 'validation_error',
        details: (details as Record<string, string>) ?? {},
        message: message,
      };
    }

    if (status === 403) {
      const message = body?.error?.message || body?.message || 'Insufficient permissions.';
      return { type: 'forbidden', message };
    }

    if (status === 404) {
      const message = body?.error?.message || body?.message || 'Product not found.';
      return { type: 'not_found', message };
    }
  }

  if (error instanceof Error) {
    return { type: 'network_error', message: error.message };
  }

  return { type: 'unknown', message: 'An unexpected error occurred.' };
}

export function isSkuConflict(error: ProductOperationError): boolean {
  return error.type === 'sku_conflict';
}

export function isBarcodeConflict(error: ProductOperationError): boolean {
  return error.type === 'barcode_conflict';
}

export function isVersionConflict(error: ProductOperationError): boolean {
  return error.type === 'version_conflict';
}
