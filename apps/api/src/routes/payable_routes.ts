import { Router, RequestHandler } from 'express'
import { Pool } from 'pg'
import { createJwtService } from '../services/jwt_service'
import { createFinanceService } from '../services/finance_service'
import { asyncHandler } from '../utils/async_handler'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'

export function createPayableRoutes(pool: Pool): Router {
  const router = Router()

  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const service = createFinanceService(pool)

  router.use(requireSyncAuth(jwtService) as RequestHandler)

  router.post(
    '/postings/payable',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const { purchase_id } = req.body as { purchase_id: string }
      if (!purchase_id || typeof purchase_id !== 'string' || !isUuid(purchase_id)) {
        throw new ValidationError('purchase_id must be a valid UUID')
      }
      const result = await service.postPurchaseInvoice(purchase_id, req.tenantId!)
      res.status(201).json(result)
    })
  )

  router.post(
    '/postings/purchase-payment',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const { payment_id } = req.body as { payment_id: string }
      if (!payment_id || typeof payment_id !== 'string' || !isUuid(payment_id)) {
        throw new ValidationError('payment_id must be a valid UUID')
      }
      const result = await service.postPurchasePayment(payment_id, req.tenantId!)
      res.status(201).json(result)
    })
  )

  router.post(
    '/reversals/purchase-payment',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const { payment_id } = req.body as { payment_id: string }
      if (!payment_id || typeof payment_id !== 'string' || !isUuid(payment_id)) {
        throw new ValidationError('payment_id must be a valid UUID')
      }
      const result = await service.reversePurchasePayment(payment_id, req.tenantId!)
      res.status(201).json(result)
    })
  )

  return router
}
