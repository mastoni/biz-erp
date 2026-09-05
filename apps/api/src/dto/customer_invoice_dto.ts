import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'

// ---------------------------------------------------------------------------
// Canonical Types & Enums
// ---------------------------------------------------------------------------

export type CustomerInvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'

export type CustomerPaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'debit'
  | 'credit'
  | 'wallet'

export const VALID_INVOICE_STATUSES: CustomerInvoiceStatus[] = [
  'DRAFT',
  'ISSUED',
  'PAID',
  'OVERDUE',
  'CANCELLED'
]

export const VALID_PAYMENT_METHODS: CustomerPaymentMethod[] = [
  'cash',
  'bank_transfer',
  'debit',
  'credit',
  'wallet'
]

// ---------------------------------------------------------------------------
// Response DTOs
// ---------------------------------------------------------------------------

export interface CustomerInvoiceDto {
  id: string
  invoice_number: string
  business_id: string
  customer_subscription_id: string
  customer_id: string
  customer_name?: string
  receivable_id: string
  billing_period_start: string
  billing_period_end: string
  subtotal_minor: number
  discount_minor: number
  tax_minor: number
  total_minor: number
  outstanding_minor?: number
  paid_minor?: number
  currency: string
  status: CustomerInvoiceStatus
  issue_date: string
  due_date: string
  paid_at: string | null
  payment_reference: string | null
  notes: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CustomerInvoiceDetailDto extends CustomerInvoiceDto {
  customer_phone?: string | null
  customer_email?: string | null
  subscription_name?: string
  receivable_status?: string
}

export interface CustomerInvoiceListResponse {
  items: CustomerInvoiceDto[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

// ---------------------------------------------------------------------------
// Request Interfaces
// ---------------------------------------------------------------------------

export interface RecordInvoicePaymentRequest {
  amount_minor: number
  method: CustomerPaymentMethod
  reference?: string | null
  idempotency_key: string
  wallet_id?: string
}

export interface CancelInvoiceRequest {
  reason?: string
}

export interface CustomerInvoiceQuery {
  customer_id?: string
  customer_subscription_id?: string
  status?: CustomerInvoiceStatus
  date_from?: string
  date_to?: string
  search?: string
  limit?: number
  offset?: number
}

// ---------------------------------------------------------------------------
// Validation & Normalization Functions
// ---------------------------------------------------------------------------

function isValidDateOnlyString(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(Date.parse(str))
}

export function validateRecordInvoicePayment(
  body: unknown
): RecordInvoicePaymentRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  const b = body as Record<string, unknown>

  // amount_minor (required, positive integer > 0)
  if (b.amount_minor === undefined || b.amount_minor === null) {
    throw new ValidationError('amount_minor is required')
  }
  if (typeof b.amount_minor !== 'number' || !Number.isInteger(b.amount_minor) || b.amount_minor <= 0) {
    throw new ValidationError('amount_minor must be a positive integer in minor currency units')
  }
  const amount_minor = b.amount_minor

  // method (required, one of cash, bank_transfer, debit, credit, wallet)
  if (!b.method || typeof b.method !== 'string') {
    throw new ValidationError('method is required')
  }
  const method = b.method.toLowerCase() as CustomerPaymentMethod
  if (!VALID_PAYMENT_METHODS.includes(method)) {
    throw new ValidationError(
      `method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`
    )
  }

  // idempotency_key (required, non-empty string)
  if (!b.idempotency_key || typeof b.idempotency_key !== 'string' || b.idempotency_key.trim().length === 0) {
    throw new ValidationError('idempotency_key is required and cannot be empty')
  }
  const idempotency_key = b.idempotency_key.trim()

  // reference (optional string)
  let reference: string | null | undefined = undefined
  if (b.reference !== undefined) {
    reference = b.reference === null ? null : typeof b.reference === 'string' ? b.reference.trim() : String(b.reference)
  }

  // wallet_id (optional valid UUID string)
  let wallet_id: string | undefined = undefined
  if (b.wallet_id !== undefined && b.wallet_id !== null && b.wallet_id !== '') {
    if (typeof b.wallet_id !== 'string' || !isUuid(b.wallet_id)) {
      throw new ValidationError('wallet_id must be a valid UUID')
    }
    wallet_id = b.wallet_id
  }

  return {
    amount_minor,
    method,
    reference,
    idempotency_key,
    ...(wallet_id ? { wallet_id } : {})
  }
}

export function validateCancelInvoice(body: unknown): CancelInvoiceRequest {
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

export function validateInvoiceQuery(query: unknown): CustomerInvoiceQuery {
  if (!query || typeof query !== 'object') {
    return {}
  }
  const q = query as Record<string, unknown>
  const result: CustomerInvoiceQuery = {}

  if (q.customer_id !== undefined && q.customer_id !== '') {
    if (typeof q.customer_id !== 'string' || !isUuid(q.customer_id)) {
      throw new ValidationError('customer_id must be a valid UUID')
    }
    result.customer_id = q.customer_id
  }

  if (q.customer_subscription_id !== undefined && q.customer_subscription_id !== '') {
    if (typeof q.customer_subscription_id !== 'string' || !isUuid(q.customer_subscription_id)) {
      throw new ValidationError('customer_subscription_id must be a valid UUID')
    }
    result.customer_subscription_id = q.customer_subscription_id
  }

  if (q.status !== undefined && q.status !== '') {
    if (typeof q.status !== 'string') {
      throw new ValidationError('status must be a string')
    }
    const status = q.status.toUpperCase() as CustomerInvoiceStatus
    if (!VALID_INVOICE_STATUSES.includes(status)) {
      throw new ValidationError(
        `status must be one of: ${VALID_INVOICE_STATUSES.join(', ')}`
      )
    }
    result.status = status
  }

  if (q.date_from !== undefined && q.date_from !== '') {
    if (typeof q.date_from !== 'string' || !isValidDateOnlyString(q.date_from)) {
      throw new ValidationError('date_from must be a valid date in YYYY-MM-DD format')
    }
    result.date_from = q.date_from
  }

  if (q.date_to !== undefined && q.date_to !== '') {
    if (typeof q.date_to !== 'string' || !isValidDateOnlyString(q.date_to)) {
      throw new ValidationError('date_to must be a valid date in YYYY-MM-DD format')
    }
    result.date_to = q.date_to
  }

  if (result.date_from && result.date_to && result.date_to < result.date_from) {
    throw new ValidationError('date_to cannot be earlier than date_from')
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
