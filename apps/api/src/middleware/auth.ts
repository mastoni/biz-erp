import { NextFunction, Request, RequestHandler, Response } from 'express'
import { Pool } from 'pg'
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

export function createJwtAuthMiddleware(jwtService: JwtService, pool?: Pool) {
  return async (req: AuthenticatedJwtRequest, _res: Response, next: NextFunction): Promise<void> => {
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

      const businessId = claims.business_id as string

      // If pool is provided, enforce active tenant lifecycle status
      if (pool && businessId) {
        const bizRes = await pool.query('SELECT status FROM businesses WHERE id = $1', [businessId])
        if (bizRes.rows.length === 0) {
          next(new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Business not found'))
          return
        }
        const status = bizRes.rows[0].status || 'ACTIVE'
        if (status === 'PENDING_REVIEW') {
          next(new ApiError(403, 'BUSINESS_PENDING_APPROVAL', 'Business registration is pending approval by platform administrator'))
          return
        }
        if (status === 'SUSPENDED') {
          next(new ApiError(403, 'BUSINESS_SUSPENDED', 'Business account is suspended'))
          return
        }
        if (status === 'REJECTED') {
          next(new ApiError(403, 'BUSINESS_REJECTED', 'Business registration was rejected'))
          return
        }
        if (status === 'TERMINATED') {
          next(new ApiError(403, 'BUSINESS_TERMINATED', 'Business account has been terminated'))
          return
        }
      }

      req.user = {
        userId: claims.sub,
        businessId: businessId,
        role: claims.role as 'OWNER' | 'CASHIER',
        sessionId: claims.session_id,
        jti: claims.jti
      }
      req.businessId = businessId

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

export function createRequireActiveTenant(jwtService: JwtService, pool: Pool) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // Skip public, auth, and platform routes
    if (req.path.startsWith('/auth') || req.path.startsWith('/platform') || req.path.startsWith('/public') || req.path.startsWith('/health')) {
      next()
      return
    }

    const authHeader = req.headers['authorization']
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next()
      return
    }

    try {
      const token = authHeader.substring(7)
      const claims = jwtService.verifyAccessToken(token)
      if (claims.scope === 'platform' || !claims.business_id) {
        next()
        return
      }

      const res = await pool.query('SELECT status FROM businesses WHERE id = $1', [claims.business_id])
      if (res.rows.length === 0) {
        next(new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Business not found'))
        return
      }

      const status = res.rows[0].status || 'ACTIVE'
      if (status === 'PENDING_REVIEW') {
        next(new ApiError(403, 'BUSINESS_PENDING_APPROVAL', 'Business registration is pending approval by platform administrator'))
        return
      }
      if (status === 'SUSPENDED') {
        next(new ApiError(403, 'BUSINESS_SUSPENDED', 'Business account is suspended'))
        return
      }
      if (status === 'REJECTED') {
        next(new ApiError(403, 'BUSINESS_REJECTED', 'Business registration was rejected'))
        return
      }
      if (status === 'TERMINATED') {
        next(new ApiError(403, 'BUSINESS_TERMINATED', 'Business account has been terminated'))
        return
      }

      next()
    } catch {
      next()
    }
  }
}

export function requireSyncAuth(jwtService: JwtService, pool?: Pool) {
  return async (req: SyncAuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
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

      const businessId = claims.business_id as string

      // If pool is provided, enforce active tenant lifecycle status
      if (pool && businessId) {
        const bizRes = await pool.query('SELECT status FROM businesses WHERE id = $1', [businessId])
        if (bizRes.rows.length === 0) {
          next(new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Business not found'))
          return
        }
        const status = bizRes.rows[0].status || 'ACTIVE'
        if (status === 'PENDING_REVIEW') {
          next(new ApiError(403, 'BUSINESS_PENDING_APPROVAL', 'Business registration is pending approval by platform administrator'))
          return
        }
        if (status === 'SUSPENDED') {
          next(new ApiError(403, 'BUSINESS_SUSPENDED', 'Business account is suspended'))
          return
        }
        if (status === 'REJECTED') {
          next(new ApiError(403, 'BUSINESS_REJECTED', 'Business registration was rejected'))
          return
        }
        if (status === 'TERMINATED') {
          next(new ApiError(403, 'BUSINESS_TERMINATED', 'Business account has been terminated'))
          return
        }
      }

      req.user = {
        userId: claims.sub,
        businessId: businessId,
        role: claims.role as 'OWNER' | 'CASHIER',
        sessionId: claims.session_id,
        jti: claims.jti
      }
      req.tenantId = businessId
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
