import { ValidationError } from '../errors/validation_error'

export interface UserDto {
  id: string
  email: string
  role: 'OWNER' | 'CASHIER'
  status: string
  created_at: string
}

export interface UserListResponse {
  items: UserDto[]
  total: number
}

export interface CreateUserRequest {
  email: string
  password: string
  role: 'OWNER' | 'CASHIER'
}

export interface RevokeUserRequest {
  status: 'REVOKED'
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateCreateUser(body: unknown): CreateUserRequest {
  if (!isObject(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  const errors: Record<string, string> = {}

  const email = body.email
  const password = body.password
  const role = body.role

  if (typeof email !== 'string' || email.trim().length === 0) {
    errors.email = 'Email is required'
  }

  if (typeof password !== 'string' || password.length < 8) {
    errors.password = 'Password must be at least 8 characters'
  }

  if (role !== 'OWNER' && role !== 'CASHIER') {
    errors.role = 'Role must be OWNER or CASHIER'
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Create user validation failed', errors)
  }

  return {
    email: (email as string).trim(),
    password: password as string,
    role: role as 'OWNER' | 'CASHIER'
  }
}

export function validateRevokeUser(body: unknown): RevokeUserRequest {
  if (!isObject(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  const status = body.status

  if (status !== 'REVOKED') {
    throw new ValidationError('Status must be REVOKED')
  }

  return { status: 'REVOKED' as const }
}
