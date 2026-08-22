/**
 * Customer domain types — mirrors backend Customer DTO.
 *
 * deleted_at is included for sync tombstones.
 * server_version is included for optimistic locking.
 * phone and email are nullable.
 */

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  server_version: number;
  created_at: string;  // ISO 8601
  updated_at: string;  // ISO 8601
  deleted_at: string | null;
}

export interface CustomerListResponse {
  items: Customer[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface CustomerCreateInput {
  id: string;
  business_id: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface CustomerUpdateInput {
  business_id: string;
  expected_server_version: number;
  name?: string;
  phone?: string;
  email?: string;
}