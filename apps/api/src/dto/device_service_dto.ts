import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'

// ---------------------------------------------------------------------------
// Canonical Types & Enums
// ---------------------------------------------------------------------------

export type DeviceServiceType =
  | 'INSTALLATION'
  | 'MAINTENANCE'
  | 'REPAIR'
  | 'REPLACEMENT'
  | 'DECOMMISSION'

export type DeviceServiceStatus =
  | 'PENDING'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'

export const VALID_DEVICE_SERVICE_TYPES: DeviceServiceType[] = [
  'INSTALLATION',
  'MAINTENANCE',
  'REPAIR',
  'REPLACEMENT',
  'DECOMMISSION'
]

export const VALID_DEVICE_SERVICE_STATUSES: DeviceServiceStatus[] = [
  'PENDING',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
]

// ---------------------------------------------------------------------------
// Response DTOs
// ---------------------------------------------------------------------------

export interface DeviceServiceDto {
  id: string
  business_id: string
  device_id: string
  customer_id: string | null
  service_type: DeviceServiceType
  status: DeviceServiceStatus
  technician_name: string | null
  scheduled_at: string | null
  completed_at: string | null
  replacement_device_id: string | null
  findings: string | null
  action_taken: string | null
  notes: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface DeviceServiceDetailDto extends DeviceServiceDto {
  device_serial?: string
  device_type?: string
  device_model?: string
  customer_name?: string
  customer_phone?: string
  replacement_device_serial?: string
}

export interface DeviceServiceListResponse {
  items: DeviceServiceDto[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------

export interface CreateDeviceServiceRequest {
  device_id: string
  service_type: DeviceServiceType
  customer_id?: string | null
  status?: DeviceServiceStatus
  technician_name?: string | null
  scheduled_at?: string | null
  replacement_device_id?: string | null
  findings?: string | null
  action_taken?: string | null
  notes?: string | null
  metadata?: Record<string, unknown>
}

export interface UpdateDeviceServiceRequest {
  status?: DeviceServiceStatus
  technician_name?: string | null
  scheduled_at?: string | null
  completed_at?: string | null
  replacement_device_id?: string | null
  findings?: string | null
  action_taken?: string | null
  notes?: string | null
  metadata?: Record<string, unknown>
}

export interface CompleteDeviceServiceRequest {
  findings?: string | null
  action_taken?: string | null
  notes?: string | null
  replacement_device_id?: string | null
  metadata?: Record<string, unknown>
}

export interface DeviceServiceQueryFilter {
  device_id?: string
  customer_id?: string
  service_type?: DeviceServiceType
  status?: DeviceServiceStatus
  technician_name?: string
  limit: number
  offset: number
}

// ---------------------------------------------------------------------------
// Validation Functions
// ---------------------------------------------------------------------------

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

export function validateCreateDeviceService(body: unknown): CreateDeviceServiceRequest {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object')
  }

  const b = body as Record<string, unknown>

  if (!b.device_id || !isUuid(b.device_id)) {
    throw new ValidationError('device_id must be a valid UUID')
  }

  if (!b.service_type || typeof b.service_type !== 'string' || !VALID_DEVICE_SERVICE_TYPES.includes(b.service_type as DeviceServiceType)) {
    throw new ValidationError(`Invalid service_type. Allowed: ${VALID_DEVICE_SERVICE_TYPES.join(', ')}`)
  }
  const service_type = b.service_type as DeviceServiceType

  let customer_id: string | null | undefined = undefined
  if (b.customer_id !== undefined && b.customer_id !== null) {
    if (!isUuid(b.customer_id)) {
      throw new ValidationError('customer_id must be a valid UUID')
    }
    customer_id = b.customer_id
  }

  let status: DeviceServiceStatus = 'PENDING'
  if (b.status !== undefined && b.status !== null) {
    if (typeof b.status !== 'string' || !VALID_DEVICE_SERVICE_STATUSES.includes(b.status as DeviceServiceStatus)) {
      throw new ValidationError(`Invalid status. Allowed: ${VALID_DEVICE_SERVICE_STATUSES.join(', ')}`)
    }
    status = b.status as DeviceServiceStatus
  }

  let technician_name: string | null | undefined = undefined
  if (b.technician_name !== undefined && b.technician_name !== null) {
    if (typeof b.technician_name !== 'string') {
      throw new ValidationError('technician_name must be a string')
    }
    technician_name = b.technician_name.trim()
  }

  let scheduled_at: string | null | undefined = undefined
  if (b.scheduled_at !== undefined && b.scheduled_at !== null) {
    if (typeof b.scheduled_at !== 'string' || (!ISO_DATE_REGEX.test(b.scheduled_at) && isNaN(Date.parse(b.scheduled_at)))) {
      throw new ValidationError('scheduled_at must be a valid ISO date-time string')
    }
    scheduled_at = new Date(b.scheduled_at).toISOString()
  }

  let replacement_device_id: string | null | undefined = undefined
  if (b.replacement_device_id !== undefined && b.replacement_device_id !== null) {
    if (!isUuid(b.replacement_device_id)) {
      throw new ValidationError('replacement_device_id must be a valid UUID')
    }
    replacement_device_id = b.replacement_device_id
  }

  let findings: string | null | undefined = undefined
  if (b.findings !== undefined && b.findings !== null) {
    if (typeof b.findings !== 'string') {
      throw new ValidationError('findings must be a string')
    }
    findings = b.findings.trim()
  }

  let action_taken: string | null | undefined = undefined
  if (b.action_taken !== undefined && b.action_taken !== null) {
    if (typeof b.action_taken !== 'string') {
      throw new ValidationError('action_taken must be a string')
    }
    action_taken = b.action_taken.trim()
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

  return {
    device_id: b.device_id,
    service_type,
    customer_id,
    status,
    technician_name,
    scheduled_at,
    replacement_device_id,
    findings,
    action_taken,
    notes,
    metadata
  }
}

export function validateUpdateDeviceService(body: unknown): UpdateDeviceServiceRequest {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object')
  }

  const b = body as Record<string, unknown>
  const result: UpdateDeviceServiceRequest = {}

  if (b.status !== undefined) {
    if (typeof b.status !== 'string' || !VALID_DEVICE_SERVICE_STATUSES.includes(b.status as DeviceServiceStatus)) {
      throw new ValidationError(`Invalid status. Allowed: ${VALID_DEVICE_SERVICE_STATUSES.join(', ')}`)
    }
    result.status = b.status as DeviceServiceStatus
  }

  if (b.technician_name !== undefined) {
    result.technician_name = typeof b.technician_name === 'string' ? b.technician_name.trim() : null
  }

  if (b.scheduled_at !== undefined) {
    if (b.scheduled_at === null) {
      result.scheduled_at = null
    } else if (typeof b.scheduled_at === 'string' && (ISO_DATE_REGEX.test(b.scheduled_at) || !isNaN(Date.parse(b.scheduled_at)))) {
      result.scheduled_at = new Date(b.scheduled_at).toISOString()
    } else {
      throw new ValidationError('scheduled_at must be a valid ISO date-time string or null')
    }
  }

  if (b.completed_at !== undefined) {
    if (b.completed_at === null) {
      result.completed_at = null
    } else if (typeof b.completed_at === 'string' && (ISO_DATE_REGEX.test(b.completed_at) || !isNaN(Date.parse(b.completed_at)))) {
      result.completed_at = new Date(b.completed_at).toISOString()
    } else {
      throw new ValidationError('completed_at must be a valid ISO date-time string or null')
    }
  }

  if (b.replacement_device_id !== undefined) {
    if (b.replacement_device_id === null) {
      result.replacement_device_id = null
    } else if (isUuid(b.replacement_device_id)) {
      result.replacement_device_id = b.replacement_device_id
    } else {
      throw new ValidationError('replacement_device_id must be a valid UUID or null')
    }
  }

  if (b.findings !== undefined) {
    result.findings = typeof b.findings === 'string' ? b.findings.trim() : null
  }

  if (b.action_taken !== undefined) {
    result.action_taken = typeof b.action_taken === 'string' ? b.action_taken.trim() : null
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

export function validateCompleteDeviceService(body: unknown, serviceType?: DeviceServiceType): CompleteDeviceServiceRequest {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>

  let replacement_device_id: string | null | undefined = undefined
  if (b.replacement_device_id !== undefined && b.replacement_device_id !== null) {
    if (!isUuid(b.replacement_device_id)) {
      throw new ValidationError('replacement_device_id must be a valid UUID')
    }
    replacement_device_id = b.replacement_device_id
  }

  // If serviceType is explicitly REPLACEMENT, replacement_device_id is required
  if (serviceType === 'REPLACEMENT' && !replacement_device_id) {
    throw new ValidationError('replacement_device_id is required when completing a REPLACEMENT work order')
  }

  let findings: string | null | undefined = undefined
  if (b.findings !== undefined && b.findings !== null) {
    if (typeof b.findings !== 'string') {
      throw new ValidationError('findings must be a string')
    }
    findings = b.findings.trim()
  }

  let action_taken: string | null | undefined = undefined
  if (b.action_taken !== undefined && b.action_taken !== null) {
    if (typeof b.action_taken !== 'string') {
      throw new ValidationError('action_taken must be a string')
    }
    action_taken = b.action_taken.trim()
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

  return {
    findings,
    action_taken,
    notes,
    replacement_device_id,
    metadata
  }
}

export function validateDeviceServiceQuery(query: unknown): DeviceServiceQueryFilter {
  const q = (query && typeof query === 'object' ? query : {}) as Record<string, unknown>

  let device_id: string | undefined = undefined
  if (typeof q.device_id === 'string' && q.device_id.trim()) {
    if (!isUuid(q.device_id.trim())) {
      throw new ValidationError('device_id must be a valid UUID')
    }
    device_id = q.device_id.trim()
  }

  let customer_id: string | undefined = undefined
  if (typeof q.customer_id === 'string' && q.customer_id.trim()) {
    if (!isUuid(q.customer_id.trim())) {
      throw new ValidationError('customer_id must be a valid UUID')
    }
    customer_id = q.customer_id.trim()
  }

  let service_type: DeviceServiceType | undefined = undefined
  if (typeof q.service_type === 'string' && q.service_type.trim()) {
    if (!VALID_DEVICE_SERVICE_TYPES.includes(q.service_type.trim() as DeviceServiceType)) {
      throw new ValidationError(`Invalid service_type filter. Allowed: ${VALID_DEVICE_SERVICE_TYPES.join(', ')}`)
    }
    service_type = q.service_type.trim() as DeviceServiceType
  }

  let status: DeviceServiceStatus | undefined = undefined
  if (typeof q.status === 'string' && q.status.trim()) {
    if (!VALID_DEVICE_SERVICE_STATUSES.includes(q.status.trim() as DeviceServiceStatus)) {
      throw new ValidationError(`Invalid status filter. Allowed: ${VALID_DEVICE_SERVICE_STATUSES.join(', ')}`)
    }
    status = q.status.trim() as DeviceServiceStatus
  }

  const technician_name = typeof q.technician_name === 'string' && q.technician_name.trim() ? q.technician_name.trim() : undefined

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
    device_id,
    customer_id,
    service_type,
    status,
    technician_name,
    limit,
    offset
  }
}
