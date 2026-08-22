/**
 * Customer domain types — mirrors backend Customer DTO.
 *
 * deleted_at is intentionally NOT present (excluded from public API).
 * phone and email are nullable.
 */

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;  // ISO 8601
  updated_at: string;  // ISO 8601
}

export interface CustomerListResponse {
  items: Customer[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface CustomerCreateInput {
  business_id: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface CustomerUpdateInput {
  business_id: string;
  name?: string;
  phone?: string;
  email?: string;
}
