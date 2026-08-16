import { Router, Request, Response, NextFunction } from 'express'
import { Pool } from 'pg'
import { createAuthService } from '../services/auth_service'
import { createUserRepository } from '../repositories/user_repository'
import { createUserBusinessRepository } from '../repositories/user_business_repository'
import { createRefreshTokenService } from '../services/refresh_token_service'
import { createJwtService } from '../services/jwt_service'
import { ApiError } from '../errors/api_error'
import { randomUUID } from 'crypto'

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

  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
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
        business_id: businessId,
        role: role as 'OWNER' | 'CASHIER',
        session_id: tokenResult.session.id,
        jti: randomUUID()
      }
      const accessToken = jwtService.signAccessToken(claims)

      // Step 5: Return success response
      res.status(200).json({
        access_token: accessToken,
        refresh_token: tokenResult.refreshToken,
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

  router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refresh_token } = req.body

      if (!refresh_token || typeof refresh_token !== 'string') {
        throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token')
      }

      // Step 1 & 2: Validate token and rotate session atomically
      const tokenResult = await refreshTokenService.rotateRefreshToken(refresh_token)
      const session = tokenResult.session
      
      // Step 3: Get user/business membership
      const membership = await userBusinessRepo.findActiveMembership(session.user_id, session.business_id)
      
      if (!membership) {
        throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Access denied to this business')
      }

      // Step 4: Issue JWT access token
      const claims = {
        sub: session.user_id,
        business_id: session.business_id,
        role: membership.role as 'OWNER' | 'CASHIER',
        session_id: session.id,
        jti: randomUUID()
      }
      const accessToken = jwtService.signAccessToken(claims)

      // Step 5: Return success response
      res.status(200).json({
        access_token: accessToken,
        refresh_token: tokenResult.refreshToken,
        expires_in: 900 // 15 minutes as configured in jwt_service
      })
    } catch (err) {
      next(err)
    }
  })

  return router
}

