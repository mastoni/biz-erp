import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'

// ---------------------------------------------------------------------------
// Response DTO
// ---------------------------------------------------------------------------

export interface SubscriptionDto {
  id: string
  account_customer_id: string | null
  business_id: string
  plan_code: string
  family_code: string
  source: 'DIRECT' | 'INCLUDED' | 'TRIAL' | 'PROMO' | 'MIGRATION'
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED'
  starts_at: string
  ends_at: string | null
  trial_ends_at: string | null
  billing_account_id: string | null
  internet_service_id: string | null
  unit_price: number
  discount: number
  tax: number
  final_price: number
  currency: string
  billing_cycle: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SubscriptionListResponse {
  items: SubscriptionDto[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

// ---------------------------------------------------------------------------
// Request interfaces
// ---------------------------------------------------------------------------

export interface SubscriptionCreateRequest {
  business_id: string
  plan_code: string
  family_code: string
  source: 'DIRECT' | 'INCLUDED' | 'TRIAL' | 'PROMO' | 'MIGRATION'
  unit_price: number
  discount?: number
  tax?: number
  final_price: number
  currency: string
  billing_cycle: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
  internet_service_id?: string | null
  billing_account_id?: string | null
  metadata?: Record<string, unknown>
}

export interface SubscriptionUpdateRequest {
  status?: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'
  metadata?: Record<string, unknown>
}

export interface SubscriptionActivateRequest {
  status: 'ACTIVE'
}

export interface SubscriptionSuspendRequest {
  status: 'SUSPENDED'
}

export interface SubscriptionCancelRequest {
  status: 'CANCELLED'
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const VALID_SOURCES = ['DIRECT', 'INCLUDED', 'TRIAL', 'PROMO', 'MIGRATION'] as const
const VALID_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED'] as const
const VALID_BILLING_CYCLES = ['MONTHLY', 'QUARTERLY', 'ANNUAL'] as const
const VALID_SOURCES_ARRAY = ['DIRECT', 'INCLUDED', 'TRIAL', 'PROMO', 'MIGRATION']
const VALID_STATUSES_ARRAY = ['PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED']
const VALID_BILLING_CYCLES_ARRAY = ['MONTHLY', 'QUARTERLY', 'ANNUAL']

export function validateSubscriptionCreate(body: unknown): SubscriptionCreateRequest {
  if (!isObject(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  const errors: Record<string, string> = {}

  // business_id (required)
  const businessId = body.business_id
  if (!isUuid(businessId)) {
    errors.business_id = 'business_id must be a valid UUID'
  }

  // plan_code (required)
  const planCode = body.plan_code
  if (typeof planCode !== 'string' || planCode.trim().length === 0) {
    errors.plan_code = 'plan_code is required and must be a non-empty string'
  }

  // family_code (required)
  const familyCode = body.family_code
  if (typeof familyCode !== 'string' || familyCode.trim().length === 0) {
    errors.family_code = 'family_code is required and must be a non-empty string'
  }

  // source (required)
  const source = body.source
  if (typeof source !== 'string' || !VALID_SOURCES_ARRAY.includes(source)) {
    errors.source = 'source must be one of: DIRECT, INCLUDED, TRIAL, PROMO, MIGRATION'
  }

  // unit_price (required)
  const unitPrice = body.unit_price
  if (typeof unitPrice !== 'number' || !Number.isInteger(unitPrice) || unitPrice < 0) {
    errors.unit_price = 'unit_price must be a non-negative integer'
  }

  // discount (optional)
  const discount = body.discount
  if (discount !== undefined && (typeof discount !== 'number' || !Number.isInteger(discount) || discount < 0)) {
    errors.discount = 'discount must be a non-negative integer'
  }

  // tax (optional)
  const tax = body.tax
  if (tax !== undefined && (typeof tax !== 'number' || !Number.isInteger(tax) || tax < 0)) {
    errors.tax = 'tax must be a non-negative integer'
  }

  // final_price (required)
  const finalPrice = body.final_price
  if (typeof finalPrice !== 'number' || !Number.isInteger(finalPrice) || finalPrice < 0) {
    errors.final_price = 'final_price must be a non-negative integer'
  }

  // currency (required)
  const currency = body.currency
  if (typeof currency !== 'string' || currency.trim().length === 0) {
    errors.currency = 'currency is required'
  }

  // billing_cycle (required)
  const billingCycle = body.billing_cycle
  if (typeof billingCycle !== 'string' || !VALID_BILLING_CYCLES_ARRAY.includes(billingCycle)) {
    errors.billing_cycle = 'billing_cycle must be one of: MONTHLY, QUARTERLY, ANNUAL'
  }

  // internet_service_id (optional)
  if (body.internet_service_id !== undefined && body.internet_service_id !== null) {
    if (!isUuid(body.internet_service_id)) {
      errors.internet_service_id = 'internet_service_id must be a valid UUID or null'
    }
  }

  // billing_account_id (optional)
  if (body.billing_account_id !== undefined && body.billing_account_id !== null) {
    if (!isUuid(body.billing_account_id)) {
      errors.billing_account_id = 'billing_account_id must be a valid UUID or null'
    }
  }

  // metadata (optional)
  if (body.metadata !== undefined && body.metadata !== null) {
    if (!isObject(body.metadata)) {
      errors.metadata = 'metadata must be a JSON object'
    }
  }

  // Source-specific validation
  const sourceValue = body.source as 'DIRECT' | 'INCLUDED' | 'TRIAL' | 'PROMO' | 'MIGRATION'

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Subscription create validation failed', errors)
  }

return {
    business_id: (businessId as string).trim(),
    plan_code: (planCode as string).trim(),
    family_code: (familyCode as string).trim(),
    source: sourceValue,
    unit_price: unitPrice as number,
    discount: (discount as number) ?? 0,
    tax: (tax as number) ?? 0,
    final_price: finalPrice as number,
    currency: (currency as string).trim(),
    billing_cycle: billingCycle as 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
    internet_service_id: (body.internet_service_id as string) ?? null,
    billing_account_id: (body.billing_account_id as string) ?? null,
    metadata: (body.metadata as Record<string, unknown> | null) ?? {},
  }
}

export function validateSubscriptionUpdate(body: unknown): SubscriptionUpdateRequest {
  if (!isObject(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  const errors: Record<string, string> = {}

  let hasPatch = false

  // status (optional)
  if ('status' in body) {
    hasPatch = true
    const status = body.status
    if (typeof status !== 'string' || !VALID_STATUSES_ARRAY.includes(status)) {
      errors.status = 'status must be one of: ACTIVE, SUSPENDED, CANCELLED'
    }
  }

  // metadata (optional)
  if ('metadata' in body) {
    hasPatch = true
    const metadata = body.metadata
    if (metadata !== null && metadata !== undefined && !isObject(metadata)) {
      errors.metadata = 'metadata must be a JSON object or null'
    }
  }

  if (!hasPatch) {
    errors.body = 'At least one field (status or metadata) is required'
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Subscription update validation failed', errors)
  }

  const result: SubscriptionUpdateRequest = {}

  if ('status' in body) {
    result.status = body.status as 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'
  }

  if ('metadata' in body) {
    result.metadata = body.metadata as Record<string, unknown> | undefined
  }

  return result
}

export function validateSubscriptionActivate(body: unknown): SubscriptionActivateRequest {
  if (!isObject(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  if (body.status !== 'ACTIVE') {
    throw new ValidationError('status must be ACTIVE')
  }

  return { status: 'ACTIVE' }
}

export function validateSubscriptionSuspend(body: unknown): SubscriptionSuspendRequest {
  if (!isObject(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  if (body.status !== 'SUSPENDED') {
    throw new ValidationError('status must be SUSPENDED')
  }

  return { status: 'SUSPENDED' }
}

export function validateSubscriptionCancel(body: unknown): SubscriptionCancelRequest {
  if (!isObject(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  if (body.status !== 'CANCELLED') {
    throw new ValidationError('status must be CANCELLED')
  }

  return { status: 'CANCELLED' }
}