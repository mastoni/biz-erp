import { RequestHandler, Router } from 'express'
import { Pool } from 'pg'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'
import { createSalesSyncService } from '../services/sales_sync_service'
import { asyncHandler } from '../utils/async_handler'

export function createSalesSyncRouter(pool: Pool): Router {
  const router = Router()
  const service = createSalesSyncService(pool)

  router.use(requireAuth as RequestHandler)

  router.post(
    '/batch',
    asyncHandler<AuthenticatedRequest>(async (req, res) => {
      const result = await service.syncBatch(req.body, req.demoBusinessId)
      res.status(200).json(result)
    })
  )

  return router
}
