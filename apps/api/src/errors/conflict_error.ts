import { ApiError } from './api_error'

export class ConflictError extends ApiError {
  constructor(code = 'VERSION_CONFLICT', message = 'Conflict', details: Record<string, unknown> = {}) {
    super(409, code, message, details)
    this.name = 'ConflictError'
  }
}
