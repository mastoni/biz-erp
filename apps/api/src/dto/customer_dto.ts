import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'

// ---------------------------------------------------------------------------
// Response DTO — never includes deleted_at
// ---------------------------------------------------------------------------

export interface CustomerDto {
  id: string
  business_id: string
  name: string
  phone: string | null
  email: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Request interfaces
// ---------------------------------------------------------------------------

export interface CustomerCreateRequest {
  business_id: string
  name: string
  phone: string | null
  email: string | null
}

export interface CustomerUpdateRequest {
  business_id: string
  name?: string
  phone?: string | null
  email?: string | null
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Simple email format check: requires exactly one @, a local part, and a domain.
 * Not RFC 5322 exhaustive — consistent with repo convention of not over-engineering.
 */
function isValidEmail(value: string): boolean {
  const parts = value.split('@')
  if (parts.length !== 2) return false
  const [local, domain] = parts
  return local.length > 0 && domain.includes('.') && domain.length > 2
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export function validateCustomerCreate(body: unknown): CustomerCreateRequest {
  if (!isObject(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  const errors: Record<string, string> = {}

  // business_id
  const businessId = body.business_id
  if (!isUuid(businessId)) {
    errors.business_id = 'business_id must be a valid UUID'
  }

  // name (required, non-empty)
  const name = body.name
  if (typeof name !== 'string' || name.trim().length === 0) {
    errors.name = 'name is required and must be a non-empty string'
  }

  // phone (optional)
  const rawPhone = body.phone
  let phone: string | null = null
  if (rawPhone !== undefined && rawPhone !== null) {
    if (typeof rawPhone !== 'string') {
      errors.phone = 'phone must be a string or null'
    } else {
      phone = rawPhone.trim() === '' ? null : rawPhone.trim()
    }
  }

  // email (optional, validated when provided)
  const rawEmail = body.email
  let email: string | null = null
  if (rawEmail !== undefined && rawEmail !== null) {
    if (typeof rawEmail !== 'string') {
      errors.email = 'email must be a string or null'
    } else if (rawEmail.trim().length > 0 && !isValidEmail(rawEmail.trim())) {
      errors.email = 'email must be a valid email address'
    } else {
      email = rawEmail.trim() === '' ? null : rawEmail.trim()
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Customer create validation failed', errors)
  }

  return {
    business_id: (businessId as string).trim(),
    name: (name as string).trim(),
    phone,
    email,
  }
}

export function validateCustomerUpdate(body: unknown): CustomerUpdateRequest {
  if (!isObject(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  const errors: Record<string, string> = {}

  // business_id (required for tenant cross-check in service)
  const businessId = body.business_id
  if (!isUuid(businessId)) {
    errors.business_id = 'business_id must be a valid UUID'
  }

  const result: CustomerUpdateRequest = {
    business_id: isUuid(businessId) ? (businessId as string).trim() : '',
  }

  let hasPatch = false

  // name (optional, but if provided must be non-empty)
  if ('name' in body) {
    hasPatch = true
    const value = body.name
    if (typeof value !== 'string' || value.trim().length === 0) {
      errors.name = 'name must be a non-empty string'
    } else {
      result.name = value.trim()
    }
  }

  // phone (optional, may be null to clear)
  if ('phone' in body) {
    hasPatch = true
    const value = body.phone
    if (value === null) {
      result.phone = null
    } else if (typeof value === 'string') {
      result.phone = value.trim() === '' ? null : value.trim()
    } else {
      errors.phone = 'phone must be a string or null'
    }
  }

  // email (optional, may be null to clear; validated when non-null/non-empty)
  if ('email' in body) {
    hasPatch = true
    const value = body.email
    if (value === null) {
      result.email = null
    } else if (typeof value === 'string') {
      if (value.trim().length > 0 && !isValidEmail(value.trim())) {
        errors.email = 'email must be a valid email address'
      } else {
        result.email = value.trim() === '' ? null : value.trim()
      }
    } else {
      errors.email = 'email must be a string or null'
    }
  }

  if (!hasPatch) {
    errors.body = 'At least one updatable field (name, phone, email) is required'
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Customer update validation failed', errors)
  }

  return result
}
