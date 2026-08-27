export type SupplierTerm = 'Tunai' | 'Tempo 14' | 'Tempo 30';

export type SupplierStatus = 'aktif' | 'nonaktif';

export type SupplierTone = 'pine' | 'tide' | 'fog' | 'clay';

export type SupplierErrorType =
  | 'code_conflict'
  | 'version_conflict'
  | 'validation_error'
  | 'forbidden'
  | 'not_found'
  | 'network_error'
  | 'unknown';

export type SuppliersDataState = 'loading' | 'ready' | 'empty' | 'error';
export type SuppliersMutationState = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

export interface Supplier {
  id: string;
  business_id: string;
  code: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  category: string | null;
  term: SupplierTerm;
  status: SupplierStatus;
  server_version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SupplierSummaryKPI {
  total_suppliers: number;
  active_suppliers: number;
  inactive_suppliers: number;
}

export interface SupplierListResponse {
  items: Supplier[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  summary?: SupplierSummaryKPI;
}

export interface SupplierViewModel {
  id: string;
  business_id: string;
  code: string;
  code_badge: string;
  name: string;
  contact: string;
  phone: string;
  email: string | null;
  category: string;
  term: SupplierTerm;
  term_tone: SupplierTone;
  status: SupplierStatus;
  status_tone: SupplierTone;
  server_version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SuppliersListViewModel {
  items: SupplierViewModel[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  summary: SupplierSummaryKPI;
}

export interface SupplierFilterModel {
  search?: string;
}

export interface SupplierCreateInput {
  id: string;
  business_id: string;
  name: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  category?: string | null;
  term?: SupplierTerm;
  status?: SupplierStatus;
}

export interface SupplierUpdateInput {
  business_id: string;
  expected_server_version: number;
  name?: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  category?: string | null;
  term?: SupplierTerm;
  status?: SupplierStatus;
}

export interface SupplierCreateFormModel {
  name: string;
  contact: string;
  phone: string;
  email: string;
  category: string;
  term: SupplierTerm;
}
