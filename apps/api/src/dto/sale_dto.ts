import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'

export interface SalePayload {
  id: string
  receipt_number: string
  subtotal_minor: number | null
  discount_minor: number | null
  tax_minor: number | null
  total_minor: number
  payment_method: string | null
  paid_minor: number | null
  change_minor: number | null
  cashier_id: string | null
  created_at: string | null
  client_created_at: string | null
}

export interface SaleItemPayload {
  id?: string
  product_id: string | null
  product_name: string
  quantity: number
  unit_price_minor: number
  subtotal_minor: number
}

export interface SalesBatchItemPayload {
  idempotency_key: string
  request_hash: string
  sale: SalePayload
  sale_items: SaleItemPayload[]
}

export interface SalesBatchRequest {
  business_id: string
  items: SalesBatchItemPayload[]
}

type Errors = Record<string, string>

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateOptionalTimestamp(raw: Record<string, unknown>, field: string, path: string, errors: Errors): string | null {
  const value = raw[field]

  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== 'string' || Number.isNaN(new Date(value).getTime())) {
    errors[`${path}.${field}`] = `${field} must be an ISO-8601 timestamp or null`
    return null
  }

  return value
}

function validateOptionalNonNegativeInteger(raw: Record<string, unknown>, field: string, path: string, errors: Errors): number | null {
  const value = raw[field]

  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    errors[`${path}.${field}`] = `${field} must be a non-negative integer or null`
    return null
  }

  return value
}

function validateSale(raw: unknown, path: string, errors: Errors): SalePayload | undefined {
  if (!isObject(raw)) {
    errors[path] = 'sale must be an object'
    return undefined
  }

  const id = raw.id
  const receiptNumber = raw.receipt_number
  const totalMinor = raw.total_minor

  if (!isUuid(id)) {
    errors[`${path}.id`] = 'sale.id must be a valid UUID'
  }

  if (typeof receiptNumber !== 'string' || receiptNumber.trim().length === 0) {
    errors[`${path}.receipt_number`] = 'receipt_number is required'
  }

  if (typeof totalMinor !== 'number' || !Number.isInteger(totalMinor) || totalMinor < 0) {
    errors[`${path}.total_minor`] = 'total_minor must be a non-negative integer'
  }

  const paymentMethod = raw.payment_method
  const cashierId = raw.cashier_id

  if (paymentMethod !== undefined && paymentMethod !== null && typeof paymentMethod !== 'string') {
    errors[`${path}.payment_method`] = 'payment_method must be a string or null'
  }

  if (cashierId !== undefined && cashierId !== null && typeof cashierId !== 'string') {
    errors[`${path}.cashier_id`] = 'cashier_id must be a string or null'
  }

  const sale: SalePayload = {
    id: isUuid(id) ? id.trim() : '',
    receipt_number: typeof receiptNumber === 'string' ? receiptNumber.trim() : '',
    subtotal_minor: validateOptionalNonNegativeInteger(raw, 'subtotal_minor', path, errors),
    discount_minor: validateOptionalNonNegativeInteger(raw, 'discount_minor', path, errors),
    tax_minor: validateOptionalNonNegativeInteger(raw, 'tax_minor', path, errors),
    total_minor: typeof totalMinor === 'number' ? totalMinor : 0,
    payment_method: paymentMethod === undefined || paymentMethod === null ? null : String(paymentMethod),
    paid_minor: validateOptionalNonNegativeInteger(raw, 'paid_minor', path, errors),
    change_minor: validateOptionalNonNegativeInteger(raw, 'change_minor', path, errors),
    cashier_id: cashierId === undefined || cashierId === null ? null : String(cashierId),
    created_at: validateOptionalTimestamp(raw, 'created_at', path, errors),
    client_created_at: validateOptionalTimestamp(raw, 'client_created_at', path, errors)
  }

  return sale
}

function validateSaleItems(raw: unknown, path: string, errors: Errors): SaleItemPayload[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors[path] = 'sale_items must be a non-empty array'
    return undefined
  }

  const items: SaleItemPayload[] = []

  raw.forEach((rawItem, index) => {
    const itemPath = `${path}[${index}]`

    if (!isObject(rawItem)) {
      errors[itemPath] = 'sale item must be an object'
      return
    }

    const productName = rawItem.product_name
    const quantity = rawItem.quantity
    const unitPriceMinor = rawItem.unit_price_minor
    const subtotalMinor = rawItem.subtotal_minor
    const id = rawItem.id
    const productId = rawItem.product_id

    if (typeof productName !== 'string' || productName.trim().length === 0) {
      errors[`${itemPath}.product_name`] = 'product_name is required'
    }

    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
      errors[`${itemPath}.quantity`] = 'quantity must be a positive integer'
    }

    if (typeof unitPriceMinor !== 'number' || !Number.isInteger(unitPriceMinor) || unitPriceMinor < 0) {
      errors[`${itemPath}.unit_price_minor`] = 'unit_price_minor must be a non-negative integer'
    }

    if (typeof subtotalMinor !== 'number' || !Number.isInteger(subtotalMinor) || subtotalMinor < 0) {
      errors[`${itemPath}.subtotal_minor`] = 'subtotal_minor must be a non-negative integer'
    }

    if (id !== undefined && id !== null && !isUuid(id)) {
      errors[`${itemPath}.id`] = 'id must be a valid UUID or null/omitted'
    }

    if (productId !== undefined && productId !== null && productId !== '' && !isUuid(productId)) {
      errors[`${itemPath}.product_id`] = 'product_id must be a valid UUID or null'
    }

    const hasItemErrors =
      Boolean(errors[`${itemPath}.product_name`]) ||
      Boolean(errors[`${itemPath}.quantity`]) ||
      Boolean(errors[`${itemPath}.unit_price_minor`]) ||
      Boolean(errors[`${itemPath}.subtotal_minor`]) ||
      Boolean(errors[`${itemPath}.id`]) ||
      Boolean(errors[`${itemPath}.product_id`])

    if (!hasItemErrors) {
      items.push({
        id: typeof id === 'string' ? id.trim() : undefined,
        product_id: productId === undefined || productId === null || productId === '' ? null : String(productId).trim(),
        product_name: String(productName).trim(),
        quantity: Number(quantity),
        unit_price_minor: Number(unitPriceMinor),
        subtotal_minor: Number(subtotalMinor)
      })
    }
  })

  return items
}

export function validateSalesBatch(body: unknown): SalesBatchRequest {
  if (!isObject(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  const errors: Errors = {}
  const businessId = body.business_id

  if (!isUuid(businessId)) {
    errors.business_id = 'business_id must be a valid UUID'
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.items = 'items must be a non-empty array'
  }

  const seenKeys = new Set<string>()
  const items: SalesBatchItemPayload[] = []

  if (Array.isArray(body.items)) {
    body.items.forEach((rawItem, index) => {
      const itemPath = `items[${index}]`

      if (!isObject(rawItem)) {
        errors[itemPath] = 'batch item must be an object'
        return
      }

      const idempotencyKey = rawItem.idempotency_key
      const requestHash = rawItem.request_hash

      if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
        errors[`${itemPath}.idempotency_key`] = 'idempotency_key is required'
      } else {
        const normalized = idempotencyKey.trim().toLowerCase()
        if (seenKeys.has(normalized)) {
          errors[`${itemPath}.idempotency_key`] = 'idempotency_key is duplicated in this batch'
        }
        seenKeys.add(normalized)
      }

      if (typeof requestHash !== 'string' || requestHash.trim().length === 0) {
        errors[`${itemPath}.request_hash`] = 'request_hash is required'
      }

      const sale = validateSale(rawItem.sale, `${itemPath}.sale`, errors)
      const saleItems = validateSaleItems(rawItem.sale_items, `${itemPath}.sale_items`, errors)

      const hasBlockingError = Boolean(errors[`${itemPath}.idempotency_key`]) || Boolean(errors[`${itemPath}.request_hash`]) || !sale || !saleItems

      if (!hasBlockingError && sale && saleItems) {
        items.push({
          idempotency_key: String(idempotencyKey).trim(),
          request_hash: String(requestHash).trim(),
          sale,
          sale_items: saleItems
        })
      }
    })
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Sales batch validation failed', errors)
  }

  return {
    business_id: String(businessId).trim(),
    items
  }
}
