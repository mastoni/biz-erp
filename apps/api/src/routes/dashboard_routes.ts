import { Router, Request, Response, NextFunction } from 'express'
import { Pool } from 'pg'
import { createJwtService } from '../services/jwt_service'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { asyncHandler } from '../utils/async_handler'
import { createDashboardService } from '../services/dashboard_service'
import { ApiError } from '../errors/api_error'

export function createDashboardRoutes(pool: Pool): Router {
  const router = Router()
  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const dashboardService = createDashboardService(pool)

  router.use(requireSyncAuth(jwtService) as any)

  router.get(
    '/',
    requireRole('OWNER', 'CASHIER') as any,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const businessId = req.tenantId!
      const query = {
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
      }

      const metrics = await dashboardService.getMetrics(businessId, query)
      res.status(200).json(metrics)
    })
  )

  return router
}
