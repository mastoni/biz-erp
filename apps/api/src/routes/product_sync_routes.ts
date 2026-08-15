import { isUuid } from '../utils/uuid'
import { ValidationError } from '../errors/validation_error'
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


  router.post(
    '/',
    asyncHandler<AuthenticatedRequest>(async (req, res) => {
      const idempotencyKey = req.headers['idempotency-key']
      if (typeof idempotencyKey !== 'string' || !isUuid(idempotencyKey)) {
        throw new ValidationError('Idempotency-Key header must be a valid UUID')
      }
      const reqBody = req.body as Record<string, any>
      const crypto = require('crypto')
      const hashStr = `${reqBody.business_id}|${reqBody.id}|${reqBody.name}|${reqBody.price_minor}`
      const requestHash = crypto.createHash('sha256').update(hashStr).digest('hex')

      const result = await service.create(req.body, idempotencyKey, requestHash, req.demoBusinessId)
      res.status(201).json(result)
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
