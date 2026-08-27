import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'
import { createHash } from 'crypto'

// ---------------------------------------------------------------------------
// Enums & Types
// ---------------------------------------------------------------------------

export type PurchaseStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled'
export type SupplierTerm = 'Tunai' | 'Tempo 14' | 'Tempo 30'
export type PaymentMethod = 'cash' | 'bank_transfer' | 'debit' | 'credit'

export const VALID_PURCHASE_STATUSES: PurchaseStatus[] = [
  'draft',
  'sent',
  'partial',
  'received',
  'cancelled',
]

export const VALID_SUPPLIER_TERMS: SupplierTerm[] = ['Tunai', 'Tempo 14', 'Tempo 30']

export const VALID_PAYMENT_METHODS: PaymentMethod[] = [
  'cash',
  'bank_transfer',
  'debit',
  'credit',
]

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

// ---------------------------------------------------------------------------
// Response DTOs
// ---------------------------------------------------------------------------

export interface PurchaseItemDto {
  id: string
  purchase_id: string
  product_id: string | null
  product_name: string
  ordered_qty: number
  received_qty: number
  unit_cost_minor: number
  subtotal_minor: number
}

export interface PurchasePaymentDto {
  id: string
  business_id: string
  purchase_id: string
  amount_minor: number
  method: PaymentMethod
  reference: string | null
  idempotency_key: string
  created_at: string
}

export interface PurchaseDto {
  id: string
  business_id: string
  branch_id: string
  supplier_id: string
  code: string
  date: string
  due_date: string
  supplier_term: SupplierTerm
  status: PurchaseStatus
  total_minor: number
  paid_minor: number
  outstanding_minor: number
  received_minor: number
  note: string | null
  server_version: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  items?: PurchaseItemDto[]
  payments?: PurchasePaymentDto[]
  supplier_name?: string
  branch_name?: string
}

export interface PurchaseSummaryDto {
  total_purchases: number
  draft_count: number
  sent_count: number
  partial_count: number
  received_count: number
  cancelled_count: number
  total_value_minor: number
  total_paid_minor: number
  total_outstanding_minor: number
}

export interface PurchaseListResponse {
  items: PurchaseDto[]
  total: number
  limit: number
  offset: number
  has_more: boolean
  summary: PurchaseSummaryDto
}

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------

export interface PurchaseItemCreateDto {
  id?: string
  product_id: string
  ordered_qty: number
}

export interface PurchaseCreateRequest {
  id: string
  business_id: string
  branch_id: string
  supplier_id: string
  date?: string
  due_date?: string
  status?: 'draft' | 'sent'
  note?: string | null
  items: PurchaseItemCreateDto[]
}

export interface PurchaseUpdateRequest {
  business_id: string
  expected_server_version: number
  branch_id?: string
  supplier_id?: string
  date?: string
  due_date?: string
  note?: string | null
  items?: PurchaseItemCreateDto[]
}

export interface PurchaseSendRequest {
  business_id: string
  expected_server_version: number
}

export interface PurchaseReceiveLineDto {
  item_id: string
  receive_qty: number
}

export interface PurchaseReceiveRequest {
  business_id: string
  expected_server_version: number
  items: PurchaseReceiveLineDto[]
}

export interface PurchasePaymentRequest {
  business_id: string
  expected_server_version: number
  amount_minor: number
  method: PaymentMethod
  reference?: string | null
}

export interface PurchaseCancelRequest {
  business_id: string
  expected_server_version: number
}

// ---------------------------------------------------------------------------
// Helper: calculate due date from term
// ---------------------------------------------------------------------------

export function calculateDueDate(baseDateStr: string, term: SupplierTerm): string {
  const base = new Date(baseDateStr + 'T00:00:00.000Z')
  if (isNaN(base.getTime())) {
    throw new ValidationError('Invalid base date format. Expected YYYY-MM-DD')
  }

  let days = 0
  if (term === 'Tempo 14') days = 14
  else if (term === 'Tempo 30') days = 30

  const due = new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
  return due.toISOString().slice(0, 10)
}

export function generatePurchaseCode(supplierCode: string, sequenceNumber: number): string {
  const sanitized = supplierCode.trim().toUpperCase()
  const seq = String(sequenceNumber).padStart(3, '0')
  return `${sanitized}/PO/${seq}`
}

// ---------------------------------------------------------------------------
// Validation: Create
// ---------------------------------------------------------------------------

export function validatePurchaseCreate(body: unknown): PurchaseCreateRequest {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a non-null object')
  }

  const b = body as Record<string, unknown>

  if (typeof b.id !== 'string' || !isUuid(b.id)) {
    throw new ValidationError('id must be a valid UUID')
  }

  if (typeof b.business_id !== 'string' || !isUuid(b.business_id)) {
    throw new ValidationError('business_id must be a valid UUID')
  }

  if (typeof b.branch_id !== 'string' || !isUuid(b.branch_id)) {
    throw new ValidationError('branch_id must be a valid UUID')
  }

  if (typeof b.supplier_id !== 'string' || !isUuid(b.supplier_id)) {
    throw new ValidationError('supplier_id must be a valid UUID')
  }

  let date: string | undefined
  if (b.date !== undefined && b.date !== null) {
    if (typeof b.date !== 'string' || !DATE_REGEX.test(b.date)) {
      throw new ValidationError('date must be in YYYY-MM-DD format')
    }
    date = b.date
  }

  let dueDate: string | undefined
  if (b.due_date !== undefined && b.due_date !== null) {
    if (typeof b.due_date !== 'string' || !DATE_REGEX.test(b.due_date)) {
      throw new ValidationError('due_date must be in YYYY-MM-DD format')
    }
    dueDate = b.due_date
  }

  let status: 'draft' | 'sent' | undefined
  if (b.status !== undefined && b.status !== null) {
    if (b.status !== 'draft' && b.status !== 'sent') {
      throw new ValidationError("Initial status must be 'draft' or 'sent'")
    }
    status = b.status
  }

  let note: string | null = null
  if (b.note !== undefined && b.note !== null) {
    if (typeof b.note !== 'string') {
      throw new ValidationError('note must be a string or null')
    }
    note = b.note.trim() || null
  }

  if (!Array.isArray(b.items) || b.items.length === 0) {
    throw new ValidationError('items must be a non-empty array')
  }

  const seenProductIds = new Set<string>()
  const items: PurchaseItemCreateDto[] = []

  for (let i = 0; i < b.items.length; i++) {
    const it = b.items[i]
    if (!it || typeof it !== 'object') {
      throw new ValidationError(`items[${i}] must be an object`)
    }

    const itemObj = it as Record<string, unknown>

    let itemId: string | undefined
    if (itemObj.id !== undefined && itemObj.id !== null) {
      if (typeof itemObj.id !== 'string' || !isUuid(itemObj.id)) {
        throw new ValidationError(`items[${i}].id must be a valid UUID`)
      }
      itemId = itemObj.id
    }

    if (typeof itemObj.product_id !== 'string' || !isUuid(itemObj.product_id)) {
      throw new ValidationError(`items[${i}].product_id must be a valid UUID`)
    }

    if (
      typeof itemObj.ordered_qty !== 'number' ||
      !Number.isInteger(itemObj.ordered_qty) ||
      itemObj.ordered_qty <= 0
    ) {
      throw new ValidationError(`items[${i}].ordered_qty must be an integer > 0`)
    }

    if (seenProductIds.has(itemObj.product_id)) {
      throw new ValidationError(`Duplicate product_id ${itemObj.product_id} in items`)
    }
    seenProductIds.add(itemObj.product_id)

    items.push({
      id: itemId,
      product_id: itemObj.product_id,
      ordered_qty: itemObj.ordered_qty,
    })
  }

  return {
    id: b.id,
    business_id: b.business_id,
    branch_id: b.branch_id,
    supplier_id: b.supplier_id,
    date,
    due_date: dueDate,
    status,
    note,
    items,
  }
}

// ---------------------------------------------------------------------------
// Validation: Update (Draft only)
// ---------------------------------------------------------------------------

export function validatePurchaseUpdate(body: unknown): PurchaseUpdateRequest {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a non-null object')
  }

  const b = body as Record<string, unknown>

  if (typeof b.business_id !== 'string' || !isUuid(b.business_id)) {
    throw new ValidationError('business_id must be a valid UUID')
  }

  if (
    typeof b.expected_server_version !== 'number' ||
    !Number.isInteger(b.expected_server_version) ||
    b.expected_server_version < 1
  ) {
    throw new ValidationError('expected_server_version must be an integer >= 1')
  }

  let branchId: string | undefined
  if (b.branch_id !== undefined && b.branch_id !== null) {
    if (typeof b.branch_id !== 'string' || !isUuid(b.branch_id)) {
      throw new ValidationError('branch_id must be a valid UUID')
    }
    branchId = b.branch_id
  }

  let supplierId: string | undefined
  if (b.supplier_id !== undefined && b.supplier_id !== null) {
    if (typeof b.supplier_id !== 'string' || !isUuid(b.supplier_id)) {
      throw new ValidationError('supplier_id must be a valid UUID')
    }
    supplierId = b.supplier_id
  }

  let date: string | undefined
  if (b.date !== undefined && b.date !== null) {
    if (typeof b.date !== 'string' || !DATE_REGEX.test(b.date)) {
      throw new ValidationError('date must be in YYYY-MM-DD format')
    }
    date = b.date
  }

  let dueDate: string | undefined
  if (b.due_date !== undefined && b.due_date !== null) {
    if (typeof b.due_date !== 'string' || !DATE_REGEX.test(b.due_date)) {
      throw new ValidationError('due_date must be in YYYY-MM-DD format')
    }
    dueDate = b.due_date
  }

  let note: string | null | undefined
  if (b.note !== undefined) {
    if (b.note !== null && typeof b.note !== 'string') {
      throw new ValidationError('note must be a string or null')
    }
    note = b.note ? b.note.trim() : null
  }

  let items: PurchaseItemCreateDto[] | undefined
  if (b.items !== undefined) {
    if (!Array.isArray(b.items) || b.items.length === 0) {
      throw new ValidationError('items must be a non-empty array when provided')
    }

    const seenProductIds = new Set<string>()
    items = []

    for (let i = 0; i < b.items.length; i++) {
      const it = b.items[i]
      if (!it || typeof it !== 'object') {
        throw new ValidationError(`items[${i}] must be an object`)
      }

      const itemObj = it as Record<string, unknown>

      let itemId: string | undefined
      if (itemObj.id !== undefined && itemObj.id !== null) {
        if (typeof itemObj.id !== 'string' || !isUuid(itemObj.id)) {
          throw new ValidationError(`items[${i}].id must be a valid UUID`)
        }
        itemId = itemObj.id
      }

      if (typeof itemObj.product_id !== 'string' || !isUuid(itemObj.product_id)) {
        throw new ValidationError(`items[${i}].product_id must be a valid UUID`)
      }

      if (
        typeof itemObj.ordered_qty !== 'number' ||
        !Number.isInteger(itemObj.ordered_qty) ||
        itemObj.ordered_qty <= 0
      ) {
        throw new ValidationError(`items[${i}].ordered_qty must be an integer > 0`)
      }

      if (seenProductIds.has(itemObj.product_id)) {
        throw new ValidationError(`Duplicate product_id ${itemObj.product_id} in items`)
      }
      seenProductIds.add(itemObj.product_id)

      items.push({
        id: itemId,
        product_id: itemObj.product_id,
        ordered_qty: itemObj.ordered_qty,
      })
    }
  }

  return {
    business_id: b.business_id,
    expected_server_version: b.expected_server_version,
    branch_id: branchId,
    supplier_id: supplierId,
    date,
    due_date: dueDate,
    note,
    items,
  }
}

// ---------------------------------------------------------------------------
// Validation: Send
// ---------------------------------------------------------------------------

export function validatePurchaseSend(body: unknown): PurchaseSendRequest {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a non-null object')
  }

  const b = body as Record<string, unknown>

  if (typeof b.business_id !== 'string' || !isUuid(b.business_id)) {
    throw new ValidationError('business_id must be a valid UUID')
  }

  if (
    typeof b.expected_server_version !== 'number' ||
    !Number.isInteger(b.expected_server_version) ||
    b.expected_server_version < 1
  ) {
    throw new ValidationError('expected_server_version must be an integer >= 1')
  }

  return {
    business_id: b.business_id,
    expected_server_version: b.expected_server_version,
  }
}

// ---------------------------------------------------------------------------
// Validation: Receive
// ---------------------------------------------------------------------------

export function validatePurchaseReceive(body: unknown): PurchaseReceiveRequest {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a non-null object')
  }

  const b = body as Record<string, unknown>

  if (typeof b.business_id !== 'string' || !isUuid(b.business_id)) {
    throw new ValidationError('business_id must be a valid UUID')
  }

  if (
    typeof b.expected_server_version !== 'number' ||
    !Number.isInteger(b.expected_server_version) ||
    b.expected_server_version < 1
  ) {
    throw new ValidationError('expected_server_version must be an integer >= 1')
  }

  if (!Array.isArray(b.items) || b.items.length === 0) {
    throw new ValidationError('items must be a non-empty array')
  }

  const seenItemIds = new Set<string>()
  const items: PurchaseReceiveLineDto[] = []

  for (let i = 0; i < b.items.length; i++) {
    const it = b.items[i]
    if (!it || typeof it !== 'object') {
      throw new ValidationError(`items[${i}] must be an object`)
    }

    const line = it as Record<string, unknown>

    if (typeof line.item_id !== 'string' || !isUuid(line.item_id)) {
      throw new ValidationError(`items[${i}].item_id must be a valid UUID`)
    }

    if (
      typeof line.receive_qty !== 'number' ||
      !Number.isInteger(line.receive_qty) ||
      line.receive_qty <= 0
    ) {
      throw new ValidationError(`items[${i}].receive_qty must be an integer > 0`)
    }

    if (seenItemIds.has(line.item_id)) {
      throw new ValidationError(`Duplicate item_id ${line.item_id} in receive items`)
    }
    seenItemIds.add(line.item_id)

    items.push({
      item_id: line.item_id,
      receive_qty: line.receive_qty,
    })
  }

  return {
    business_id: b.business_id,
    expected_server_version: b.expected_server_version,
    items,
  }
}

// ---------------------------------------------------------------------------
// Validation: Pay
// ---------------------------------------------------------------------------

export function validatePurchasePay(body: unknown): PurchasePaymentRequest {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a non-null object')
  }

  const b = body as Record<string, unknown>

  if (typeof b.business_id !== 'string' || !isUuid(b.business_id)) {
    throw new ValidationError('business_id must be a valid UUID')
  }

  if (
    typeof b.expected_server_version !== 'number' ||
    !Number.isInteger(b.expected_server_version) ||
    b.expected_server_version < 1
  ) {
    throw new ValidationError('expected_server_version must be an integer >= 1')
  }

  if (
    typeof b.amount_minor !== 'number' ||
    !Number.isInteger(b.amount_minor) ||
    b.amount_minor <= 0
  ) {
    throw new ValidationError('amount_minor must be an integer > 0')
  }

  if (
    typeof b.method !== 'string' ||
    !VALID_PAYMENT_METHODS.includes(b.method as PaymentMethod)
  ) {
    throw new ValidationError(
      `method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`
    )
  }

  let reference: string | null = null
  if (b.reference !== undefined && b.reference !== null) {
    if (typeof b.reference !== 'string') {
      throw new ValidationError('reference must be a string or null')
    }
    reference = b.reference.trim() || null
  }

  return {
    business_id: b.business_id,
    expected_server_version: b.expected_server_version,
    amount_minor: b.amount_minor,
    method: b.method as PaymentMethod,
    reference,
  }
}

// ---------------------------------------------------------------------------
// Validation: Cancel
// ---------------------------------------------------------------------------

export function validatePurchaseCancel(body: unknown): PurchaseCancelRequest {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a non-null object')
  }

  const b = body as Record<string, unknown>

  if (typeof b.business_id !== 'string' || !isUuid(b.business_id)) {
    throw new ValidationError('business_id must be a valid UUID')
  }

  if (
    typeof b.expected_server_version !== 'number' ||
    !Number.isInteger(b.expected_server_version) ||
    b.expected_server_version < 1
  ) {
    throw new ValidationError('expected_server_version must be an integer >= 1')
  }

  return {
    business_id: b.business_id,
    expected_server_version: b.expected_server_version,
  }
}

// ---------------------------------------------------------------------------
// Hash Calculation Helpers (Canonical Idempotency)
// ---------------------------------------------------------------------------

export function computePurchaseCreateHash(body: PurchaseCreateRequest): string {
  const itemsStr = body.items
    .map((it) => `${it.product_id}:${it.ordered_qty}`)
    .sort()
    .join(',')
  const hashStr = `purchase_create|${body.business_id}|${body.id}|${body.branch_id}|${body.supplier_id}|${body.date ?? 'null'}|${body.due_date ?? 'null'}|${body.status ?? 'draft'}|${body.note ?? 'null'}|${itemsStr}`
  return createHash('sha256').update(hashStr).digest('hex')
}

export function computePurchaseSendHash(purchaseId: string, body: PurchaseSendRequest): string {
  const hashStr = `purchase_send|${body.business_id}|${purchaseId}|${body.expected_server_version}`
  return createHash('sha256').update(hashStr).digest('hex')
}

export function computePurchaseReceiveHash(
  purchaseId: string,
  body: PurchaseReceiveRequest
): string {
  const itemsStr = body.items
    .map((it) => `${it.item_id}:${it.receive_qty}`)
    .sort()
    .join(',')
  const hashStr = `purchase_receive|${body.business_id}|${purchaseId}|${body.expected_server_version}|${itemsStr}`
  return createHash('sha256').update(hashStr).digest('hex')
}

export function computePurchasePayHash(purchaseId: string, body: PurchasePaymentRequest): string {
  const hashStr = `purchase_pay|${body.business_id}|${purchaseId}|${body.expected_server_version}|${body.amount_minor}|${body.method}|${body.reference ?? 'null'}`
  return createHash('sha256').update(hashStr).digest('hex')
}

export function computePurchaseCancelHash(purchaseId: string, body: PurchaseCancelRequest): string {
  const hashStr = `purchase_cancel|${body.business_id}|${purchaseId}|${body.expected_server_version}`
  return createHash('sha256').update(hashStr).digest('hex')
}
