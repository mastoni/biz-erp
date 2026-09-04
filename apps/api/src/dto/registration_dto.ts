import { ValidationError } from '../errors/validation_error'

export interface RegistrationRequest {
  email: string
  password: string
  business_name: string
  plan_code?: string
  bundle_code?: string
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
  const planCode = body.plan_code
  const bundleCode = body.bundle_code

  if (typeof email !== 'string' || email.trim().length === 0) {
    errors.email = 'Email is required'
  }

  if (typeof password !== 'string' || password.length < 8) {
    errors.password = 'Password must be at least 8 characters'
  }

  if (typeof businessName !== 'string' || businessName.trim().length === 0) {
    errors.business_name = 'Business name is required'
  }

  if (planCode !== undefined && (typeof planCode !== 'string' || planCode.trim().length === 0)) {
    errors.plan_code = 'plan_code must be a non-empty string if provided'
  }

  if (bundleCode !== undefined && (typeof bundleCode !== 'string' || bundleCode.trim().length === 0)) {
    errors.bundle_code = 'bundle_code must be a non-empty string if provided'
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Registration validation failed', errors)
  }

  const req: RegistrationRequest = {
    email: (email as string).trim(),
    password: password as string,
    business_name: (businessName as string).trim()
  }

  if (typeof planCode === 'string' && planCode.trim().length > 0) {
    req.plan_code = planCode.trim().toUpperCase()
  }

  if (typeof bundleCode === 'string' && bundleCode.trim().length > 0) {
    req.bundle_code = bundleCode.trim().toUpperCase()
  }

  return req
}
