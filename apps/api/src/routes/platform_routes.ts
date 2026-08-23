import { Router, Request, Response, NextFunction } from 'express'
import { Pool } from 'pg'
import { createJwtService } from '../services/jwt_service'
import {
  createPlatformJwtAuthMiddleware,
  PlatformAuthenticatedRequest,
  requirePlatformRole
} from '../middleware/auth'
import { asyncHandler } from '../utils/async_handler'

export function createPlatformRoutes(_pool: Pool): Router {
  const router = Router()

  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const platformAuth = createPlatformJwtAuthMiddleware(jwtService)

  // Every platform route is gated by the platform auth middleware.
  router.use(platformAuth as any)

  // Safe, non-sensitive authenticated platform context for boundary tests.
  // Does NOT expose business scope (platform tokens carry none).
  router.get(
    '/context',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const user = req.platformUser!
      const businessId = (req as unknown as { businessId?: string }).businessId ?? null
      res.status(200).json({
        scope: 'platform',
        role: user.role,
        userId: user.userId,
        businessId
      })
    })
  )

  return router
}
