import { RequestHandler, Router } from 'express'
import { Pool } from 'pg'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { createJwtService } from '../services/jwt_service'
import { isUuid } from '../utils/uuid'
import { ValidationError } from '../errors/validation_error'
import { ApiError } from '../errors/api_error'
import { createSalesSyncService } from '../services/sales_sync_service'
import { asyncHandler } from '../utils/async_handler'

export function createSalesSyncRouter(pool: Pool): Router {
  const router = Router()
  const service = createSalesSyncService(pool)
  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)

  router.use(requireSyncAuth(jwtService) as RequestHandler)

  router.get(
    '/',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const businessId = req.query.business_id as string
      const sinceRaw = req.query.since as string | undefined
      const limitRaw = req.query.limit as string | undefined

      if (!businessId || !isUuid(businessId)) {
        throw new ValidationError('business_id must be a valid UUID')
      }

      // Note: The middleware already throws 403 on tenant mismatch, so we don't need the redundant check here.

      let sinceMs = 0
      if (sinceRaw !== undefined) {
        sinceMs = Number(sinceRaw)
        if (!Number.isInteger(sinceMs) || sinceMs < 0) {
          throw new ValidationError('since must be a non-negative integer')
        }
      }

      let limit = 100
      if (limitRaw !== undefined) {
        limit = Number(limitRaw)
        if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
          throw new ValidationError('limit must be an integer between 1 and 500')
        }
      }

      const result = await service.pullSales(businessId, sinceMs, limit)
      res.status(200).json(result)
    })
  )

  router.post(
    '/batch',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const result = await service.syncBatch(req.body, req.tenantId!)
      res.status(200).json(result)
    })
  )

  return router
}
