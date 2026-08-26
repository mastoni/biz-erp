import { RequestHandler, Router } from 'express'
import { Pool } from 'pg'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { createJwtService } from '../services/jwt_service'
import { asyncHandler } from '../utils/async_handler'
import { validateStockAdjustment } from '../dto/inventory_dto'
import { inventoryRepository } from '../repositories/inventory_repository'
import { branchRepository } from '../repositories/branch_repository'
import { createInventoryService } from '../services/inventory_service'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'
import crypto from 'crypto'
import { isUuid } from '../utils/uuid'

const DEFAULT_MOVEMENT_LIMIT = 50
const MAX_MOVEMENT_LIMIT = 500

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
    '/stock',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const businessId = req.query.business_id as string
      const branchId = req.query.branch_id as string
      const productId = req.query.product_id as string

      if (!businessId || !branchId || !productId) {
        throw new ApiError(400, 'BAD_REQUEST', 'business_id, branch_id, and product_id are required')
      }

      if (businessId !== req.tenantId) {
        throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Business identity mismatch')
      }

      if (!isUuid(branchId) || !isUuid(productId)) {
        throw new ValidationError('branch_id and product_id must be valid UUIDs')
      }

      const client = await pool.connect()
      try {
        const branch = await branchRepository.findById(client, businessId, branchId)
        if (!branch || !branch.status) {
          throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Branch not found or inaccessible')
        }

        const stock = await inventoryRepository.getStock(client, businessId, branchId, productId)

        if (!stock) {
          res.status(200).json({
            product_id: productId,
            branch_id: branchId,
            quantity: 0,
            server_version: 0,
          })
          return
        }

        res.status(200).json({
          product_id: stock.product_id,
          branch_id: stock.branch_id,
          quantity: stock.quantity,
          server_version: stock.server_version,
        })
      } finally {
        client.release()
      }
    })
  )

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

      if (!isUuid(branchId)) {
        throw new ValidationError('branch_id must be a valid UUID')
      }

      let productIds: string[] | undefined
      if (req.query.product_ids) {
        const raw = req.query.product_ids as string
        productIds = raw.split(',').map(s => s.trim()).filter(Boolean)
        for (const id of productIds) {
          if (!isUuid(id)) {
            throw new ValidationError('Each product_id in product_ids must be a valid UUID')
          }
        }
        if (productIds.length === 0) {
          throw new ValidationError('product_ids must contain at least one valid UUID')
        }
      }

      const client = await pool.connect()
      try {
        const branch = await branchRepository.findById(client, businessId, branchId)
        if (!branch || !branch.status) {
          throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Branch not found or inaccessible')
        }

        const stocks = await inventoryRepository.getStocks(client, businessId, branchId, productIds)
        res.status(200).json({ items: stocks })
      } finally {
        client.release()
      }
    })
  )

  router.get(
    '/summary',
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

      if (!isUuid(branchId)) {
        throw new ValidationError('branch_id must be a valid UUID')
      }

      const client = await pool.connect()
      try {
        const branch = await branchRepository.findById(client, businessId, branchId)
        if (!branch || !branch.status) {
          throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Branch not found or inaccessible')
        }

        const summary = await inventoryRepository.getStockSummary(client, businessId, branchId)
        res.status(200).json(summary)
      } finally {
        client.release()
      }
    })
  )

  router.get(
    '/movements',
    requireRole('OWNER') as RequestHandler, // CASHIER NOT ALLOWED — pending business decision
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

      if (!isUuid(branchId)) {
        throw new ValidationError('branch_id must be a valid UUID')
      }

      if (productId && !isUuid(productId)) {
        throw new ValidationError('product_id must be a valid UUID')
      }

      let limit = DEFAULT_MOVEMENT_LIMIT
      let offset = 0

      if (req.query.limit !== undefined) {
        const parsedLimit = Number(req.query.limit)
        if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_MOVEMENT_LIMIT) {
          throw new ValidationError('limit must be an integer between 1 and 500')
        }
        limit = parsedLimit
      }

      if (req.query.offset !== undefined) {
        const parsedOffset = Number(req.query.offset)
        if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
          throw new ValidationError('offset must be a non-negative integer')
        }
        offset = parsedOffset
      }

      const client = await pool.connect()
      try {
        const branch = await branchRepository.findById(client, businessId, branchId)
        if (!branch || !branch.status) {
          throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Branch not found or inaccessible')
        }

        const result = await inventoryRepository.getMovementsPaginated(client, businessId, branchId, productId, limit, offset)
        res.status(200).json(result)
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
