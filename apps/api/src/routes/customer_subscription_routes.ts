import { RequestHandler, Router } from 'express'
import { Pool } from 'pg'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { createJwtService } from '../services/jwt_service'
import { createCustomerBillingService } from '../services/customer_billing_service'
import { asyncHandler } from '../utils/async_handler'
import { isUuid } from '../utils/uuid'
import { ValidationError } from '../errors/validation_error'
import { ApiError } from '../errors/api_error'
import {
  validateCreateCustomerSubscription,
  validateUpdateCustomerSubscription,
  validateSubscriptionAction,
  validateGenerateInvoice,
  validateSubscriptionQuery,
  isFinancialSubscriptionUpdate
} from '../dto/customer_subscription_dto'

export function createCustomerSubscriptionRoutes(pool: Pool): Router {
  const router = Router()

  const jwtSecret = process.env.JWT_SECRET || 'insecure-test-secret-that-is-at-least-32-chars-long'
  const jwtIssuer = process.env.JWT_ISSUER || 'biz-erp-api'
  const jwtAudience = process.env.JWT_AUDIENCE || 'biz-erp-client'

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const billingService = createCustomerBillingService(pool)

  router.use(requireSyncAuth(jwtService) as RequestHandler)

  // -------------------------------------------------------------------------
  // GET /v1/customer-subscriptions
  // RBAC: OWNER, STAFF, CASHIER
  // -------------------------------------------------------------------------
  router.get(
    '/',
    requireRole('OWNER', 'STAFF', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const query = validateSubscriptionQuery(req.query)
      const result = await billingService.listSubscriptions(req.tenantId!, query)
      const limit = query.limit ?? 50
      const offset = query.offset ?? 0
      res.status(200).json({
        items: result.items,
        total: result.total,
        limit,
        offset,
        has_more: offset + result.items.length < result.total
      })
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/customer-subscriptions
  // RBAC: OWNER, STAFF
  // -------------------------------------------------------------------------
  router.post(
    '/',
    requireRole('OWNER', 'STAFF') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const body = validateCreateCustomerSubscription(req.body)
      const actorContext = {
        userId: req.user?.userId,
        role: req.user?.role
      }
      const subscription = await billingService.createSubscription(req.tenantId!, body, actorContext)
      res.status(201).json(subscription)
    })
  )

  // -------------------------------------------------------------------------
  // GET /v1/customer-subscriptions/:id
  // RBAC: OWNER, STAFF, CASHIER
  // -------------------------------------------------------------------------
  router.get(
    '/:id',
    requireRole('OWNER', 'STAFF', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('Subscription ID must be a valid UUID')
      }
      const subscription = await billingService.getSubscription(req.tenantId!, req.params.id)
      res.status(200).json(subscription)
    })
  )

  // -------------------------------------------------------------------------
  // PATCH /v1/customer-subscriptions/:id
  // RBAC: OWNER (all fields), STAFF (operational non-financial fields only)
  // -------------------------------------------------------------------------
  router.patch(
    '/:id',
    requireRole('OWNER', 'STAFF') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('Subscription ID must be a valid UUID')
      }

      const body = validateUpdateCustomerSubscription(req.body)

      // Strict RBAC enforcement for financial price mutation
      if (isFinancialSubscriptionUpdate(body) && req.user?.role !== 'OWNER') {
        throw new ApiError(403, 'FORBIDDEN', 'Only OWNER may update subscription financial pricing snapshot')
      }

      const actorContext = {
        userId: req.user?.userId,
        role: req.user?.role
      }

      const updated = await billingService.updateSubscription(req.tenantId!, req.params.id, body, actorContext)
      res.status(200).json(updated)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/customer-subscriptions/:id/pause
  // RBAC: OWNER, STAFF
  // -------------------------------------------------------------------------
  router.post(
    '/:id/pause',
    requireRole('OWNER', 'STAFF') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('Subscription ID must be a valid UUID')
      }
      const body = validateSubscriptionAction(req.body)
      const actorContext = {
        userId: req.user?.userId,
        role: req.user?.role
      }
      const updated = await billingService.pauseSubscription(req.tenantId!, req.params.id, body, actorContext)
      res.status(200).json(updated)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/customer-subscriptions/:id/resume
  // RBAC: OWNER, STAFF
  // -------------------------------------------------------------------------
  router.post(
    '/:id/resume',
    requireRole('OWNER', 'STAFF') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('Subscription ID must be a valid UUID')
      }
      const body = validateSubscriptionAction(req.body)
      const actorContext = {
        userId: req.user?.userId,
        role: req.user?.role
      }
      const updated = await billingService.resumeSubscription(req.tenantId!, req.params.id, body, actorContext)
      res.status(200).json(updated)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/customer-subscriptions/:id/cancel
  // RBAC: OWNER only
  // -------------------------------------------------------------------------
  router.post(
    '/:id/cancel',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('Subscription ID must be a valid UUID')
      }
      const body = validateSubscriptionAction(req.body)
      const actorContext = {
        userId: req.user?.userId,
        role: req.user?.role
      }
      const updated = await billingService.cancelSubscription(req.tenantId!, req.params.id, body, actorContext)
      res.status(200).json(updated)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/customer-subscriptions/:id/generate-invoice
  // RBAC: OWNER, STAFF
  // -------------------------------------------------------------------------
  router.post(
    '/:id/generate-invoice',
    requireRole('OWNER', 'STAFF') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('Subscription ID must be a valid UUID')
      }
      const body = validateGenerateInvoice(req.body)
      const actorContext = {
        userId: req.user?.userId,
        role: req.user?.role
      }
      const invoice = await billingService.generateCustomerInvoice(req.tenantId!, req.params.id, body, actorContext)
      res.status(201).json(invoice)
    })
  )

  return router
}
