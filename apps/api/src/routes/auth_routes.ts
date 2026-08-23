import { Router, Request, Response, NextFunction } from 'express'
import { Pool } from 'pg'
import rateLimit from 'express-rate-limit'
import { createAuthService } from '../services/auth_service'
import { createUserRepository } from '../repositories/user_repository'
import { createUserBusinessRepository } from '../repositories/user_business_repository'
import { createRefreshTokenService } from '../services/refresh_token_service'
import { createJwtService } from '../services/jwt_service'
import { createRegistrationService } from '../services/registration_service'
import { validateRegistrationRequest } from '../dto/registration_dto'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'
import { randomUUID } from 'crypto'
import { createJwtAuthMiddleware, AuthenticatedJwtRequest } from '../middleware/auth'
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
    max: 10, // Limit each IP to 10 requests per windowMs
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

      // Step 1: Authenticate user credentials
      const authResult = await authService.authenticateCredentials(email, password, business_id)

      let membership = authResult.membership

      // Step 2: Handle business selection if not provided
      if (!membership) {
        const activeBusinesses = await userBusinessRepo.listActiveBusinesses(authResult.user.id)

        if (activeBusinesses.length === 0) {
          throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'User has no active business memberships')
        }

        if (activeBusinesses.length === 1) {
          membership = activeBusinesses[0]
        } else {
          // Multiple businesses, require explicit selection
          throw new ApiError(409, 'BUSINESS_SELECTION_REQUIRED', 'Multiple active businesses found. Please provide a business_id.')
        }
      }

      // We have a confirmed membership at this point
      const userId = authResult.user.id
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
        role,
        expires_in: 900 // 15 minutes as configured in jwt_service
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

      // Step 1 & 2: Validate token and rotate session atomically
      const tokenResult = await refreshTokenService.rotateRefreshToken(refresh_token)
      const session = tokenResult.session
      
      // Step 3: Get user/business membership. Tenant sessions always carry a
      // non-null business_id; the cast preserves existing tenant behavior.
      const membership = await userBusinessRepo.findActiveMembership(session.user_id, session.business_id as string)
      
      if (!membership) {
        throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Access denied to this business')
      }

      // Step 4: Issue JWT access token
      const claims = {
        sub: session.user_id,
        scope: 'tenant' as const,
        business_id: session.business_id as string,
        role: membership.role as 'OWNER' | 'CASHIER',
        session_id: session.id,
        jti: randomUUID()
      }
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

  const jwtAuth = createJwtAuthMiddleware(jwtService)
  
  router.post('/logout', jwtAuth as RequestHandler, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedJwtRequest
      if (!authReq.user) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Unauthorized')
      }

      await refreshTokenService.revokeSession(
        authReq.user.sessionId,
        authReq.user.userId,
        authReq.user.businessId
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

  router.get('/me', jwtAuth as RequestHandler, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedJwtRequest
      if (!authReq.user) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Unauthorized')
      }

      const user = await userRepo.findById(pool, authReq.user.userId)
      if (!user) {
        throw new ApiError(401, 'UNAUTHORIZED', 'User not found')
      }

      const membership = await userBusinessRepo.findActiveMembership(authReq.user.userId, authReq.user.businessId)
      if (!membership) {
        throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Access denied to this business')
      }

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          status: user.status
        },
        business: {
          id: authReq.user.businessId,
          name: membership.business_name
        },
        role: membership.role
      })
    } catch (err) {
      next(err)
    }
  })

  return router
}

