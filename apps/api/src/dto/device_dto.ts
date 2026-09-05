import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'

// ---------------------------------------------------------------------------
// Canonical Types & Enums
// ---------------------------------------------------------------------------

export type DeviceType =
  | 'POS_TERMINAL'
  | 'PRINTER'
  | 'SCANNER'
  | 'CASH_DRAWER'
  | 'ONT'
  | 'ROUTER'
  | 'ACCESS_POINT'
  | 'CCTV_CAMERA'
  | 'DVR_NVR'
  | 'OTHER'

export type DeviceOwnershipType = 'TENANT_OWNED' | 'CUSTOMER_OWNED' | 'LEASED_RENTED'

export type DeviceStatus =
  | 'IN_STOCK'
  | 'RESERVED'
  | 'INSTALLED'
  | 'IN_REPAIR'
  | 'DEFECTIVE'
  | 'RETURNED'
  | 'DECOMMISSIONED'

export const VALID_DEVICE_TYPES: DeviceType[] = [
  'POS_TERMINAL',
  'PRINTER',
  'SCANNER',
  'CASH_DRAWER',
  'ONT',
  'ROUTER',
  'ACCESS_POINT',
  'CCTV_CAMERA',
  'DVR_NVR',
  'OTHER'
]

export const VALID_DEVICE_OWNERSHIP_TYPES: DeviceOwnershipType[] = [
  'TENANT_OWNED',
  'CUSTOMER_OWNED',
  'LEASED_RENTED'
]

export const VALID_DEVICE_STATUSES: DeviceStatus[] = [
  'IN_STOCK',
  'RESERVED',
  'INSTALLED',
  'IN_REPAIR',
  'DEFECTIVE',
  'RETURNED',
  'DECOMMISSIONED'
]

export const VALID_UNASSIGN_STATUSES: DeviceStatus[] = [
  'IN_STOCK',
  'DEFECTIVE',
  'RETURNED',
  'DECOMMISSIONED'
]

// ---------------------------------------------------------------------------
// Normalization Helpers
// ---------------------------------------------------------------------------

/**
 * Normalizes a serial number: trims whitespace, converts to uppercase.
 * Rejects empty or non-string values.
 */
export function normalizeSerialNumber(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ValidationError('Serial number must be a non-empty string')
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new ValidationError('Serial number cannot be empty')
  }
  return trimmed.toUpperCase()
}

/**
 * Normalizes a MAC address:
 * - Empty / null / undefined becomes null
 * - Strips ':' and '-'
 * - Validates exactly 12 hexadecimal characters
 * - Formats to canonical uppercase colon-separated: AA:BB:CC:DD:EE:FF
 */
export function normalizeMacAddress(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value !== 'string') {
    throw new ValidationError('MAC address must be a string or null')
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }

  // Remove common separators
  const cleanHex = trimmed.replace(/[:-]/g, '')
  if (!/^[0-9A-Fa-f]{12}$/.test(cleanHex)) {
    throw new ValidationError('Invalid MAC address format (must be 12 hexadecimal characters)')
  }

  // Group into pairs of 2 and join with colons
  const match = cleanHex.toUpperCase().match(/.{1,2}/g)
  if (!match || match.length !== 6) {
    throw new ValidationError('Invalid MAC address format')
  }
  return match.join(':')
}

// ---------------------------------------------------------------------------
// Response DTOs
// ---------------------------------------------------------------------------

export interface DeviceDto {
  id: string
  business_id: string
  branch_id: string
  product_id: string | null
  serial_number: string
  mac_address: string | null
  device_type: DeviceType
  ownership_type: DeviceOwnershipType
  status: DeviceStatus
  customer_id: string | null
  installed_address: string | null
  installed_at: string | null
  warranty_months: number | null
  warranty_expires_at: string | null
  notes: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface DeviceDetailDto extends DeviceDto {
  branch_name?: string
  product_name?: string
  product_sku?: string
  customer_name?: string
  customer_phone?: string
  service_count?: number
  recent_services?: Array<Record<string, unknown>>
}

export interface DeviceSummaryDto {
  total: number
  in_stock_count: number
  installed_count: number
  reserved_count: number
  in_repair_count: number
  defective_count: number
  returned_count: number
  decommissioned_count: number
}

export interface DeviceListResponse {
  items: DeviceDto[]
  total: number
  limit: number
  offset: number
  has_more: boolean
  summary: DeviceSummaryDto
}

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------

export interface CreateDeviceRequest {
  branch_id: string
  serial_number: string
  device_type: DeviceType
  product_id?: string | null
  mac_address?: string | null
  ownership_type?: DeviceOwnershipType
  status?: DeviceStatus
  customer_id?: string | null
  installed_address?: string | null
  installed_at?: string | null
  warranty_months?: number | null
  warranty_expires_at?: string | null
  notes?: string | null
  metadata?: Record<string, unknown>
  sync_inventory?: boolean
}

export interface BulkCreateDeviceItem {
  serial_number: string
  mac_address?: string | null
  notes?: string | null
}

export interface BulkCreateDeviceRequest {
  branch_id: string
  device_type: DeviceType
  product_id?: string | null
  ownership_type?: DeviceOwnershipType
  warranty_months?: number | null
  metadata?: Record<string, unknown>
  items: BulkCreateDeviceItem[]
  sync_inventory?: boolean
}

export interface UpdateDeviceRequest {
  branch_id?: string
  product_id?: string | null
  device_type?: DeviceType
  ownership_type?: DeviceOwnershipType
  mac_address?: string | null
  warranty_months?: number | null
  warranty_expires_at?: string | null
  notes?: string | null
  metadata?: Record<string, unknown>
}

export interface AssignDeviceRequest {
  customer_id: string
  installed_address?: string | null
  installed_at?: string | null
  notes?: string | null
}

export interface UnassignDeviceRequest {
  return_status?: DeviceStatus
  notes?: string | null
}

export interface DeviceQueryFilter {
  branch_id?: string
  customer_id?: string
  product_id?: string
  device_type?: DeviceType
  status?: DeviceStatus
  ownership_type?: DeviceOwnershipType
  search?: string
  limit: number
  offset: number
}

// ---------------------------------------------------------------------------
// Validation Functions
// ---------------------------------------------------------------------------

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

export function validateCreateDevice(body: unknown): CreateDeviceRequest {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object')
  }

  const b = body as Record<string, unknown>

  if (!b.branch_id || !isUuid(b.branch_id)) {
    throw new ValidationError('branch_id must be a valid UUID')
  }

  const serial_number = normalizeSerialNumber(b.serial_number)

  if (!b.device_type || typeof b.device_type !== 'string' || !VALID_DEVICE_TYPES.includes(b.device_type as DeviceType)) {
    throw new ValidationError(`Invalid device_type. Allowed: ${VALID_DEVICE_TYPES.join(', ')}`)
  }
  const device_type = b.device_type as DeviceType

  let product_id: string | null | undefined = undefined
  if (b.product_id !== undefined && b.product_id !== null) {
    if (!isUuid(b.product_id)) {
      throw new ValidationError('product_id must be a valid UUID')
    }
    product_id = b.product_id
  }

  const mac_address = normalizeMacAddress(b.mac_address)

  let ownership_type: DeviceOwnershipType = 'TENANT_OWNED'
  if (b.ownership_type !== undefined && b.ownership_type !== null) {
    if (typeof b.ownership_type !== 'string' || !VALID_DEVICE_OWNERSHIP_TYPES.includes(b.ownership_type as DeviceOwnershipType)) {
      throw new ValidationError(`Invalid ownership_type. Allowed: ${VALID_DEVICE_OWNERSHIP_TYPES.join(', ')}`)
    }
    ownership_type = b.ownership_type as DeviceOwnershipType
  }

  let status: DeviceStatus = 'IN_STOCK'
  if (b.status !== undefined && b.status !== null) {
    if (typeof b.status !== 'string' || !VALID_DEVICE_STATUSES.includes(b.status as DeviceStatus)) {
      throw new ValidationError(`Invalid status. Allowed: ${VALID_DEVICE_STATUSES.join(', ')}`)
    }
    status = b.status as DeviceStatus
  }

  let customer_id: string | null | undefined = undefined
  if (b.customer_id !== undefined && b.customer_id !== null) {
    if (!isUuid(b.customer_id)) {
      throw new ValidationError('customer_id must be a valid UUID')
    }
    customer_id = b.customer_id
  }

  let installed_address: string | null | undefined = undefined
  if (b.installed_address !== undefined && b.installed_address !== null) {
    if (typeof b.installed_address !== 'string') {
      throw new ValidationError('installed_address must be a string')
    }
    installed_address = b.installed_address.trim()
  }

  let installed_at: string | null | undefined = undefined
  if (b.installed_at !== undefined && b.installed_at !== null) {
    if (typeof b.installed_at !== 'string' || (!ISO_DATE_REGEX.test(b.installed_at) && isNaN(Date.parse(b.installed_at)))) {
      throw new ValidationError('installed_at must be a valid ISO date-time string')
    }
    installed_at = new Date(b.installed_at).toISOString()
  }

  let warranty_months: number | null | undefined = 12
  if (b.warranty_months !== undefined && b.warranty_months !== null) {
    const wm = Number(b.warranty_months)
    if (!Number.isInteger(wm) || wm < 0) {
      throw new ValidationError('warranty_months must be a non-negative integer')
    }
    warranty_months = wm
  }

  let warranty_expires_at: string | null | undefined = undefined
  if (b.warranty_expires_at !== undefined && b.warranty_expires_at !== null) {
    if (typeof b.warranty_expires_at !== 'string' || !DATE_REGEX.test(b.warranty_expires_at) || isNaN(Date.parse(b.warranty_expires_at))) {
      throw new ValidationError('warranty_expires_at must be a valid date in YYYY-MM-DD format')
    }
    warranty_expires_at = b.warranty_expires_at
  }

  let notes: string | null | undefined = undefined
  if (b.notes !== undefined && b.notes !== null) {
    if (typeof b.notes !== 'string') {
      throw new ValidationError('notes must be a string')
    }
    notes = b.notes.trim()
  }

  let metadata: Record<string, unknown> | undefined = undefined
  if (b.metadata !== undefined && b.metadata !== null) {
    if (typeof b.metadata !== 'object' || Array.isArray(b.metadata)) {
      throw new ValidationError('metadata must be a JSON object')
    }
    metadata = b.metadata as Record<string, unknown>
  }

  const sync_inventory = b.sync_inventory === true

  return {
    branch_id: b.branch_id,
    serial_number,
    device_type,
    product_id,
    mac_address,
    ownership_type,
    status,
    customer_id,
    installed_address,
    installed_at,
    warranty_months,
    warranty_expires_at,
    notes,
    metadata,
    sync_inventory
  }
}

export function validateBulkCreateDevice(body: unknown): BulkCreateDeviceRequest {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object')
  }

  const b = body as Record<string, unknown>

  if (!b.branch_id || !isUuid(b.branch_id)) {
    throw new ValidationError('branch_id must be a valid UUID')
  }

  if (!b.device_type || typeof b.device_type !== 'string' || !VALID_DEVICE_TYPES.includes(b.device_type as DeviceType)) {
    throw new ValidationError(`Invalid device_type. Allowed: ${VALID_DEVICE_TYPES.join(', ')}`)
  }
  const device_type = b.device_type as DeviceType

  let product_id: string | null | undefined = undefined
  if (b.product_id !== undefined && b.product_id !== null) {
    if (!isUuid(b.product_id)) {
      throw new ValidationError('product_id must be a valid UUID')
    }
    product_id = b.product_id
  }

  let ownership_type: DeviceOwnershipType = 'TENANT_OWNED'
  if (b.ownership_type !== undefined && b.ownership_type !== null) {
    if (typeof b.ownership_type !== 'string' || !VALID_DEVICE_OWNERSHIP_TYPES.includes(b.ownership_type as DeviceOwnershipType)) {
      throw new ValidationError(`Invalid ownership_type. Allowed: ${VALID_DEVICE_OWNERSHIP_TYPES.join(', ')}`)
    }
    ownership_type = b.ownership_type as DeviceOwnershipType
  }

  let warranty_months: number | null | undefined = 12
  if (b.warranty_months !== undefined && b.warranty_months !== null) {
    const wm = Number(b.warranty_months)
    if (!Number.isInteger(wm) || wm < 0) {
      throw new ValidationError('warranty_months must be a non-negative integer')
    }
    warranty_months = wm
  }

  let metadata: Record<string, unknown> | undefined = undefined
  if (b.metadata !== undefined && b.metadata !== null) {
    if (typeof b.metadata !== 'object' || Array.isArray(b.metadata)) {
      throw new ValidationError('metadata must be a JSON object')
    }
    metadata = b.metadata as Record<string, unknown>
  }

  if (!Array.isArray(b.items) || b.items.length === 0) {
    throw new ValidationError('items must be a non-empty array')
  }
  if (b.items.length > 500) {
    throw new ValidationError('Bulk registration is limited to 500 items per request')
  }

  const items: BulkCreateDeviceItem[] = []
  const seenSerials = new Set<string>()

  for (let i = 0; i < b.items.length; i++) {
    const item = b.items[i]
    if (!item || typeof item !== 'object') {
      throw new ValidationError(`Item at index ${i} must be an object`)
    }
    const itemObj = item as Record<string, unknown>
    const serial_number = normalizeSerialNumber(itemObj.serial_number)
    if (seenSerials.has(serial_number)) {
      throw new ValidationError(`Duplicate serial_number "${serial_number}" within the batch at index ${i}`)
    }
    seenSerials.add(serial_number)

    const mac_address = normalizeMacAddress(itemObj.mac_address)
    const notes = typeof itemObj.notes === 'string' ? itemObj.notes.trim() : undefined

    items.push({
      serial_number,
      mac_address,
      notes
    })
  }

  const sync_inventory = b.sync_inventory === true

  return {
    branch_id: b.branch_id,
    device_type,
    product_id,
    ownership_type,
    warranty_months,
    metadata,
    items,
    sync_inventory
  }
}

export function validateUpdateDevice(body: unknown): UpdateDeviceRequest {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object')
  }

  const b = body as Record<string, unknown>
  const result: UpdateDeviceRequest = {}

  if (b.branch_id !== undefined) {
    if (!isUuid(b.branch_id)) {
      throw new ValidationError('branch_id must be a valid UUID')
    }
    result.branch_id = b.branch_id
  }

  if (b.product_id !== undefined) {
    if (b.product_id === null) {
      result.product_id = null
    } else if (isUuid(b.product_id)) {
      result.product_id = b.product_id
    } else {
      throw new ValidationError('product_id must be a valid UUID or null')
    }
  }

  if (b.device_type !== undefined) {
    if (typeof b.device_type !== 'string' || !VALID_DEVICE_TYPES.includes(b.device_type as DeviceType)) {
      throw new ValidationError(`Invalid device_type. Allowed: ${VALID_DEVICE_TYPES.join(', ')}`)
    }
    result.device_type = b.device_type as DeviceType
  }

  if (b.ownership_type !== undefined) {
    if (typeof b.ownership_type !== 'string' || !VALID_DEVICE_OWNERSHIP_TYPES.includes(b.ownership_type as DeviceOwnershipType)) {
      throw new ValidationError(`Invalid ownership_type. Allowed: ${VALID_DEVICE_OWNERSHIP_TYPES.join(', ')}`)
    }
    result.ownership_type = b.ownership_type as DeviceOwnershipType
  }

  if (b.mac_address !== undefined) {
    result.mac_address = normalizeMacAddress(b.mac_address)
  }

  if (b.warranty_months !== undefined) {
    if (b.warranty_months === null) {
      result.warranty_months = null
    } else {
      const wm = Number(b.warranty_months)
      if (!Number.isInteger(wm) || wm < 0) {
        throw new ValidationError('warranty_months must be a non-negative integer or null')
      }
      result.warranty_months = wm
    }
  }

  if (b.warranty_expires_at !== undefined) {
    if (b.warranty_expires_at === null) {
      result.warranty_expires_at = null
    } else if (typeof b.warranty_expires_at === 'string' && DATE_REGEX.test(b.warranty_expires_at) && !isNaN(Date.parse(b.warranty_expires_at))) {
      result.warranty_expires_at = b.warranty_expires_at
    } else {
      throw new ValidationError('warranty_expires_at must be a valid date in YYYY-MM-DD format or null')
    }
  }

  if (b.notes !== undefined) {
    result.notes = typeof b.notes === 'string' ? b.notes.trim() : null
  }

  if (b.metadata !== undefined) {
    if (typeof b.metadata !== 'object' || b.metadata === null || Array.isArray(b.metadata)) {
      throw new ValidationError('metadata must be a JSON object')
    }
    result.metadata = b.metadata as Record<string, unknown>
  }

  return result
}

export function validateAssignDevice(body: unknown): AssignDeviceRequest {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object')
  }

  const b = body as Record<string, unknown>

  if (!b.customer_id || !isUuid(b.customer_id)) {
    throw new ValidationError('customer_id must be a valid UUID')
  }

  let installed_address: string | null | undefined = undefined
  if (b.installed_address !== undefined && b.installed_address !== null) {
    if (typeof b.installed_address !== 'string') {
      throw new ValidationError('installed_address must be a string')
    }
    installed_address = b.installed_address.trim()
  }

  let installed_at: string | null | undefined = undefined
  if (b.installed_at !== undefined && b.installed_at !== null) {
    if (typeof b.installed_at !== 'string' || (!ISO_DATE_REGEX.test(b.installed_at) && isNaN(Date.parse(b.installed_at)))) {
      throw new ValidationError('installed_at must be a valid ISO date-time string')
    }
    installed_at = new Date(b.installed_at).toISOString()
  }

  let notes: string | null | undefined = undefined
  if (b.notes !== undefined && b.notes !== null) {
    if (typeof b.notes !== 'string') {
      throw new ValidationError('notes must be a string')
    }
    notes = b.notes.trim()
  }

  return {
    customer_id: b.customer_id,
    installed_address,
    installed_at,
    notes
  }
}

export function validateUnassignDevice(body: unknown): UnassignDeviceRequest {
  if (!body || typeof body !== 'object') {
    return { return_status: 'IN_STOCK' }
  }

  const b = body as Record<string, unknown>
  let return_status: DeviceStatus = 'IN_STOCK'

  if (b.return_status !== undefined && b.return_status !== null) {
    if (typeof b.return_status !== 'string' || !VALID_UNASSIGN_STATUSES.includes(b.return_status as DeviceStatus)) {
      throw new ValidationError(`Invalid return_status. Allowed: ${VALID_UNASSIGN_STATUSES.join(', ')}`)
    }
    return_status = b.return_status as DeviceStatus
  }

  let notes: string | null | undefined = undefined
  if (b.notes !== undefined && b.notes !== null) {
    if (typeof b.notes !== 'string') {
      throw new ValidationError('notes must be a string')
    }
    notes = b.notes.trim()
  }

  return {
    return_status,
    notes
  }
}

export function validateDeviceQuery(query: unknown): DeviceQueryFilter {
  const q = (query && typeof query === 'object' ? query : {}) as Record<string, unknown>

  let branch_id: string | undefined = undefined
  if (typeof q.branch_id === 'string' && q.branch_id.trim()) {
    if (!isUuid(q.branch_id.trim())) {
      throw new ValidationError('branch_id must be a valid UUID')
    }
    branch_id = q.branch_id.trim()
  }

  let customer_id: string | undefined = undefined
  if (typeof q.customer_id === 'string' && q.customer_id.trim()) {
    if (!isUuid(q.customer_id.trim())) {
      throw new ValidationError('customer_id must be a valid UUID')
    }
    customer_id = q.customer_id.trim()
  }

  let product_id: string | undefined = undefined
  if (typeof q.product_id === 'string' && q.product_id.trim()) {
    if (!isUuid(q.product_id.trim())) {
      throw new ValidationError('product_id must be a valid UUID')
    }
    product_id = q.product_id.trim()
  }

  let device_type: DeviceType | undefined = undefined
  if (typeof q.device_type === 'string' && q.device_type.trim()) {
    if (!VALID_DEVICE_TYPES.includes(q.device_type.trim() as DeviceType)) {
      throw new ValidationError(`Invalid device_type filter. Allowed: ${VALID_DEVICE_TYPES.join(', ')}`)
    }
    device_type = q.device_type.trim() as DeviceType
  }

  let status: DeviceStatus | undefined = undefined
  if (typeof q.status === 'string' && q.status.trim()) {
    if (!VALID_DEVICE_STATUSES.includes(q.status.trim() as DeviceStatus)) {
      throw new ValidationError(`Invalid status filter. Allowed: ${VALID_DEVICE_STATUSES.join(', ')}`)
    }
    status = q.status.trim() as DeviceStatus
  }

  let ownership_type: DeviceOwnershipType | undefined = undefined
  if (typeof q.ownership_type === 'string' && q.ownership_type.trim()) {
    if (!VALID_DEVICE_OWNERSHIP_TYPES.includes(q.ownership_type.trim() as DeviceOwnershipType)) {
      throw new ValidationError(`Invalid ownership_type filter. Allowed: ${VALID_DEVICE_OWNERSHIP_TYPES.join(', ')}`)
    }
    ownership_type = q.ownership_type.trim() as DeviceOwnershipType
  }

  const search = typeof q.search === 'string' && q.search.trim() ? q.search.trim() : undefined

  let limit = 50
  if (q.limit !== undefined && q.limit !== null && q.limit !== '') {
    const parsed = Number(q.limit)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
      throw new ValidationError('limit must be an integer between 1 and 500')
    }
    limit = parsed
  }

  let offset = 0
  if (q.offset !== undefined && q.offset !== null && q.offset !== '') {
    const parsed = Number(q.offset)
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new ValidationError('offset must be a non-negative integer')
    }
    offset = parsed
  }

  return {
    branch_id,
    customer_id,
    product_id,
    device_type,
    status,
    ownership_type,
    search,
    limit,
    offset
  }
}
