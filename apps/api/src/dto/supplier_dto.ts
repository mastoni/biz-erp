import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

export type SupplierTerm = 'Tunai' | 'Tempo 14' | 'Tempo 30'

export const VALID_SUPPLIER_TERMS: readonly SupplierTerm[] = ['Tunai', 'Tempo 14', 'Tempo 30'] as const

export function isValidSupplierTerm(value: unknown): value is SupplierTerm {
  return typeof value === 'string' && VALID_SUPPLIER_TERMS.includes(value as SupplierTerm)
}

export type SupplierStatus = 'aktif' | 'nonaktif'

export const VALID_SUPPLIER_STATUSES: readonly SupplierStatus[] = ['aktif', 'nonaktif'] as const

export function isValidSupplierStatus(value: unknown): value is SupplierStatus {
  return typeof value === 'string' && VALID_SUPPLIER_STATUSES.includes(value as SupplierStatus)
}

// ---------------------------------------------------------------------------
// Response DTO
// ---------------------------------------------------------------------------

export interface SupplierDto {
  id: string
  business_id: string
  code: string
  name: string
  contact: string | null
  phone: string | null
  email: string | null
  category: string | null
  term: SupplierTerm
  status: SupplierStatus
  server_version: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface SupplierSummaryDto {
  total_suppliers: number
  active_suppliers: number
  inactive_suppliers: number
}

// ---------------------------------------------------------------------------
// Request interfaces
// ---------------------------------------------------------------------------

export interface SupplierCreateRequest {
  id: string
  business_id: string
  name: string
  contact: string | null
  phone: string | null
  email: string | null
  category: string | null
  term: SupplierTerm
  status: SupplierStatus
}

export interface SupplierUpdateRequest {
  business_id: string
  expected_server_version: number
  name?: string
  contact?: string | null
  phone?: string | null
  email?: string | null
  category?: string | null
  term?: SupplierTerm
  status?: SupplierStatus
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

/**
 * Deterministic supplier code derived from company name.
 * Algorithm (blueprint: Suppliers.tsx):
 *   1. Strip non-alphabetic characters (keep A-Z, a-z, spaces)
 *   2. Split on whitespace, filter empty tokens
 *   3. Take first letter of each word
 *   4. Join and uppercase
 *   5. Truncate to 3 characters
 */
export function generateSupplierCode(name: string): string {
  return name
    .replace(/[^A-Za-z ]/g, '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 3)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidEmail(value: string): boolean {
  const parts = value.split('@')
  if (parts.length !== 2) return false
  const [local, domain] = parts
  return local.length > 0 && domain.includes('.') && domain.length > 2
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export function validateSupplierCreate(body: unknown): SupplierCreateRequest {
  if (!isObject(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  const errors: Record<string, string> = {}

  // id (client-generated UUID, required)
  const id = body.id
  if (!isUuid(id)) {
    errors.id = 'id must be a valid UUID'
  }

  // business_id (tenant-scoped, required)
  const businessId = body.business_id
  if (!isUuid(businessId)) {
    errors.business_id = 'business_id must be a valid UUID'
  }

  // name (required, non-empty)
  const name = body.name
  if (typeof name !== 'string' || name.trim().length === 0) {
    errors.name = 'name is required and must be a non-empty string'
  }

  // contact (nullable)
  const rawContact = body.contact
  let contact: string | null = null
  if (rawContact !== undefined && rawContact !== null) {
    if (typeof rawContact !== 'string') {
      errors.contact = 'contact must be a string or null'
    } else {
      contact = rawContact.trim() === '' ? null : rawContact.trim()
    }
  }

  // phone (nullable)
  const rawPhone = body.phone
  let phone: string | null = null
  if (rawPhone !== undefined && rawPhone !== null) {
    if (typeof rawPhone !== 'string') {
      errors.phone = 'phone must be a string or null'
    } else {
      phone = rawPhone.trim() === '' ? null : rawPhone.trim()
    }
  }

  // email (nullable, validated when provided)
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

  // category (nullable)
  const rawCategory = body.category
  let category: string | null = null
  if (rawCategory !== undefined && rawCategory !== null) {
    if (typeof rawCategory !== 'string') {
      errors.category = 'category must be a string or null'
    } else {
      category = rawCategory.trim() === '' ? null : rawCategory.trim()
    }
  }

  // term (optional, defaults to Tunai)
  let term: SupplierTerm = 'Tunai'
  if ('term' in body && body.term !== undefined && body.term !== null) {
    if (!isValidSupplierTerm(body.term)) {
      errors.term = `term must be one of: ${VALID_SUPPLIER_TERMS.join(', ')}`
    } else {
      term = body.term
    }
  }

  // status (optional, defaults to aktif)
  let status: SupplierStatus = 'aktif'
  if ('status' in body && body.status !== undefined && body.status !== null) {
    if (!isValidSupplierStatus(body.status)) {
      errors.status = `status must be one of: ${VALID_SUPPLIER_STATUSES.join(', ')}`
    } else {
      status = body.status
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Supplier create validation failed', errors)
  }

  return {
    id: (id as string).trim(),
    business_id: (businessId as string).trim(),
    name: (name as string).trim(),
    contact,
    phone,
    email,
    category,
    term,
    status,
  }
}

export function validateSupplierUpdate(body: unknown): SupplierUpdateRequest {
  if (!isObject(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  const errors: Record<string, string> = {}

  // business_id (required for tenant cross-check in service)
  const businessId = body.business_id
  if (!isUuid(businessId)) {
    errors.business_id = 'business_id must be a valid UUID'
  }

  // expected_server_version (required, integer >= 1)
  const expected = body.expected_server_version
  if (typeof expected !== 'number' || !Number.isInteger(expected) || expected < 1) {
    errors.expected_server_version = 'expected_server_version must be an integer >= 1'
  }

  const result: SupplierUpdateRequest = {
    business_id: isUuid(businessId) ? (businessId as string).trim() : '',
    expected_server_version: typeof expected === 'number' && Number.isInteger(expected) && expected >= 1 ? expected : 0,
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

  // contact (nullable)
  if ('contact' in body) {
    hasPatch = true
    const value = body.contact
    if (value === null) {
      result.contact = null
    } else if (typeof value === 'string') {
      result.contact = value.trim() === '' ? null : value.trim()
    } else {
      errors.contact = 'contact must be a string or null'
    }
  }

  // phone (nullable)
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

  // email (nullable, validated when non-null/non-empty)
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

  // category (nullable)
  if ('category' in body) {
    hasPatch = true
    const value = body.category
    if (value === null) {
      result.category = null
    } else if (typeof value === 'string') {
      result.category = value.trim() === '' ? null : value.trim()
    } else {
      errors.category = 'category must be a string or null'
    }
  }

  // term (optional)
  if ('term' in body) {
    hasPatch = true
    const value = body.term
    if (!isValidSupplierTerm(value)) {
      errors.term = `term must be one of: ${VALID_SUPPLIER_TERMS.join(', ')}`
    } else {
      result.term = value
    }
  }

  // status (optional)
  if ('status' in body) {
    hasPatch = true
    const value = body.status
    if (!isValidSupplierStatus(value)) {
      errors.status = `status must be one of: ${VALID_SUPPLIER_STATUSES.join(', ')}`
    } else {
      result.status = value
    }
  }

  if (!hasPatch) {
    errors.body = 'At least one updatable field (name, contact, phone, email, category, term, status) is required'
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Supplier update validation failed', errors)
  }

  return result
}
