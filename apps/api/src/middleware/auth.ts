import { NextFunction, Request, Response } from 'express'
import { ApiError } from '../errors/api_error'
import { isUuid } from '../utils/uuid'

export interface AuthenticatedRequest extends Request {
  demoBusinessId?: string
}

/**
 * TODO Phase 4:
 * Replace this demo identity with an authenticated tenant context.
 *
 * Current Phase 3.0.2 behavior:
 * - If X-Demo-Business-Id header exists, it must be a valid UUID.
 * - If header exists and payload/query business_id exists, both must match.
 * - If header is absent, business_id from query/body is accepted as demo identity.
 *
 * THIS IS NOT PRODUCTION SECURITY.
 */
export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers['x-demo-business-id']
  const headerValue = Array.isArray(header) ? header[0] : header

  const queryBusinessId = req.query.business_id
  const bodyBusinessId = (req.body as Record<string, unknown> | undefined)?.business_id

  const payloadBusinessId = typeof queryBusinessId === 'string' && queryBusinessId.trim().length > 0 ? queryBusinessId.trim() : typeof bodyBusinessId === 'string' && bodyBusinessId.trim().length > 0 ? bodyBusinessId.trim() : undefined

  if (headerValue) {
    const trimmedHeader = headerValue.trim()

    if (!isUuid(trimmedHeader)) {
      next(new ApiError(401, 'UNAUTHORIZED', 'Invalid X-Demo-Business-Id header'))
      return
    }

    if (payloadBusinessId && payloadBusinessId.toLowerCase() !== trimmedHeader.toLowerCase()) {
      next(new ApiError(401, 'UNAUTHORIZED', 'Business identity mismatch'))
      return
    }

    req.demoBusinessId = trimmedHeader
    next()
    return
  }

  if (payloadBusinessId) {
    if (!isUuid(payloadBusinessId)) {
      next(new ApiError(401, 'UNAUTHORIZED', 'Invalid business_id'))
      return
    }

    req.demoBusinessId = payloadBusinessId
    next()
    return
  }

  next(new ApiError(401, 'UNAUTHORIZED', 'Missing business identity. Provide X-Demo-Business-Id header or business_id.'))
}
