import { isUuid } from '../utils/uuid'
import { ValidationError } from '../errors/validation_error'
import { RequestHandler, Router } from 'express'
import { Pool } from 'pg'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { createProductSyncService } from '../services/product_sync_service'
import { createJwtService } from '../services/jwt_service'
import { asyncHandler } from '../utils/async_handler'

export function createProductSyncRouter(pool: Pool): Router {
  const router = Router()
  const service = createProductSyncService(pool)
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


  router.post(
    '/',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const idempotencyKey = req.headers['idempotency-key']
      if (typeof idempotencyKey !== 'string' || !isUuid(idempotencyKey)) {
        throw new ValidationError('Idempotency-Key header must be a valid UUID')
      }
      const reqBody = req.body as Record<string, any>
      const crypto = require('crypto')
      const hashStr = `${reqBody.business_id}|${reqBody.id}|${reqBody.name}|${reqBody.price_minor}`
      const requestHash = crypto.createHash('sha256').update(hashStr).digest('hex')

      const result = await service.create(req.body, idempotencyKey, requestHash, req.tenantId!)
      res.status(201).json(result)
    })
  )

  router.put(
    '/:id',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const result = await service.update(req.params.id, req.body, req.tenantId!)
      res.status(200).json(result)
    })
  )

  return router
}
