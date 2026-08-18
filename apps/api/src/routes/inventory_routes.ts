import { RequestHandler, Router } from 'express'
import { Pool } from 'pg'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { createJwtService } from '../services/jwt_service'
import { asyncHandler } from '../utils/async_handler'
import { validateStockAdjustment } from '../dto/inventory_dto'
import { inventoryRepository } from '../repositories/inventory_repository'
import { createInventoryService } from '../services/inventory_service'
import { ApiError } from '../errors/api_error'
import crypto from 'crypto'

export function createInventoryRoutes(pool: Pool): Router {
  const router = Router()
  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE
  const service = createInventoryService(pool)

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)

  router.use(requireSyncAuth(jwtService) as RequestHandler)

  router.get(
    '/stocks',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const businessId = req.query.business_id as string
      const branchId = req.query.branch_id as string
      
      if (!businessId || !branchId) {
          throw new ApiError(400, 'BAD_REQUEST', 'business_id and branch_id are required')
      }

      if (businessId !== req.tenantId) {
          throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Business identity mismatch')
      }

      const client = await pool.connect()
      try {
        const stocks = await inventoryRepository.getStocks(client, businessId, branchId)
        res.status(200).json({ items: stocks })
      } finally {
        client.release()
      }
    })
  )

  router.get(
    '/movements',
    requireRole('OWNER') as RequestHandler, // CASHIER NOT ALLOWED
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const businessId = req.query.business_id as string
      const branchId = req.query.branch_id as string
      const productId = req.query.product_id as string | undefined
      
      if (!businessId || !branchId) {
          throw new ApiError(400, 'BAD_REQUEST', 'business_id and branch_id are required')
      }

      if (businessId !== req.tenantId) {
          throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Business identity mismatch')
      }

      const client = await pool.connect()
      try {
        const movements = await inventoryRepository.getMovements(client, businessId, branchId, productId)
        res.status(200).json({ items: movements })
      } finally {
        client.release()
      }
    })
  )

  router.post(
    '/adjustment',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const idempotencyKey = req.headers['idempotency-key']
      if (typeof idempotencyKey !== 'string' || idempotencyKey.trim() === '') {
        throw new ApiError(400, 'BAD_REQUEST', 'Idempotency-Key header is required')
      }
      
      const data = validateStockAdjustment(req.body)

      if (data.business_id !== req.tenantId) {
         throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Business identity mismatch')
      }

      const requestHash = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex')

      const result = await service.adjustStock(data, req.user!.userId, idempotencyKey, requestHash)
      
      const statusCode = result.status === 'created' ? 201 : 200
      res.status(statusCode).json(result.data)
    })
  )

  return router
}
