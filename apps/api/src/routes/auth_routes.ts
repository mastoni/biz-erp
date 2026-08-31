import { Router, Request, Response, NextFunction } from 'express'
import { Pool } from 'pg'
import rateLimit from 'express-rate-limit'
import { createAuthService } from '../services/auth_service'
import { createUserRepository } from '../repositories/user_repository'
import { createUserBusinessRepository } from '../repositories/user_business_repository'
import { createRefreshTokenService } from '../services/refresh_token_service'
import { createJwtService, TokenRole, AccessTokenClaims } from '../services/jwt_service'
import { createRegistrationService } from '../services/registration_service'
import { validateRegistrationRequest } from '../dto/registration_dto'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'
import { randomUUID } from 'crypto'
import { createJwtAuthMiddleware, AuthenticatedJwtRequest, createUniversalJwtAuthMiddleware, UniversalAuthenticatedRequest } from '../middleware/auth'
import { RequestHandler } from 'express'

let rateLimitTestActive = false

export function createAuthRouter(pool: Pool): Router {
  const router = Router()

  const userRepo = createUserRepository(pool)
  const userBusinessRepo = createUserBusinessRepository(pool)
  const authService = createAuthService(userRepo, userBusinessRepo)
  const refreshTokenService = createRefreshTokenService(pool)

  // Use environment variables for JWT secret
  const jwtSecret = process.env.JWT_SECRET || 'insecure-test-secret-that-is-at-least-32-chars-long'
  const jwtIssuer = process.env.JWT_ISSUER || 'biz-erp-api'
  const jwtAudience = process.env.JWT_AUDIENCE || 'biz-erp-client'
  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 1000 : 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'TOO_MANY_REQUESTS', message: 'Too many login attempts, please try again later.' },
    skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-forwarded-for'],
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json(options.message)
    }
  })

  const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Limit each IP to 30 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'TOO_MANY_REQUESTS', message: 'Too many refresh attempts, please try again later.' },
    skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-forwarded-for'],
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json(options.message)
    }
  })

  const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 registration attempts per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'TOO_MANY_REQUESTS', message: 'Too many registration attempts. Please try again later.' },
    skip: (req) => {
      if (process.env.NODE_ENV === 'test') {
        const body = req.body as Record<string, unknown> | undefined
        const email = body?.email as string | undefined
        if (email && email.includes('ratelimit')) {
          rateLimitTestActive = true
        }
        return !rateLimitTestActive
      }
      return false
    },
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json(options.message)
    }
  })

  router.post('/register', registrationLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = validateRegistrationRequest(req.body)
      const registrationService = createRegistrationService(pool)

      const result = await registrationService.register(request)

      res.status(201).json({
        user_id: result.user_id,
        business_id: result.business_id,
        message: result.message
      })
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: err.message,
            details: err.details
          }
        })
        return
      }
      next(err)
    }
  })

  router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, business_id } = req.body

      if (!email || !password) {
        throw new ApiError(400, 'BAD_REQUEST', 'Email and password are required')
      }

      // Resolve the auth context selector. Default is tenant for backward
      // compatibility with existing Web/Mobile clients (no code change required).
      const rawContext = req.headers['x-auth-context']
      const authContext = (Array.isArray(rawContext) ? rawContext[0] : rawContext)?.toLowerCase() || 'tenant'
      if (authContext !== 'tenant' && authContext !== 'platform') {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Unsupported x-auth-context value')
      }

      // Step 1: Authenticate user credentials (shared for both contexts).
      // For platform context the body business_id is intentionally ignored.
      const authResult = await authService.authenticateCredentials(
        email,
        password,
        authContext === 'tenant' ? business_id : undefined
      )

      const userId = authResult.user.id

      // ---------------------------------------------------------------------
      // PLATFORM context
      // ---------------------------------------------------------------------
      if (authContext === 'platform') {
        // MVP mobile is tenant-only. Never issue a platform token to a mobile client.
        if (req.headers['x-client-type'] === 'mobile') {
          throw new ApiError(403, 'FORBIDDEN', 'Platform context is not available for mobile clients')
        }

        // Re-read the canonical platform role. The platform role lives on
        // users.platform_role; it is re-derived here (and on every refresh) so
        // revocation is reflected immediately.
        const roleResult = await pool.query('SELECT platform_role FROM users WHERE id = $1', [userId])
        const platformRole = roleResult.rows[0]?.platform_role
        if (!platformRole || (platformRole !== 'PLATFORM_ADMIN' && platformRole !== 'SUPER_ADMIN')) {
          throw new ApiError(403, 'PLATFORM_ACCESS_DENIED', 'User does not hold a platform role')
        }

        // Step 3: Create a platform refresh session (no business scope).
        const tokenResult = await refreshTokenService.createRefreshSession(userId, null, 'platform')

        // Step 4: Issue a Platform JWT. business_id MUST be absent (never null).
        const claims = {
          sub: userId,
          scope: 'platform' as const,
          role: platformRole as 'PLATFORM_ADMIN' | 'SUPER_ADMIN',
          session_id: tokenResult.session.id,
          jti: randomUUID()
        }
        const accessToken = jwtService.signAccessToken(claims)

        const isWebClient = req.headers['x-client-type'] === 'web'
        if (isWebClient) {
          const isProd = process.env.NODE_ENV === 'production'
          res.cookie('refresh_token', tokenResult.refreshToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: 'lax',
            path: '/',
            domain: process.env.COOKIE_DOMAIN || '.skmnetwork.com',
            maxAge: 7 * 24 * 60 * 60 * 1000
          })
        }

        // Step 5: Return success response (no business object / business_id).
        res.status(200).json({
          access_token: accessToken,
          ...(isWebClient ? {} : { refresh_token: tokenResult.refreshToken }),
          user: {
            id: authResult.user.id,
            email: authResult.user.email,
            status: authResult.user.status
          },
          role: platformRole,
          scope: 'platform',
          expires_in: 900
        })
        return
      }

      // ---------------------------------------------------------------------
      // TENANT context (default)
      // ---------------------------------------------------------------------
      let membership = authResult.membership

      // Step 2: Handle business selection if not provided
      if (!membership) {
        const activeBusinesses = await userBusinessRepo.listActiveBusinesses(userId)

        if (activeBusinesses.length === 0) {
          throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'User has no active business memberships')
        }

        if (activeBusinesses.length === 1) {
          membership = activeBusinesses[0]
        } else {
          // Multiple businesses, require explicit selection
          throw new ApiError(409, 'BUSINESS_SELECTION_REQUIRED', 'Multiple active businesses found. Please provide a business_id.', {
            available_businesses: activeBusinesses.map((b) => ({
              id: b.business_id,
              name: b.business_name,
              role: b.role
            }))
          })
        }
      }

      // We have a confirmed membership at this point
      const businessId = membership.business_id
      const businessName = membership.business_name
      const role = membership.role

      // Step 3: Create refresh session
      const tokenResult = await refreshTokenService.createRefreshSession(userId, businessId)

      // Step 4: Issue JWT access token
      const claims = {
        sub: userId,
        scope: 'tenant' as const,
        business_id: businessId,
        role: role as 'OWNER' | 'CASHIER',
        session_id: tokenResult.session.id,
        jti: randomUUID()
      }
      const accessToken = jwtService.signAccessToken(claims)

      const isWebClient = req.headers['x-client-type'] === 'web'

      if (isWebClient) {
        const isProd = process.env.NODE_ENV === 'production'
        res.cookie('refresh_token', tokenResult.refreshToken, {
          httpOnly: true,
          secure: isProd,
          sameSite: 'lax',
          path: '/',
          domain: process.env.COOKIE_DOMAIN || '.skmnetwork.com',
          maxAge: 7 * 24 * 60 * 60 * 1000
        })
      }

      // Fetch all active businesses for this user to support seamless tenant switching
      const allActiveBusinesses = await userBusinessRepo.listActiveBusinesses(userId)

      // Step 5: Return success response
      res.status(200).json({
        access_token: accessToken,
        ...(isWebClient ? {} : { refresh_token: tokenResult.refreshToken }),
        user: {
          id: authResult.user.id,
          email: authResult.user.email,
          status: authResult.user.status
        },
        business: {
          id: businessId,
          name: businessName
        },
        available_businesses: allActiveBusinesses.map((b) => ({
          id: b.business_id,
          name: b.business_name,
          role: b.role
        })),
        role,
        scope: 'tenant',
        expires_in: 900
      })
    } catch (err) {
      next(err)
    }
  })

  router.post('/refresh', refreshLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isWebClient = req.headers['x-client-type'] === 'web'
      const refresh_token = isWebClient ? req.cookies?.refresh_token : (req.body?.refresh_token || req.cookies?.refresh_token)

      if (!refresh_token || typeof refresh_token !== 'string') {
        throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token')
      }

      // Step 1 & 2: Validate token and rotate session atomically. Rotation
      // preserves the session's stored scope and business_id (never flipped).
      const tokenResult = await refreshTokenService.rotateRefreshToken(refresh_token)
      const session = tokenResult.session

      // Step 3: Re-derive the role from the canonical source for the session scope.
      // tenant -> user_businesses; platform -> users.platform_role. This ensures
      // revoked/missing roles are reflected immediately on refresh.
      let role: TokenRole
      if (session.scope === 'platform') {
        const client = await pool.connect()
        try {
          role = await refreshTokenService.resolveSessionRole(client, session)
        } finally {
          client.release()
        }
      } else {
        const membership = await userBusinessRepo.findActiveMembership(
          session.user_id,
          session.business_id as string
        )
        if (!membership) {
          throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Access denied to this business')
        }
        role = membership.role as TokenRole
      }

      // Step 4: Issue JWT access token. Platform tokens MUST NOT carry a
      // business_id (claim omitted entirely, never null).
      const isPlatform = session.scope === 'platform'
      const claims = {
        sub: session.user_id,
        scope: session.scope,
        role,
        session_id: session.id,
        jti: randomUUID(),
        ...(isPlatform ? {} : { business_id: session.business_id as string })
      } as Omit<AccessTokenClaims, 'iat' | 'exp' | 'iss' | 'aud'>
      const accessToken = jwtService.signAccessToken(claims)

      if (isWebClient) {
        const isProd = process.env.NODE_ENV === 'production'
        res.cookie('refresh_token', tokenResult.refreshToken, {
          httpOnly: true,
          secure: isProd,
          sameSite: 'lax',
          path: '/',
          domain: process.env.COOKIE_DOMAIN || '.skmnetwork.com',
          maxAge: 7 * 24 * 60 * 60 * 1000
        })
      }

      // Step 5: Return success response
      res.status(200).json({
        access_token: accessToken,
        ...(isWebClient ? {} : { refresh_token: tokenResult.refreshToken }),
        expires_in: 900 // 15 minutes as configured in jwt_service
      })
    } catch (err) {
      next(err)
    }
  })

  const universalJwtAuth = createUniversalJwtAuthMiddleware(jwtService)

  router.post('/logout', universalJwtAuth as RequestHandler, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as UniversalAuthenticatedRequest
      if (!authReq.universalUser) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Unauthorized')
      }

      await refreshTokenService.revokeSession(
        authReq.universalUser.sessionId,
        authReq.universalUser.userId,
        authReq.universalUser.businessId ?? null
      )

      const isWebClient = req.headers['x-client-type'] === 'web'
      if (isWebClient) {
        res.clearCookie('refresh_token', {
          path: '/',
          domain: process.env.COOKIE_DOMAIN || '.skmnetwork.com'
        })
      }

      res.status(204).end()
    } catch (err) {
      next(err)
    }
  })

  router.get('/me', universalJwtAuth as RequestHandler, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as UniversalAuthenticatedRequest
      if (!authReq.universalUser) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Unauthorized')
      }

      const user = await userRepo.findById(pool, authReq.universalUser.userId)
      if (!user) {
        throw new ApiError(401, 'UNAUTHORIZED', 'User not found')
      }

      // Platform scope
      if (authReq.universalUser.scope === 'platform') {
        const roleResult = await pool.query('SELECT platform_role FROM users WHERE id = $1', [authReq.universalUser.userId])
        const platformRole = roleResult.rows[0]?.platform_role
        if (!platformRole || (platformRole !== 'PLATFORM_ADMIN' && platformRole !== 'SUPER_ADMIN')) {
          throw new ApiError(403, 'PLATFORM_ACCESS_DENIED', 'User does not hold a platform role')
        }

        res.status(200).json({
          user: {
            id: user.id,
            email: user.email,
            status: user.status
          },
          role: platformRole,
          scope: 'platform'
        })
        return
      }

      // Tenant scope
      const membership = await userBusinessRepo.findActiveMembership(authReq.universalUser.userId, authReq.universalUser.businessId as string)
      if (!membership) {
        throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Access denied to this business')
      }

      const allActiveBusinesses = await userBusinessRepo.listActiveBusinesses(authReq.universalUser.userId)

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          status: user.status
        },
        business: {
          id: authReq.universalUser.businessId,
          name: membership.business_name
        },
        available_businesses: allActiveBusinesses.map((b) => ({
          id: b.business_id,
          name: b.business_name,
          role: b.role
        })),
        role: membership.role,
        scope: 'tenant'
      })
    } catch (err) {
      next(err)
    }
  })

  return router
}

