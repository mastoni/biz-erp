import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'

// ---------------------------------------------------------------------------
// Canonical Types & Enums
// ---------------------------------------------------------------------------

export type CustomerSubscriptionBillingCycle =
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMI_ANNUAL'
  | 'ANNUAL'

export type CustomerSubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED'

export const VALID_CUSTOMER_BILLING_CYCLES: CustomerSubscriptionBillingCycle[] = [
  'MONTHLY',
  'QUARTERLY',
  'SEMI_ANNUAL',
  'ANNUAL'
]

export const VALID_CUSTOMER_SUBSCRIPTION_STATUSES: CustomerSubscriptionStatus[] = [
  'ACTIVE',
  'PAUSED',
  'CANCELLED'
]

// ---------------------------------------------------------------------------
// Response DTOs
// ---------------------------------------------------------------------------

export interface CustomerSubscriptionDto {
  id: string
  business_id: string
  customer_id: string
  customer_name?: string
  plan_code: string | null
  product_id: string | null
  name: string
  unit_price_minor: number
  discount_minor: number
  tax_minor: number
  total_minor: number
  currency: string
  billing_cycle: CustomerSubscriptionBillingCycle
  status: CustomerSubscriptionStatus
  starts_at: string
  ends_at: string | null
  next_billing_date: string
  anchor_day: number
  notes: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CustomerSubscriptionDetailDto extends CustomerSubscriptionDto {
  invoices_count?: number
  total_billed_minor?: number
  total_paid_minor?: number
}

export interface CustomerSubscriptionListResponse {
  items: CustomerSubscriptionDto[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

// ---------------------------------------------------------------------------
// Request Interfaces
// ---------------------------------------------------------------------------

export interface CreateCustomerSubscriptionRequest {
  customer_id: string
  plan_code?: string | null
  product_id?: string | null
  name: string
  unit_price_minor: number
  discount_minor?: number
  tax_minor?: number
  total_minor?: number
  currency?: string
  billing_cycle: CustomerSubscriptionBillingCycle
  starts_at?: string
  ends_at?: string | null
  next_billing_date?: string
  anchor_day?: number
  notes?: string | null
  metadata?: Record<string, unknown>
}

export interface UpdateCustomerSubscriptionRequest {
  // Operational fields (OWNER + STAFF)
  name?: string
  notes?: string | null
  metadata?: Record<string, unknown>
  ends_at?: string | null

  // Financial price snapshot fields (OWNER only)
  unit_price_minor?: number
  discount_minor?: number
  tax_minor?: number
  total_minor?: number
  billing_cycle?: CustomerSubscriptionBillingCycle
}

export interface SubscriptionActionRequest {
  reason?: string
}

export interface GenerateInvoiceRequest {
  billing_period_start?: string
  billing_period_end?: string
  due_date?: string
  notes?: string | null
}

export interface CustomerSubscriptionQuery {
  customer_id?: string
  status?: CustomerSubscriptionStatus
  billing_cycle?: CustomerSubscriptionBillingCycle
  search?: string
  limit?: number
  offset?: number
}

// ---------------------------------------------------------------------------
// Helper: Distinguish Financial Updates from Operational Updates (for RBAC)
// ---------------------------------------------------------------------------

export function isFinancialSubscriptionUpdate(
  dto: UpdateCustomerSubscriptionRequest
): boolean {
  return (
    dto.unit_price_minor !== undefined ||
    dto.discount_minor !== undefined ||
    dto.tax_minor !== undefined ||
    dto.total_minor !== undefined ||
    dto.billing_cycle !== undefined
  )
}

// ---------------------------------------------------------------------------
// Validation & Normalization Functions
// ---------------------------------------------------------------------------

function validateNonNegativeMinor(val: unknown, fieldName: string): number {
  if (typeof val !== 'number' || !Number.isInteger(val) || val < 0) {
    throw new ValidationError(`${fieldName} must be a non-negative integer in minor currency units`)
  }
  return val
}

function isValidIsoDate(str: string): boolean {
  const d = new Date(str)
  return !isNaN(d.getTime())
}

function isValidDateOnlyString(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(Date.parse(str))
}

export function validateCreateCustomerSubscription(
  body: unknown
): CreateCustomerSubscriptionRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  const b = body as Record<string, unknown>

  // customer_id (required UUID)
  if (!b.customer_id || typeof b.customer_id !== 'string' || !isUuid(b.customer_id)) {
    throw new ValidationError('customer_id is required and must be a valid UUID')
  }

  // name (required string)
  if (typeof b.name !== 'string' || b.name.trim().length === 0) {
    throw new ValidationError('name is required and cannot be empty')
  }
  const name = b.name.trim()

  // plan_code (optional string)
  let plan_code: string | null | undefined = undefined
  if (b.plan_code !== undefined) {
    if (b.plan_code === null || b.plan_code === '') {
      plan_code = null
    } else if (typeof b.plan_code === 'string') {
      plan_code = b.plan_code.trim()
    } else {
      throw new ValidationError('plan_code must be a string or null')
    }
  }

  // product_id (optional UUID)
  let product_id: string | null | undefined = undefined
  if (b.product_id !== undefined) {
    if (b.product_id === null || b.product_id === '') {
      product_id = null
    } else if (typeof b.product_id === 'string' && isUuid(b.product_id)) {
      product_id = b.product_id
    } else {
      throw new ValidationError('product_id must be a valid UUID or null')
    }
  }

  // unit_price_minor (required)
  if (b.unit_price_minor === undefined || b.unit_price_minor === null) {
    throw new ValidationError('unit_price_minor is required')
  }
  const unit_price_minor = validateNonNegativeMinor(b.unit_price_minor, 'unit_price_minor')

  // discount_minor (optional, default 0)
  const discount_minor =
    b.discount_minor !== undefined && b.discount_minor !== null
      ? validateNonNegativeMinor(b.discount_minor, 'discount_minor')
      : 0

  if (discount_minor > unit_price_minor) {
    throw new ValidationError('discount_minor cannot exceed unit_price_minor')
  }

  // tax_minor (optional, default 0)
  const tax_minor =
    b.tax_minor !== undefined && b.tax_minor !== null
      ? validateNonNegativeMinor(b.tax_minor, 'tax_minor')
      : 0

  // total_minor (optional or computed)
  const computedTotal = unit_price_minor - discount_minor + tax_minor
  let total_minor = computedTotal
  if (b.total_minor !== undefined && b.total_minor !== null) {
    const providedTotal = validateNonNegativeMinor(b.total_minor, 'total_minor')
    if (providedTotal !== computedTotal) {
      throw new ValidationError(
        `total_minor (${providedTotal}) must equal unit_price_minor - discount_minor + tax_minor (${computedTotal})`
      )
    }
    total_minor = providedTotal
  }

  // currency (optional, default IDR)
  let currency = 'IDR'
  if (b.currency !== undefined && b.currency !== null) {
    if (typeof b.currency !== 'string' || b.currency.trim().length === 0) {
      throw new ValidationError('currency must be a non-empty string')
    }
    currency = b.currency.trim().toUpperCase()
  }

  // billing_cycle (required)
  if (!b.billing_cycle || typeof b.billing_cycle !== 'string') {
    throw new ValidationError('billing_cycle is required')
  }
  const billing_cycle = b.billing_cycle.toUpperCase() as CustomerSubscriptionBillingCycle
  if (!VALID_CUSTOMER_BILLING_CYCLES.includes(billing_cycle)) {
    throw new ValidationError(
      `billing_cycle must be one of: ${VALID_CUSTOMER_BILLING_CYCLES.join(', ')}`
    )
  }

  // starts_at (optional TIMESTAMPTZ, default now)
  let starts_at: string | undefined = undefined
  if (b.starts_at !== undefined && b.starts_at !== null) {
    if (typeof b.starts_at !== 'string' || !isValidIsoDate(b.starts_at)) {
      throw new ValidationError('starts_at must be a valid ISO date/time string')
    }
    starts_at = new Date(b.starts_at).toISOString()
  }

  // ends_at (optional TIMESTAMPTZ)
  let ends_at: string | null | undefined = undefined
  if (b.ends_at !== undefined) {
    if (b.ends_at === null || b.ends_at === '') {
      ends_at = null
    } else if (typeof b.ends_at === 'string' && isValidIsoDate(b.ends_at)) {
      ends_at = new Date(b.ends_at).toISOString()
      const startDate = starts_at ? new Date(starts_at) : new Date()
      if (new Date(ends_at) <= startDate) {
        throw new ValidationError('ends_at must be strictly after starts_at')
      }
    } else {
      throw new ValidationError('ends_at must be a valid ISO date/time string or null')
    }
  }

  // anchor_day (optional, 1..31)
  let anchor_day: number | undefined = undefined
  if (b.anchor_day !== undefined && b.anchor_day !== null) {
    if (typeof b.anchor_day !== 'number' || !Number.isInteger(b.anchor_day) || b.anchor_day < 1 || b.anchor_day > 31) {
      throw new ValidationError('anchor_day must be an integer between 1 and 31')
    }
    anchor_day = b.anchor_day
  }

  // next_billing_date (optional DATE, YYYY-MM-DD)
  let next_billing_date: string | undefined = undefined
  if (b.next_billing_date !== undefined && b.next_billing_date !== null) {
    if (typeof b.next_billing_date !== 'string' || !isValidDateOnlyString(b.next_billing_date)) {
      throw new ValidationError('next_billing_date must be a valid date in YYYY-MM-DD format')
    }
    next_billing_date = b.next_billing_date
  }

  // notes (optional string)
  let notes: string | null | undefined = undefined
  if (b.notes !== undefined) {
    notes = b.notes === null ? null : typeof b.notes === 'string' ? b.notes.trim() : String(b.notes)
  }

  // metadata (optional JSON object)
  let metadata: Record<string, unknown> | undefined = undefined
  if (b.metadata !== undefined && b.metadata !== null) {
    if (typeof b.metadata !== 'object' || Array.isArray(b.metadata)) {
      throw new ValidationError('metadata must be a JSON object')
    }
    metadata = b.metadata as Record<string, unknown>
  }

  return {
    customer_id: b.customer_id as string,
    plan_code,
    product_id,
    name,
    unit_price_minor,
    discount_minor,
    tax_minor,
    total_minor,
    currency,
    billing_cycle,
    starts_at,
    ends_at,
    next_billing_date,
    anchor_day,
    notes,
    metadata
  }
}

export function validateUpdateCustomerSubscription(
  body: unknown
): UpdateCustomerSubscriptionRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  const b = body as Record<string, unknown>
  const result: UpdateCustomerSubscriptionRequest = {}
  let hasField = false

  // Operational: name
  if (b.name !== undefined) {
    if (typeof b.name !== 'string' || b.name.trim().length === 0) {
      throw new ValidationError('name must be a non-empty string')
    }
    result.name = b.name.trim()
    hasField = true
  }

  // Operational: notes
  if (b.notes !== undefined) {
    result.notes = b.notes === null ? null : typeof b.notes === 'string' ? b.notes.trim() : String(b.notes)
    hasField = true
  }

  // Operational: metadata
  if (b.metadata !== undefined) {
    if (b.metadata !== null && (typeof b.metadata !== 'object' || Array.isArray(b.metadata))) {
      throw new ValidationError('metadata must be a JSON object')
    }
    result.metadata = b.metadata as Record<string, unknown>
    hasField = true
  }

  // Operational: ends_at
  if (b.ends_at !== undefined) {
    if (b.ends_at === null || b.ends_at === '') {
      result.ends_at = null
    } else if (typeof b.ends_at === 'string' && isValidIsoDate(b.ends_at)) {
      result.ends_at = new Date(b.ends_at).toISOString()
    } else {
      throw new ValidationError('ends_at must be a valid ISO date/time string or null')
    }
    hasField = true
  }

  // Financial: unit_price_minor
  if (b.unit_price_minor !== undefined) {
    result.unit_price_minor = validateNonNegativeMinor(b.unit_price_minor, 'unit_price_minor')
    hasField = true
  }

  // Financial: discount_minor
  if (b.discount_minor !== undefined) {
    result.discount_minor = validateNonNegativeMinor(b.discount_minor, 'discount_minor')
    hasField = true
  }

  // Financial: tax_minor
  if (b.tax_minor !== undefined) {
    result.tax_minor = validateNonNegativeMinor(b.tax_minor, 'tax_minor')
    hasField = true
  }

  // Financial: total_minor
  if (b.total_minor !== undefined) {
    result.total_minor = validateNonNegativeMinor(b.total_minor, 'total_minor')
    hasField = true
  }

  // Financial: billing_cycle
  if (b.billing_cycle !== undefined) {
    if (typeof b.billing_cycle !== 'string') {
      throw new ValidationError('billing_cycle must be a string')
    }
    const cycle = b.billing_cycle.toUpperCase() as CustomerSubscriptionBillingCycle
    if (!VALID_CUSTOMER_BILLING_CYCLES.includes(cycle)) {
      throw new ValidationError(
        `billing_cycle must be one of: ${VALID_CUSTOMER_BILLING_CYCLES.join(', ')}`
      )
    }
    result.billing_cycle = cycle
    hasField = true
  }

  if (!hasField) {
    throw new ValidationError('At least one field must be provided for update')
  }

  return result
}

export function validateSubscriptionAction(body: unknown): SubscriptionActionRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {}
  }
  const b = body as Record<string, unknown>
  let reason: string | undefined = undefined
  if (b.reason !== undefined && b.reason !== null) {
    if (typeof b.reason !== 'string') {
      throw new ValidationError('reason must be a string')
    }
    reason = b.reason.trim()
  }
  return { reason }
}

export function validateGenerateInvoice(body: unknown): GenerateInvoiceRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {}
  }
  const b = body as Record<string, unknown>
  const result: GenerateInvoiceRequest = {}

  if (b.billing_period_start !== undefined && b.billing_period_start !== null) {
    if (typeof b.billing_period_start !== 'string' || !isValidDateOnlyString(b.billing_period_start)) {
      throw new ValidationError('billing_period_start must be a valid date in YYYY-MM-DD format')
    }
    result.billing_period_start = b.billing_period_start
  }

  if (b.billing_period_end !== undefined && b.billing_period_end !== null) {
    if (typeof b.billing_period_end !== 'string' || !isValidDateOnlyString(b.billing_period_end)) {
      throw new ValidationError('billing_period_end must be a valid date in YYYY-MM-DD format')
    }
    result.billing_period_end = b.billing_period_end
  }

  if (result.billing_period_start && result.billing_period_end) {
    if (result.billing_period_end <= result.billing_period_start) {
      throw new ValidationError('billing_period_end must be strictly after billing_period_start')
    }
  }

  if (b.due_date !== undefined && b.due_date !== null) {
    if (typeof b.due_date !== 'string' || !isValidDateOnlyString(b.due_date)) {
      throw new ValidationError('due_date must be a valid date in YYYY-MM-DD format')
    }
    result.due_date = b.due_date
  }

  if (b.notes !== undefined) {
    result.notes = b.notes === null ? null : typeof b.notes === 'string' ? b.notes.trim() : String(b.notes)
  }

  return result
}

export function validateSubscriptionQuery(
  query: unknown
): CustomerSubscriptionQuery {
  if (!query || typeof query !== 'object') {
    return {}
  }
  const q = query as Record<string, unknown>
  const result: CustomerSubscriptionQuery = {}

  if (q.customer_id !== undefined && q.customer_id !== '') {
    if (typeof q.customer_id !== 'string' || !isUuid(q.customer_id)) {
      throw new ValidationError('customer_id must be a valid UUID')
    }
    result.customer_id = q.customer_id
  }

  if (q.status !== undefined && q.status !== '') {
    if (typeof q.status !== 'string') {
      throw new ValidationError('status must be a string')
    }
    const status = q.status.toUpperCase() as CustomerSubscriptionStatus
    if (!VALID_CUSTOMER_SUBSCRIPTION_STATUSES.includes(status)) {
      throw new ValidationError(
        `status must be one of: ${VALID_CUSTOMER_SUBSCRIPTION_STATUSES.join(', ')}`
      )
    }
    result.status = status
  }

  if (q.billing_cycle !== undefined && q.billing_cycle !== '') {
    if (typeof q.billing_cycle !== 'string') {
      throw new ValidationError('billing_cycle must be a string')
    }
    const cycle = q.billing_cycle.toUpperCase() as CustomerSubscriptionBillingCycle
    if (!VALID_CUSTOMER_BILLING_CYCLES.includes(cycle)) {
      throw new ValidationError(
        `billing_cycle must be one of: ${VALID_CUSTOMER_BILLING_CYCLES.join(', ')}`
      )
    }
    result.billing_cycle = cycle
  }

  if (q.search !== undefined && q.search !== '') {
    if (typeof q.search !== 'string') {
      throw new ValidationError('search must be a string')
    }
    result.search = q.search.trim()
  }

  if (q.limit !== undefined && q.limit !== '') {
    const num = Number(q.limit)
    if (isNaN(num) || !Number.isInteger(num) || num <= 0) {
      throw new ValidationError('limit must be a positive integer')
    }
    result.limit = Math.min(num, 100)
  }

  if (q.offset !== undefined && q.offset !== '') {
    const num = Number(q.offset)
    if (isNaN(num) || !Number.isInteger(num) || num < 0) {
      throw new ValidationError('offset must be a non-negative integer')
    }
    result.offset = num
  }

  return result
}
