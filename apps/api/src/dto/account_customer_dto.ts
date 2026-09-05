import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'

export type AccountCustomerType = 'INDIVIDUAL' | 'BUSINESS' | 'ENTERPRISE'
export type AccountCustomerStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED'
export type AccountCustomerUserRole = 'PRIMARY_CONTACT' | 'BILLING_ADMIN' | 'AUTHORIZED_USER'
export type AccountCustomerUserStatus = 'ACTIVE' | 'INACTIVE' | 'REVOKED'

export interface AccountCustomerDto {
  id: string
  code: string
  name: string
  account_type: AccountCustomerType
  tax_id: string | null
  billing_email: string | null
  billing_phone: string | null
  status: AccountCustomerStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AccountCustomerDetailDto extends AccountCustomerDto {
  business_count: number
  active_subscription_count: number
  user_count: number
}

export interface AccountCustomerUserDto {
  id: string
  account_customer_id: string
  user_id: string
  email?: string
  role: AccountCustomerUserRole
  status: AccountCustomerUserStatus
  created_at: string
  updated_at: string
}

export interface AccountCustomerSummary {
  total: number
  active_count: number
  pending_count: number
  suspended_count: number
  terminated_count: number
}

export interface AccountCustomerListResponse {
  items: AccountCustomerDto[]
  total: number
  limit: number
  offset: number
  has_more: boolean
  summary: AccountCustomerSummary
}

export interface CreateAccountCustomerRequest {
  name: string
  account_type: AccountCustomerType
  code?: string
  tax_id?: string | null
  billing_email?: string | null
  billing_phone?: string | null
  status?: AccountCustomerStatus
  metadata?: Record<string, unknown>
}

export interface UpdateAccountCustomerRequest {
  name?: string
  account_type?: AccountCustomerType
  tax_id?: string | null
  billing_email?: string | null
  billing_phone?: string | null
  metadata?: Record<string, unknown>
}

export interface ChangeAccountCustomerStatusRequest {
  status: AccountCustomerStatus
  reason?: string
}

export interface AddAccountCustomerUserRequest {
  user_id: string
  role: AccountCustomerUserRole
  status?: AccountCustomerUserStatus
}

export interface UpdateAccountCustomerUserRequest {
  role?: AccountCustomerUserRole
  status?: AccountCustomerUserStatus
}

export interface ReconcileBusinessRequest {
  business_id: string
  expected_current_account_customer_id?: string | null
  confirm_reassignment?: boolean
  reason?: string
}

export interface ReconcileBusinessResponse {
  message: string
  business_id: string
  account_customer_id: string
  previous_account_customer_id: string | null
  subscriptions_synced_count: number
}

export interface UnlinkBusinessResponse {
  message: string
  business_id: string
  previous_account_customer_id: string
  subscriptions_unlinked_count: number
}

const VALID_ACCOUNT_TYPES: AccountCustomerType[] = ['INDIVIDUAL', 'BUSINESS', 'ENTERPRISE']
const VALID_ACCOUNT_STATUSES: AccountCustomerStatus[] = ['PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED']
const VALID_USER_ROLES: AccountCustomerUserRole[] = ['PRIMARY_CONTACT', 'BILLING_ADMIN', 'AUTHORIZED_USER']
const VALID_USER_STATUSES: AccountCustomerUserStatus[] = ['ACTIVE', 'INACTIVE', 'REVOKED']

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateCreateAccountCustomer(body: unknown): CreateAccountCustomerRequest {
  if (!isObject(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  if (typeof body.name !== 'string' || body.name.trim().length === 0) {
    throw new ValidationError('name is required and must be a non-empty string')
  }

  if (!body.account_type || !VALID_ACCOUNT_TYPES.includes(body.account_type as AccountCustomerType)) {
    throw new ValidationError(`account_type must be one of: ${VALID_ACCOUNT_TYPES.join(', ')}`)
  }

  if (body.status !== undefined && !VALID_ACCOUNT_STATUSES.includes(body.status as AccountCustomerStatus)) {
    throw new ValidationError(`status must be one of: ${VALID_ACCOUNT_STATUSES.join(', ')}`)
  }

  if (body.code !== undefined && typeof body.code !== 'string') {
    throw new ValidationError('code must be a string')
  }

  return {
    name: body.name.trim(),
    account_type: body.account_type as AccountCustomerType,
    code: typeof body.code === 'string' ? body.code.trim() : undefined,
    tax_id: typeof body.tax_id === 'string' ? body.tax_id.trim() : (body.tax_id === null ? null : undefined),
    billing_email: typeof body.billing_email === 'string' ? body.billing_email.trim().toLowerCase() : (body.billing_email === null ? null : undefined),
    billing_phone: typeof body.billing_phone === 'string' ? body.billing_phone.trim() : (body.billing_phone === null ? null : undefined),
    status: (body.status as AccountCustomerStatus) ?? 'ACTIVE',
    metadata: isObject(body.metadata) ? body.metadata : {},
  }
}

export function validateUpdateAccountCustomer(body: unknown): UpdateAccountCustomerRequest {
  if (!isObject(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  const result: UpdateAccountCustomerRequest = {}

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      throw new ValidationError('name must be a non-empty string')
    }
    result.name = body.name.trim()
  }

  if (body.account_type !== undefined) {
    if (!VALID_ACCOUNT_TYPES.includes(body.account_type as AccountCustomerType)) {
      throw new ValidationError(`account_type must be one of: ${VALID_ACCOUNT_TYPES.join(', ')}`)
    }
    result.account_type = body.account_type as AccountCustomerType
  }

  if (body.tax_id !== undefined) {
    result.tax_id = typeof body.tax_id === 'string' ? body.tax_id.trim() : null
  }

  if (body.billing_email !== undefined) {
    result.billing_email = typeof body.billing_email === 'string' ? body.billing_email.trim().toLowerCase() : null
  }

  if (body.billing_phone !== undefined) {
    result.billing_phone = typeof body.billing_phone === 'string' ? body.billing_phone.trim() : null
  }

  if (body.metadata !== undefined) {
    if (!isObject(body.metadata)) {
      throw new ValidationError('metadata must be an object')
    }
    result.metadata = body.metadata
  }

  return result
}

export function validateChangeAccountCustomerStatus(body: unknown): ChangeAccountCustomerStatusRequest {
  if (!isObject(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  if (!body.status || !VALID_ACCOUNT_STATUSES.includes(body.status as AccountCustomerStatus)) {
    throw new ValidationError(`status must be one of: ${VALID_ACCOUNT_STATUSES.join(', ')}`)
  }

  return {
    status: body.status as AccountCustomerStatus,
    reason: typeof body.reason === 'string' ? body.reason.trim() : undefined,
  }
}

export function validateAddAccountCustomerUser(body: unknown): AddAccountCustomerUserRequest {
  if (!isObject(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  if (typeof body.user_id !== 'string' || !isUuid(body.user_id)) {
    throw new ValidationError('user_id must be a valid UUID')
  }

  if (!body.role || !VALID_USER_ROLES.includes(body.role as AccountCustomerUserRole)) {
    throw new ValidationError(`role must be one of: ${VALID_USER_ROLES.join(', ')}`)
  }

  if (body.status !== undefined && !VALID_USER_STATUSES.includes(body.status as AccountCustomerUserStatus)) {
    throw new ValidationError(`status must be one of: ${VALID_USER_STATUSES.join(', ')}`)
  }

  return {
    user_id: body.user_id,
    role: body.role as AccountCustomerUserRole,
    status: (body.status as AccountCustomerUserStatus) ?? 'ACTIVE',
  }
}

export function validateUpdateAccountCustomerUser(body: unknown): UpdateAccountCustomerUserRequest {
  if (!isObject(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  const result: UpdateAccountCustomerUserRequest = {}

  if (body.role !== undefined) {
    if (!VALID_USER_ROLES.includes(body.role as AccountCustomerUserRole)) {
      throw new ValidationError(`role must be one of: ${VALID_USER_ROLES.join(', ')}`)
    }
    result.role = body.role as AccountCustomerUserRole
  }

  if (body.status !== undefined) {
    if (!VALID_USER_STATUSES.includes(body.status as AccountCustomerUserStatus)) {
      throw new ValidationError(`status must be one of: ${VALID_USER_STATUSES.join(', ')}`)
    }
    result.status = body.status as AccountCustomerUserStatus
  }

  return result
}

export function validateReconcileBusiness(body: unknown): ReconcileBusinessRequest {
  if (!isObject(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  if (typeof body.business_id !== 'string' || !isUuid(body.business_id)) {
    throw new ValidationError('business_id must be a valid UUID')
  }

  if (body.expected_current_account_customer_id !== undefined && body.expected_current_account_customer_id !== null) {
    if (typeof body.expected_current_account_customer_id !== 'string' || !isUuid(body.expected_current_account_customer_id)) {
      throw new ValidationError('expected_current_account_customer_id must be a valid UUID or null')
    }
  }

  return {
    business_id: body.business_id,
    expected_current_account_customer_id: body.expected_current_account_customer_id !== undefined ? (body.expected_current_account_customer_id as string | null) : undefined,
    confirm_reassignment: Boolean(body.confirm_reassignment),
    reason: typeof body.reason === 'string' ? body.reason.trim() : undefined,
  }
}
