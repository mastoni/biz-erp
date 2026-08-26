/**
 * Customer domain & ViewModel types.
 */

export type CustomerTier = 'Reguler' | 'Silver' | 'Gold';

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  tier?: CustomerTier;
  points?: number;
  spend_minor?: number;
  last_visit_epoch?: number | null;
  server_version: number;
  created_at: string;  // ISO 8601
  updated_at: string;  // ISO 8601
  deleted_at: string | null;
}

export interface CustomerSummaryKPI {
  total_customers: number;
  gold_members: number;
  silver_members: number;
  regular_members: number;
  monthly_spend_minor: number;
}

export interface CustomerListResponse {
  items: Customer[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  summary?: CustomerSummaryKPI;
}

export interface CustomerViewModel {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string | null;
  tier: CustomerTier;
  points: number;
  spend_minor: number;
  last_visit: string;
  last_visit_epoch: number | null;
  initials: string;
  tier_tone: 'honey' | 'tide' | 'fog';
}

export interface CustomersListViewModel {
  items: CustomerViewModel[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  summary: CustomerSummaryKPI;
}

export interface CustomerFilterModel {
  search?: string;
  tier?: CustomerTier | 'Semua';
}

export type CustomersDataState = 'loading' | 'ready' | 'empty' | 'error';
export type CustomersMutationState = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

export interface CustomerCreateInput {
  id: string;
  business_id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  tier?: CustomerTier;
  points?: number;
}

export interface CustomerUpdateInput {
  business_id: string;
  expected_server_version: number;
  name?: string;
  phone?: string | null;
  email?: string | null;
  tier?: CustomerTier;
  points?: number;
}

export interface CustomerCreateFormModel {
  name: string;
  phone: string;
  tier: CustomerTier;
}
