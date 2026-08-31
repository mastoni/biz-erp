import { NextFunction, Request, RequestHandler, Response } from 'express'
import { ApiError } from '../errors/api_error'
import { isUuid } from '../utils/uuid'
import { JwtService, PlatformRole } from '../services/jwt_service'


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

export interface PlatformUser {
  userId: string
  role: PlatformRole
  sessionId: string
  jti: string
}

export interface PlatformAuthenticatedRequest extends Request {
  platformUser?: PlatformUser
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

      // Tenant routes reject platform tokens with an explicit scope error.
      if (claims.scope === 'platform') {
        next(new ApiError(403, 'WRONG_SCOPE', 'Platform token not allowed on tenant route'))
        return
      }

      const bodyBusinessId = (req.body as Record<string, unknown> | undefined)?.business_id

      if (bodyBusinessId && typeof bodyBusinessId === 'string' && bodyBusinessId.trim() !== '') {
        if (bodyBusinessId.trim() !== claims.business_id) {
          next(new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Business identity mismatch'))
          return
        }
      }

      req.user = {
        userId: claims.sub,
        businessId: claims.business_id as string,
        role: claims.role as 'OWNER' | 'CASHIER',
        sessionId: claims.session_id,
        jti: claims.jti
      }
      req.businessId = claims.business_id as string

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

export function requireRole(...roles: Array<'OWNER' | 'CASHIER'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedJwtRequest | SyncAuthenticatedRequest
    if (!authReq.user) {
      // Should not happen if requireSyncAuth or createJwtAuthMiddleware is placed before this
      next(new ApiError(401, 'UNAUTHORIZED', 'Authentication required'))
      return
    }

    if (!roles.includes(authReq.user.role)) {
      next(new ApiError(403, 'INSUFFICIENT_PERMISSIONS', 'Insufficient permissions for this action'))
      return
    }

    next()
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

      // Tenant routes reject platform tokens with an explicit scope error.
      if (claims.scope === 'platform') {
        next(new ApiError(403, 'WRONG_SCOPE', 'Platform token not allowed on tenant route'))
        return
      }

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
        businessId: claims.business_id as string,
        role: claims.role as 'OWNER' | 'CASHIER',
        sessionId: claims.session_id,
        jti: claims.jti
      }
      req.tenantId = claims.business_id as string
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

export function createPlatformJwtAuthMiddleware(jwtService: JwtService) {
  return (req: PlatformAuthenticatedRequest, _res: Response, next: NextFunction): void => {
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

      // Platform routes require an explicit platform scope. Legacy (no-scope)
      // and tenant tokens are never upgraded to platform scope.
      if (claims.scope !== 'platform') {
        next(new ApiError(403, 'WRONG_SCOPE', 'Platform scope required'))
        return
      }

      if (claims.role !== 'PLATFORM_ADMIN' && claims.role !== 'SUPER_ADMIN') {
        next(new ApiError(403, 'FORBIDDEN', 'Insufficient platform permissions'))
        return
      }

      // Platform tokens MUST NOT carry a business_id and MUST NOT populate
      // req.businessId on platform routes.
      req.platformUser = {
        userId: claims.sub,
        role: claims.role as PlatformRole,
        sessionId: claims.session_id,
        jti: claims.jti
      }

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

export function requirePlatformRole(...roles: PlatformRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const p = req as PlatformAuthenticatedRequest
    if (!p.platformUser) {
      next(new ApiError(401, 'INVALID_TOKEN', 'Platform authentication required'))
      return
    }

    if (roles.length > 0 && !roles.includes(p.platformUser.role)) {
      next(new ApiError(403, 'FORBIDDEN', 'Insufficient platform permissions'))
      return
    }

    next()
  }
}

export interface UniversalAuthenticatedUser {
  userId: string
  scope: 'tenant' | 'platform'
  sessionId: string
  jti: string
  businessId?: string
  role?: string
}

export interface UniversalAuthenticatedRequest extends Request {
  universalUser?: UniversalAuthenticatedUser
}

export function createUniversalJwtAuthMiddleware(jwtService: JwtService) {
  return (req: UniversalAuthenticatedRequest, _res: Response, next: NextFunction): void => {
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

      req.universalUser = {
        userId: claims.sub,
        scope: claims.scope || 'tenant',
        sessionId: claims.session_id,
        jti: claims.jti,
        businessId: claims.business_id as string | undefined,
        role: claims.role
      }

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
