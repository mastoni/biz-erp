import { ApiError } from './api_error'

export class ValidationError extends ApiError {
  constructor(message = 'Validation failed', details: Record<string, unknown> = {}) {
    super(400, 'VALIDATION_ERROR', message, details)
    this.name = 'ValidationError'
  }
}
