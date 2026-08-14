import { RequestHandler, Router } from 'express'
import { Pool } from 'pg'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'
import { createProductSyncService } from '../services/product_sync_service'
import { asyncHandler } from '../utils/async_handler'

export function createProductSyncRouter(pool: Pool): Router {
  const router = Router()
  const service = createProductSyncService(pool)

  router.use(requireAuth as RequestHandler)

  router.get(
    '/',
    asyncHandler<AuthenticatedRequest>(async (req, res) => {
      const result = await service.list(req.query, req.demoBusinessId)
      res.status(200).json(result)
    })
  )

  router.put(
    '/:id',
    asyncHandler<AuthenticatedRequest>(async (req, res) => {
      const result = await service.update(req.params.id, req.body, req.demoBusinessId)
      res.status(200).json(result)
    })
  )

  return router
}
