import { Router, RequestHandler } from 'express'
import { Pool } from 'pg'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { createJwtService } from '../services/jwt_service'
import { createPurchaseService } from '../services/purchase_service'
import { asyncHandler } from '../utils/async_handler'
import { isUuid } from '../utils/uuid'
import { ValidationError } from '../errors/validation_error'
import {
  computePurchaseCreateHash,
  computePurchaseSendHash,
  computePurchaseReceiveHash,
  computePurchasePayHash,
  computePurchaseCancelHash,
} from '../dto/purchase_dto'

export function createPurchaseRoutes(pool: Pool): Router {
  const router = Router()

  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const service = createPurchaseService(pool)

  function getIdempotencyKey(req: SyncAuthenticatedRequest): string {
    const key = req.headers['idempotency-key']
    if (typeof key !== 'string' || !isUuid(key)) {
      throw new ValidationError('Idempotency-Key header must be a valid UUID')
    }
    return key
  }

  // All purchase endpoints require a valid JWT
  router.use(requireSyncAuth(jwtService) as RequestHandler)

  // -------------------------------------------------------------------------
  // GET /v1/purchases
  // RBAC: OWNER + CASHIER
  // -------------------------------------------------------------------------
  router.get(
    '/',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const result = await service.list(req.query, req.tenantId!)
      res.status(200).json(result)
    })
  )

  // -------------------------------------------------------------------------
  // GET /v1/purchases/summary
  // RBAC: OWNER + CASHIER
  // -------------------------------------------------------------------------
  router.get(
    '/summary',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const businessId =
        typeof req.query.business_id === 'string' ? req.query.business_id.trim() : req.tenantId!
      const summary = await service.getSummary(businessId, req.tenantId!)
      res.status(200).json(summary)
    })
  )

  // -------------------------------------------------------------------------
  // GET /v1/purchases/:id
  // RBAC: OWNER + CASHIER
  // -------------------------------------------------------------------------
  router.get(
    '/:id',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const po = await service.findById(req.params.id, req.tenantId!)
      res.status(200).json(po)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/purchases
  // RBAC: OWNER only
  // Header: Idempotency-Key (UUID)
  // -------------------------------------------------------------------------
  router.post(
    '/',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const idempotencyKey = getIdempotencyKey(req)
      const requestHash = computePurchaseCreateHash(req.body)
      const po = await service.create(req.body, idempotencyKey, requestHash, req.tenantId!)
      res.status(201).json(po)
    })
  )

  // -------------------------------------------------------------------------
  // PUT /v1/purchases/:id
  // RBAC: OWNER only
  // NO Idempotency-Key required (optimistic locking via expected_server_version)
  // -------------------------------------------------------------------------
  router.put(
    '/:id',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const po = await service.updateDraft(req.params.id, req.body, req.tenantId!)
      res.status(200).json(po)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/purchases/:id/send
  // RBAC: OWNER only
  // Header: Idempotency-Key (UUID)
  // -------------------------------------------------------------------------
  router.post(
    '/:id/send',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const idempotencyKey = getIdempotencyKey(req)
      const requestHash = computePurchaseSendHash(req.params.id, req.body)
      const po = await service.send(
        req.params.id,
        req.body,
        idempotencyKey,
        requestHash,
        req.tenantId!
      )
      res.status(200).json(po)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/purchases/:id/receive
  // RBAC: OWNER + CASHIER
  // Header: Idempotency-Key (UUID)
  // -------------------------------------------------------------------------
  router.post(
    '/:id/receive',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const idempotencyKey = getIdempotencyKey(req)
      const requestHash = computePurchaseReceiveHash(req.params.id, req.body)
      const actor = req.user?.userId || 'system'
      const po = await service.receive(
        req.params.id,
        req.body,
        idempotencyKey,
        requestHash,
        req.tenantId!,
        actor
      )
      res.status(200).json(po)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/purchases/:id/pay
  // RBAC: OWNER + CASHIER
  // Header: Idempotency-Key (UUID)
  // -------------------------------------------------------------------------
  router.post(
    '/:id/pay',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const idempotencyKey = getIdempotencyKey(req)
      const requestHash = computePurchasePayHash(req.params.id, req.body)
      const po = await service.pay(
        req.params.id,
        req.body,
        idempotencyKey,
        requestHash,
        req.tenantId!
      )
      res.status(200).json(po)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/purchases/:id/cancel
  // RBAC: OWNER only
  // Header: Idempotency-Key (UUID)
  // -------------------------------------------------------------------------
  router.post(
    '/:id/cancel',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const idempotencyKey = getIdempotencyKey(req)
      const requestHash = computePurchaseCancelHash(req.params.id, req.body)
      const po = await service.cancel(
        req.params.id,
        req.body,
        idempotencyKey,
        requestHash,
        req.tenantId!
      )
      res.status(200).json(po)
    })
  )

  // -------------------------------------------------------------------------
  // DELETE /v1/purchases/:id
  // RBAC: OWNER only (draft only)
  // -------------------------------------------------------------------------
  router.delete(
    '/:id',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      await service.deleteDraft(req.params.id, req.tenantId!)
      res.status(204).send()
    })
  )

  return router
}
