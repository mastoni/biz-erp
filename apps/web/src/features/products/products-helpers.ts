import { ProductViewModel, ProductFilterModel, ProductDataState } from './types';

export const PRODUCTS_PAGE_SIZE = 20;

export function filterProducts(
  products: ProductViewModel[],
  filter: ProductFilterModel,
): ProductViewModel[] {
  const searchLower = filter.search.toLowerCase().trim();
  const categoryLower = filter.category.toLowerCase().trim();
  const barcodeTrim = filter.barcode.trim();

  return products.filter((p) => {
    if (searchLower) {
      const nameMatch = p.name.toLowerCase().includes(searchLower);
      const skuMatch = p.sku ? p.sku.toLowerCase().includes(searchLower) : false;
      const barcodeMatch = p.barcode ? p.barcode.toLowerCase().includes(searchLower) : false;
      if (!nameMatch && !skuMatch && !barcodeMatch) return false;
    }

    if (categoryLower) {
      if (!p.category || !p.category.toLowerCase().includes(categoryLower)) return false;
    }

    if (barcodeTrim) {
      if (!p.barcode || !p.barcode.toLowerCase().includes(barcodeTrim.toLowerCase())) return false;
    }

    return true;
  });
}

export function shouldShowSkeleton(dataState: ProductDataState): boolean {
  return dataState === 'loading';
}

export function shouldShowError(dataState: ProductDataState, error: string | null): boolean {
  return dataState === 'error' && error !== null;
}

export function shouldShowEmpty(products: ProductViewModel[], dataState: ProductDataState, error: string | null): boolean {
  return dataState === 'ready' && error === null && products.length === 0;
}

export function shouldShowGrid(products: ProductViewModel[], dataState: ProductDataState, error: string | null): boolean {
  return dataState === 'ready' && error === null && products.length > 0;
}

export function getEmptyTitle(hasFilter: boolean): string {
  if (hasFilter) return 'Tidak ada produk ditemukan';
  return 'Belum ada produk';
}

export function getEmptyDescription(hasFilter: boolean): string {
  if (hasFilter) return 'Coba sesuaikan filter pencarian Anda.';
  return 'Buat produk pertama untuk mulai mengelola katalog Anda.';
}

export function getEmptyActionLabel(hasFilter: boolean): string {
  return hasFilter ? 'Hapus Filter' : 'Tambah Produk';
}
