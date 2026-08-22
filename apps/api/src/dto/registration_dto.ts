import { ValidationError } from '../errors/validation_error'

export interface RegistrationRequest {
  email: string
  password: string
  business_name: string
}

export interface RegistrationResponse {
  user_id: string
  business_id: string
  message: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateRegistrationRequest(body: unknown): RegistrationRequest {
  if (!isObject(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  const errors: Record<string, string> = {}

  const email = body.email
  const password = body.password
  const businessName = body.business_name

  if (typeof email !== 'string' || email.trim().length === 0) {
    errors.email = 'Email is required'
  }

  if (typeof password !== 'string' || password.length < 8) {
    errors.password = 'Password must be at least 8 characters'
  }

  if (typeof businessName !== 'string' || businessName.trim().length === 0) {
    errors.business_name = 'Business name is required'
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Registration validation failed', errors)
  }

  return {
    email: (email as string).trim(),
    password: password as string,
    business_name: (businessName as string).trim()
  }
}
