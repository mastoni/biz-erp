import { NextFunction, Request, Response } from 'express'
import { ApiError } from '../errors/api_error'
import { isUuid } from '../utils/uuid'
import { JwtService } from '../services/jwt_service'

export interface AuthenticatedRequest extends Request {
  demoBusinessId?: string
}

export interface AuthenticatedUser {
  userId: string
  businessId: string
  role: 'OWNER' | 'CASHIER'
  sessionId: string
  jti: string
}

export interface AuthenticatedJwtRequest extends Request {
  user?: AuthenticatedUser
  businessId?: string
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

export function createJwtAuthMiddleware(jwtService: JwtService) {
  return (req: AuthenticatedJwtRequest, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization']
    
    if (!authHeader || typeof authHeader !== 'string') {
      next(new ApiError(401, 'UNAUTHORIZED', 'Missing Authorization header'))
      return
    }

    if (!authHeader.startsWith('Bearer ')) {
      next(new ApiError(401, 'INVALID_TOKEN', 'Unsupported auth scheme'))
      return
    }

    const token = authHeader.substring(7)
    
    try {
      const claims = jwtService.verifyAccessToken(token)
      
      const bodyBusinessId = (req.body as Record<string, unknown> | undefined)?.business_id
      
      if (bodyBusinessId && typeof bodyBusinessId === 'string' && bodyBusinessId.trim() !== '') {
        if (bodyBusinessId.trim() !== claims.business_id) {
          next(new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Business identity mismatch'))
          return
        }
      }

      req.user = {
        userId: claims.sub,
        businessId: claims.business_id,
        role: claims.role,
        sessionId: claims.session_id,
        jti: claims.jti
      }
      req.businessId = claims.business_id
      
      next()
    } catch (err: any) {
      if (err instanceof ApiError) {
        next(err)
      } else {
        next(new ApiError(401, 'INVALID_TOKEN', 'Invalid or malformed token'))
      }
    }
  }
}
