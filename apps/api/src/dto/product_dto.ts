import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'

export interface ProductDto {
  id: string
  business_id: string
  name: string
  description: string | null
  price_minor: number
  category: string | null
  barcode: string | null
  is_active: boolean
  server_version: number
  created_at: string
  updated_at: string
}

export interface ProductUpdateRequest {
  business_id: string
  expected_server_version: number
  name?: string
  description?: string | null
  price_minor?: number
  category?: string | null
  barcode?: string | null
  is_active?: boolean
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateProductUpdate(body: unknown): ProductUpdateRequest {
  if (!isObject(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  const errors: Record<string, string> = {}
  const businessId = body.business_id
  const expected = body.expected_server_version

  if (!isUuid(businessId)) {
    errors.business_id = 'business_id must be a valid UUID'
  }

  if (typeof expected !== 'number' || !Number.isInteger(expected) || expected < 1) {
    errors.expected_server_version = 'expected_server_version must be an integer >= 1'
  }

  const result: ProductUpdateRequest = {
    business_id: isUuid(businessId) ? businessId.trim() : '',
    expected_server_version: typeof expected === 'number' ? expected : 0
  }

  let hasPatch = false

  if ('name' in body) {
    hasPatch = true
    const value = body.name
    if (typeof value !== 'string' || value.trim().length === 0) {
      errors.name = 'name must be a non-empty string'
    } else {
      result.name = value.trim()
    }
  }

  if ('description' in body) {
    hasPatch = true
    const value = body.description
    if (value === null) {
      result.description = null
    } else if (typeof value === 'string') {
      result.description = value
    } else {
      errors.description = 'description must be a string or null'
    }
  }

  if ('price_minor' in body) {
    hasPatch = true
    const value = body.price_minor
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      errors.price_minor = 'price_minor must be a non-negative integer'
    } else {
      result.price_minor = value
    }
  }

  if ('category' in body) {
    hasPatch = true
    const value = body.category
    if (value === null) {
      result.category = null
    } else if (typeof value === 'string') {
      result.category = value
    } else {
      errors.category = 'category must be a string or null'
    }
  }

  if ('barcode' in body) {
    hasPatch = true
    const value = body.barcode
    if (value === null) {
      result.barcode = null
    } else if (typeof value === 'string') {
      result.barcode = value
    } else {
      errors.barcode = 'barcode must be a string or null'
    }
  }

  if ('is_active' in body) {
    hasPatch = true
    const value = body.is_active
    if (typeof value !== 'boolean') {
      errors.is_active = 'is_active must be a boolean'
    } else {
      result.is_active = value
    }
  }

  if (!hasPatch) {
    errors.body = 'At least one updatable product field is required'
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Product update validation failed', errors)
  }

  return result
}


export interface ProductCreateRequest { id: string; business_id: string; name: string; description?: string | null; price_minor: number; category?: string | null; barcode?: string | null; is_active?: boolean; }

export function validateProductCreate(body: unknown): ProductCreateRequest {
  if (!isObject(body)) throw new ValidationError('Request body must be a JSON object')
  const errors: Record<string, string> = {}
  const id = body.id; const businessId = body.business_id; const name = body.name; const priceMinor = body.price_minor
  if (typeof id !== 'string' || !isUuid(id)) errors.id = 'id must be a valid UUID'
  if (typeof businessId !== 'string' || !isUuid(businessId)) errors.business_id = 'business_id must be a valid UUID'
  if (typeof name !== 'string' || name.trim().length === 0) errors.name = 'name must be a non-empty string'
  if (typeof priceMinor !== 'number' || !Number.isInteger(priceMinor) || priceMinor < 0) errors.price_minor = 'price_minor must be a non-negative integer'
  const result: any = { id: typeof id === 'string' ? id.trim() : '', business_id: typeof businessId === 'string' ? businessId.trim() : '', name: typeof name === 'string' ? name.trim() : '', price_minor: typeof priceMinor === 'number' ? priceMinor : 0 }
  if ('description' in body) { if (body.description === null) result.description = null; else if (typeof body.description === 'string') result.description = body.description; else errors.description = 'description must be a string or null' }
  if ('category' in body) { if (body.category === null) result.category = null; else if (typeof body.category === 'string') result.category = body.category; else errors.category = 'category must be a string or null' }
  if ('barcode' in body) { if (body.barcode === null || body.barcode === '') result.barcode = null; else if (typeof body.barcode === 'string') result.barcode = body.barcode.trim(); else errors.barcode = 'barcode must be a string or null' }
  if ('is_active' in body) { if (typeof body.is_active === 'boolean') result.is_active = body.is_active; else errors.is_active = 'is_active must be a boolean' } else { result.is_active = true }
  if (Object.keys(errors).length > 0) throw new ValidationError('Product create validation failed', errors)
  return result
}
