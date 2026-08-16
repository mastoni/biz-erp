import { NextFunction, Request, Response } from 'express'
import { ApiError } from '../errors/api_error'
import { isUuid } from '../utils/uuid'
import { JwtService } from '../services/jwt_service'


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

export interface SyncAuthenticatedRequest extends Request {
  user?: AuthenticatedUser
  tenantId?: string
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

export function requireSyncAuth(jwtService: JwtService) {
  return (req: SyncAuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization']

    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      next(new ApiError(401, 'INVALID_TOKEN', 'Missing or invalid Authorization header'))
      return
    }

    const token = authHeader.substring(7)
    try {
      const claims = jwtService.verifyAccessToken(token)

      const queryBusinessId = req.query.business_id
      const bodyBusinessId = (req.body as Record<string, unknown> | undefined)?.business_id
      const payloadBusinessId = typeof queryBusinessId === 'string' && queryBusinessId.trim().length > 0
        ? queryBusinessId.trim()
        : typeof bodyBusinessId === 'string' && bodyBusinessId.trim().length > 0
        ? bodyBusinessId.trim()
        : undefined

      if (payloadBusinessId && payloadBusinessId !== claims.business_id) {
        next(new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Business identity mismatch'))
        return
      }

      req.user = {
        userId: claims.sub,
        businessId: claims.business_id,
        role: claims.role,
        sessionId: claims.session_id,
        jti: claims.jti
      }
      req.tenantId = claims.business_id
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