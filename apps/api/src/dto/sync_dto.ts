import { ProductDto } from './product_dto'

export interface ProductSyncListResponse {
  items: ProductDto[]
  next_version: number
  has_more: boolean
}

export interface SaleSyncResult {
  idempotency_key: string
  status: 'created' | 'replayed'
  sale_id: string
  receipt_number: string
  server_created_at: string
}

export interface SalesBatchResponse {
  results: SaleSyncResult[]
  created_count: number
  replayed_count: number
}
