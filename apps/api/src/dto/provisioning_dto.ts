import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'

export type ProvisioningAction = 'ACTIVATE' | 'SUSPEND' | 'RESTORE' | 'DEACTIVATE' | 'CONFIGURE'
export type ProvisioningStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export const VALID_PROVISIONING_ACTIONS: ReadonlyArray<ProvisioningAction> = [
  'ACTIVATE',
  'SUSPEND',
  'RESTORE',
  'DEACTIVATE',
  'CONFIGURE',
]

export const VALID_PROVISIONING_STATUSES: ReadonlyArray<ProvisioningStatus> = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]

export interface CreateProvisioningJobRequest {
  business_id: string
  service_code: string
  action: ProvisioningAction
  subscription_id?: string | null
  payload?: Record<string, unknown>
  idempotency_key?: string | null
}

export interface ProvisioningJobDto {
  id: string
  business_id: string
  subscription_id: string | null
  service_code: string
  action: ProvisioningAction
  status: ProvisioningStatus
  payload: Record<string, unknown>
  result: Record<string, unknown>
  error_message: string | null
  idempotency_key: string | null
  attempts: number
  max_attempts: number
  scheduled_at: string
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ProvisioningAuditLogDto {
  id: string
  job_id: string
  business_id: string
  service_code: string
  action: string
  status: string
  actor_id: string | null
  actor_scope: string
  details: Record<string, unknown>
  created_at: string
}

export function validateCreateProvisioningJob(
  input: unknown
): CreateProvisioningJobRequest {
  if (typeof input !== 'object' || input === null) {
    throw new ValidationError('Request body must be a non-null object')
  }

  const record = input as Record<string, unknown>

  const business_id = record.business_id
  if (typeof business_id !== 'string' || !isUuid(business_id)) {
    throw new ValidationError('business_id must be a valid UUID')
  }

  const service_code = record.service_code
  if (typeof service_code !== 'string' || service_code.trim().length === 0) {
    throw new ValidationError('service_code is required')
  }

  const action = record.action
  if (
    typeof action !== 'string' ||
    !VALID_PROVISIONING_ACTIONS.includes(action as ProvisioningAction)
  ) {
    throw new ValidationError(
      `action must be one of: ${VALID_PROVISIONING_ACTIONS.join(', ')}`
    )
  }

  const subscription_id = record.subscription_id
  if (
    subscription_id !== undefined &&
    subscription_id !== null &&
    (typeof subscription_id !== 'string' || !isUuid(subscription_id))
  ) {
    throw new ValidationError('subscription_id must be a valid UUID or null')
  }

  const payload = record.payload
  if (payload !== undefined && (typeof payload !== 'object' || payload === null || Array.isArray(payload))) {
    throw new ValidationError('payload must be an object')
  }

  const idempotency_key = record.idempotency_key
  if (
    idempotency_key !== undefined &&
    idempotency_key !== null &&
    typeof idempotency_key !== 'string'
  ) {
    throw new ValidationError('idempotency_key must be a string or null')
  }

  return {
    business_id,
    service_code: service_code.trim().toUpperCase(),
    action: action as ProvisioningAction,
    subscription_id: (subscription_id as string) ?? null,
    payload: (payload as Record<string, unknown>) ?? {},
    idempotency_key: typeof idempotency_key === 'string' ? idempotency_key.trim() : null,
  }
}
