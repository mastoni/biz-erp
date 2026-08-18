/**
 * Sales domain types — strictly mirrors backend SaleDtoResponse / SaleSyncListResponse.
 *
 * Field mapping:
 *   backend field           | TypeScript type
 *   ----------------------- | ---------------
 *   *_minor                 | number (integer, minor currency unit)
 *   client_created_at       | number (Unix epoch ms)
 *   server_created_at       | number (Unix epoch ms)
 *   payment_method          | string | null  (MUST NOT be cast to non-nullable)
 *   cashier_id              | string | null
 *   product_id              | string | null  (null = custom/free-text item)
 *   items[].subtotal_minor  | NOT PRESENT — backend does not return this field
 */

export interface SaleItem {
  product_id: string | null;
  product_name_snapshot: string;
  quantity: number;
  unit_price_minor: number;
  // NOTE: subtotal_minor is intentionally absent — not returned by backend
}

export interface Sale {
  id: string;
  idempotency_key: string;
  receipt_number: string;
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  grand_total_minor: number;
  payment_method: string | null;  // nullable — old records may omit
  cash_received_minor: number;
  change_minor: number;
  cashier_id: string | null;
  client_created_at: number;      // Unix epoch ms
  server_created_at: number;      // Unix epoch ms
  items: SaleItem[];
}

export interface SalesListResponse {
  sales: Sale[];
  has_more: boolean;
}

export interface SalesQueryParams {
  businessId: string;
  since?: number;   // Unix epoch ms, default 0
  limit?: number;   // 1–500, default 500
}
