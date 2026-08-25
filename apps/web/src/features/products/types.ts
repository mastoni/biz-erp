export interface Product {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price_minor: number;
  cost_minor: number | null;
  category: string | null;
  barcode: string | null;
  is_active: boolean;
  server_version: number;
  created_at: string;
  updated_at: string;
}

export interface ProductSyncResponse {
  items: Product[];
  current_version: number;
  has_more: boolean;
}

export interface ProductCreatePayload {
  id: string;
  business_id: string;
  name: string;
  price_minor: number;
  description?: string | null;
  sku?: string | null;
  cost_minor?: number | null;
  category?: string | null;
  barcode?: string | null;
  is_active?: boolean;
}

export interface ProductUpdatePayload {
  business_id: string;
  expected_server_version: number;
  name?: string;
  price_minor?: number;
  description?: string | null;
  sku?: string | null;
  cost_minor?: number | null;
  category?: string | null;
  barcode?: string | null;
  is_active?: boolean;
}
