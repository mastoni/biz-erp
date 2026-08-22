import { RequestHandler, Router } from 'express'
import { Pool } from 'pg'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { createJwtService } from '../services/jwt_service'
import { createSubscriptionService } from '../services/subscription_service'
import { asyncHandler } from '../utils/async_handler'
import { isUuid } from '../utils/uuid'
import { ValidationError } from '../errors/validation_error'
import { ConflictError } from '../errors/conflict_error'

export function createSubscriptionRoutes(pool: Pool): Router {
  const router = Router()

  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const service = createSubscriptionService(pool)

  // All subscription endpoints require a valid JWT
  router.use(requireSyncAuth(jwtService) as RequestHandler)

  // -------------------------------------------------------------------------
  // GET /v1/subscriptions
  // RBAC: OWNER + CASHIER
  // Query: business_id (required), status?, family_code?, source?, plan_code?, limit, offset
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
  // GET /v1/subscriptions/:id
  // RBAC: OWNER + CASHIER
  // -------------------------------------------------------------------------
  router.get(
    '/:id',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('Subscription id must be a valid UUID')
      }
      const subscription = await service.findById(req.params.id, req.tenantId!)
      res.status(200).json(subscription)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/subscriptions
  // RBAC: OWNER only
  // Body: SubscriptionCreateRequest
  // Header: Idempotency-Key (UUID) - optional for now
  // -------------------------------------------------------------------------
  router.post(
    '/',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const subscription = await service.create(req.body, req.tenantId!)
      res.status(201).json(subscription)
    })
  )

  // -------------------------------------------------------------------------
  // PATCH /v1/subscriptions/:id
  // RBAC: OWNER only
  // Body: SubscriptionUpdateRequest (status, metadata)
  // -------------------------------------------------------------------------
  router.patch(
    '/:id',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('Subscription id must be a valid UUID')
      }
      const subscription = await service.update(req.params.id, req.body, req.tenantId!)
      res.status(200).json(subscription)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/subscriptions/:id/activate
  // RBAC: OWNER only
  // Transition: PENDING -> ACTIVE
  // -------------------------------------------------------------------------
  router.post(
    '/:id/activate',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('Subscription id must be a valid UUID')
      }
      const subscription = await service.activate(req.params.id, req.tenantId!)
      res.status(200).json(subscription)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/subscriptions/:id/suspend
  // RBAC: OWNER only
  // Transition: ACTIVE -> SUSPENDED
  // -------------------------------------------------------------------------
  router.post(
    '/:id/suspend',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('Subscription id must be a valid UUID')
      }
      const subscription = await service.suspend(req.params.id, req.tenantId!)
      res.status(200).json(subscription)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/subscriptions/:id/cancel
  // RBAC: OWNER only
  // Transition: ACTIVE/SUSPENDED -> CANCELLED
  // -------------------------------------------------------------------------
  router.post(
    '/:id/cancel',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('Subscription id must be a valid UUID')
      }
      const subscription = await service.cancel(req.params.id, req.tenantId!)
      res.status(200).json(subscription)
    })
  )

  return router
}