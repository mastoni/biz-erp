import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'

export interface BranchDto {
  id: string
  business_id: string
  name: string
  status: boolean
  created_at: string
  updated_at: string
}

export interface BranchCreateRequest {
  id: string
  business_id: string
  name: string
  status?: boolean
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateBranchCreate(body: unknown): BranchCreateRequest {
  if (!isObject(body)) throw new ValidationError('Request body must be a JSON object')
  const errors: Record<string, string> = {}
  
  const id = body.id
  const businessId = body.business_id
  const name = body.name

  if (typeof id !== 'string' || !isUuid(id)) errors.id = 'id must be a valid UUID'
  if (typeof businessId !== 'string' || !isUuid(businessId)) errors.business_id = 'business_id must be a valid UUID'
  if (typeof name !== 'string' || name.trim().length === 0) errors.name = 'name must be a non-empty string'

  const result: BranchCreateRequest = {
    id: typeof id === 'string' ? id.trim() : '',
    business_id: typeof businessId === 'string' ? businessId.trim() : '',
    name: typeof name === 'string' ? name.trim() : ''
  }

  if ('status' in body) {
    if (typeof body.status === 'boolean') {
      result.status = body.status
    } else {
      errors.status = 'status must be a boolean'
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Branch create validation failed', errors)
  }

  return result
}
