import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'

export interface ProductDto {
  id: string
  business_id: string
  name: string
  description: string | null
  sku: string | null
  price_minor: number
  cost_minor: number | null
  category: string | null
  barcode: string | null
  image_url: string | null
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
  sku?: string | null
  price_minor?: number
  cost_minor?: number | null
  category?: string | null
  barcode?: string | null
  image_url?: string | null
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

  if ('sku' in body) {
    hasPatch = true
    const value = body.sku
    if (value === null) {
      result.sku = null
    } else if (typeof value === 'string') {
      result.sku = value.trim() === '' ? null : value.trim()
    } else {
      errors.sku = 'sku must be a string or null'
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

  if ('cost_minor' in body) {
    hasPatch = true
    const value = body.cost_minor
    if (value === null) {
      result.cost_minor = null
    } else if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      errors.cost_minor = 'cost_minor must be a non-negative integer or null'
    } else {
      result.cost_minor = value
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

  if ('image_url' in body) {
    hasPatch = true
    const value = body.image_url
    if (value === null) {
      result.image_url = null
    } else if (typeof value === 'string') {
      result.image_url = value.trim() === '' ? null : value.trim()
    } else {
      errors.image_url = 'image_url must be a string or null'
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

export interface ProductListQuery {
  business_id: string
  search?: string
  category?: string
  barcode?: string
  limit: number
  offset: number
}

export function validateProductListQuery(query: unknown): ProductListQuery {
  if (!isObject(query)) throw new ValidationError('Query must be a valid object')
  const errors: Record<string, string> = {}

  const businessId = typeof query.business_id === 'string' && query.business_id.trim().length > 0
    ? query.business_id.trim()
    : undefined

  if (!businessId || !isUuid(businessId)) {
    errors.business_id = 'business_id must be a valid UUID'
  }

  const limit = typeof query.limit === 'string' || typeof query.limit === 'number'
    ? Number(query.limit)
    : 50
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    errors.limit = 'limit must be an integer between 1 and 500'
  }

  const offset = typeof query.offset === 'string' || typeof query.offset === 'number'
    ? Number(query.offset)
    : 0
  if (!Number.isInteger(offset) || offset < 0) {
    errors.offset = 'offset must be a non-negative integer'
  }

  const result: ProductListQuery = {
    business_id: businessId ?? '',
    limit: Number.isInteger(limit) && limit >= 1 && limit <= 500 ? limit : 50,
    offset: Number.isInteger(offset) && offset >= 0 ? offset : 0,
  }

  if (query.search !== undefined) {
    if (typeof query.search !== 'string') {
      errors.search = 'search must be a string'
    } else if (query.search.trim().length > 0) {
      result.search = query.search.trim()
    }
  }

  if (query.category !== undefined) {
    if (typeof query.category !== 'string') {
      errors.category = 'category must be a string'
    } else if (query.category.trim().length > 0) {
      result.category = query.category.trim()
    }
  }

  if (query.barcode !== undefined) {
    if (typeof query.barcode !== 'string') {
      errors.barcode = 'barcode must be a string'
    } else if (query.barcode.trim().length > 0) {
      result.barcode = query.barcode.trim()
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Product list query validation failed', errors)
  }

  return result
}

export interface ProductCreateRequest {
  id: string
  business_id: string
  name: string
  description?: string | null
  sku?: string | null
  price_minor: number
  cost_minor?: number | null
  category?: string | null
  barcode?: string | null
  image_url?: string | null
  is_active?: boolean
}

export function validateProductCreate(body: unknown): ProductCreateRequest {
  if (!isObject(body)) throw new ValidationError('Request body must be a JSON object')
  const errors: Record<string, string> = {}
  const id = body.id
  const businessId = body.business_id
  const name = body.name
  const priceMinor = body.price_minor

  if (typeof id !== 'string' || !isUuid(id)) errors.id = 'id must be a valid UUID'
  if (typeof businessId !== 'string' || !isUuid(businessId)) errors.business_id = 'business_id must be a valid UUID'
  if (typeof name !== 'string' || name.trim().length === 0) errors.name = 'name must be a non-empty string'
  if (typeof priceMinor !== 'number' || !Number.isInteger(priceMinor) || priceMinor < 0) errors.price_minor = 'price_minor must be a non-negative integer'

  const result: any = {
    id: typeof id === 'string' ? id.trim() : '',
    business_id: typeof businessId === 'string' ? businessId.trim() : '',
    name: typeof name === 'string' ? name.trim() : '',
    price_minor: typeof priceMinor === 'number' ? priceMinor : 0
  }

  if ('description' in body) {
    if (body.description === null) result.description = null
    else if (typeof body.description === 'string') result.description = body.description
    else errors.description = 'description must be a string or null'
  }

  if ('sku' in body) {
    if (body.sku === null || body.sku === '') result.sku = null
    else if (typeof body.sku === 'string') result.sku = body.sku.trim()
    else errors.sku = 'sku must be a string or null'
  }

  if ('cost_minor' in body) {
    if (body.cost_minor === null) result.cost_minor = null
    else if (typeof body.cost_minor === 'number' && Number.isInteger(body.cost_minor) && body.cost_minor >= 0) result.cost_minor = body.cost_minor
    else errors.cost_minor = 'cost_minor must be a non-negative integer or null'
  }

  if ('category' in body) {
    if (body.category === null) result.category = null
    else if (typeof body.category === 'string') result.category = body.category
    else errors.category = 'category must be a string or null'
  }

  if ('barcode' in body) {
    if (body.barcode === null || body.barcode === '') result.barcode = null
    else if (typeof body.barcode === 'string') result.barcode = body.barcode.trim()
    else errors.barcode = 'barcode must be a string or null'
  }

  if ('image_url' in body) {
    if (body.image_url === null || body.image_url === '') result.image_url = null
    else if (typeof body.image_url === 'string') result.image_url = body.image_url.trim()
    else errors.image_url = 'image_url must be a string or null'
  }

  if ('is_active' in body) {
    if (typeof body.is_active === 'boolean') result.is_active = body.is_active
    else errors.is_active = 'is_active must be a boolean'
  } else {
    result.is_active = true
  }

  if (Object.keys(errors).length > 0) throw new ValidationError('Product create validation failed', errors)
  return result
}
