import { RequestHandler, Router } from 'express'
import { Pool } from 'pg'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { createJwtService } from '../services/jwt_service'
import { createCustomerSyncService } from '../services/customer_sync_service'
import { asyncHandler } from '../utils/async_handler'

export function createCustomerSyncRouter(pool: Pool): Router {
  const router = Router()
  const service = createCustomerSyncService(pool)
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
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const result = await service.list(req.query, req.tenantId!)
      res.status(200).json(result)
    })
  )

  return router
}
