import { ProductDto } from './product_dto'
import { CustomerDto } from './customer_dto'
import { SupplierDto } from './supplier_dto'

export interface ProductSyncListResponse {
  items: ProductDto[]
  current_version: number
  has_more: boolean
}

export interface CustomerSyncListResponse {
  items: CustomerDto[]
  current_version: number
  has_more: boolean
}

export interface SupplierSyncListResponse {
  items: SupplierDto[]
  current_version: number
  has_more: boolean
}

export interface SaleSyncResult {
  idempotency_key: string
  status: 'created' | 'replayed' | 'receipt_conflict'
  sale_id: string
  receipt_number: string
  server_created_at: string
}

export interface SalesBatchResponse {
  results: SaleSyncResult[]
  created_count: number
  replayed_count: number
}

export interface SaleItemDtoResponse {
  product_id: string | null
  product_name_snapshot: string
  quantity: number
  unit_price_minor: number
}

export interface SaleDtoResponse {
  id: string
  idempotency_key: string
  receipt_number: string
  subtotal_minor: number
  discount_minor: number
  tax_minor: number
  grand_total_minor: number
  payment_method: string | null
  cash_received_minor: number
  change_minor: number
  cashier_id: string | null
  client_created_at: number
  server_created_at: number
  items: SaleItemDtoResponse[]
}

export interface SaleSyncListResponse {
  sales: SaleDtoResponse[]
  has_more: boolean
}
