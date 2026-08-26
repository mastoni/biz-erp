import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'

export interface StockDto {
  id: string
  business_id: string
  branch_id: string
  product_id: string
  quantity: number
  server_version: number
  created_at: string
  updated_at: string
}

export interface StockMovementDto {
  id: string
  business_id: string
  branch_id: string
  product_id: string
  quantity: number
  movement_type: string
  reference: string | null
  actor: string
  timestamp: string
}

export interface StockMovementPaginatedResponse {
  items: StockMovementDto[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export interface StockSummaryDto {
  total_stock_value_minor: number
  low_stock_count: number
  out_of_stock_count: number
  total_skus: number
}

export interface StockWithProductDto {
  id: string
  business_id: string
  branch_id: string
  product_id: string
  product_name: string
  sku: string | null
  category: string | null
  barcode: string | null
  price_minor: number
  cost_minor: number | null
  quantity: number
  server_version: number
  created_at: string
  updated_at: string
}

export type MovementType = 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT'

export interface StockAdjustmentRequest {
  business_id: string
  branch_id: string
  product_id: string
  quantity_change: number
  expected_server_version: number
  reference?: string | null
  movement_type?: MovementType
}

export const VALID_MOVEMENT_TYPES = ['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT'] as const

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateStockAdjustment(body: unknown): StockAdjustmentRequest {
  if (!isObject(body)) throw new ValidationError('Request body must be a JSON object')
  const errors: Record<string, string> = {}

  const businessId = body.business_id
  const branchId = body.branch_id
  const productId = body.product_id
  const quantityChange = body.quantity_change
  const expected = body.expected_server_version

  if (typeof businessId !== 'string' || !isUuid(businessId)) errors.business_id = 'business_id must be a valid UUID'
  if (typeof branchId !== 'string' || !isUuid(branchId)) errors.branch_id = 'branch_id must be a valid UUID'
  if (typeof productId !== 'string' || !isUuid(productId)) errors.product_id = 'product_id must be a valid UUID'

  if (typeof quantityChange !== 'number' || !Number.isInteger(quantityChange)) {
    errors.quantity_change = 'quantity_change must be an integer'
  }

  // expected_server_version is 0 for new stock, >= 1 for existing
  if (typeof expected !== 'number' || !Number.isInteger(expected) || expected < 0) {
    errors.expected_server_version = 'expected_server_version must be an integer >= 0'
  }

  const result: StockAdjustmentRequest = {
    business_id: typeof businessId === 'string' ? businessId.trim() : '',
    branch_id: typeof branchId === 'string' ? branchId.trim() : '',
    product_id: typeof productId === 'string' ? productId.trim() : '',
    quantity_change: typeof quantityChange === 'number' ? quantityChange : 0,
    expected_server_version: typeof expected === 'number' ? expected : 0
  }

  if ('movement_type' in body) {
    const mt = body.movement_type
    if (typeof mt !== 'string' || !VALID_MOVEMENT_TYPES.includes(mt as MovementType)) {
      errors.movement_type = 'movement_type must be one of: STOCK_IN, STOCK_OUT, ADJUSTMENT'
    } else {
      result.movement_type = mt as MovementType
    }
  }

  if ('reference' in body) {
    if (body.reference === null) {
      result.reference = null
    } else if (typeof body.reference === 'string') {
      result.reference = body.reference.trim()
    } else {
      errors.reference = 'reference must be a string or null'
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Stock adjustment validation failed', errors)
  }

  return result
}
