import { RequestHandler, Router } from 'express'
import { Pool } from 'pg'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { createJwtService } from '../services/jwt_service'
import { createCustomerBillingService } from '../services/customer_billing_service'
import { asyncHandler } from '../utils/async_handler'
import { isUuid } from '../utils/uuid'
import { ValidationError } from '../errors/validation_error'
import {
  validateRecordInvoicePayment,
  validateCancelInvoice,
  validateInvoiceQuery
} from '../dto/customer_invoice_dto'

export function createCustomerInvoiceRoutes(pool: Pool): Router {
  const router = Router()

  const jwtSecret = process.env.JWT_SECRET || 'insecure-test-secret-that-is-at-least-32-chars-long'
  const jwtIssuer = process.env.JWT_ISSUER || 'biz-erp-api'
  const jwtAudience = process.env.JWT_AUDIENCE || 'biz-erp-client'

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const billingService = createCustomerBillingService(pool)

  router.use(requireSyncAuth(jwtService) as RequestHandler)

  // -------------------------------------------------------------------------
  // GET /v1/customer-invoices
  // RBAC: OWNER, STAFF, CASHIER, CUSTOMER
  // -------------------------------------------------------------------------
  router.get(
    '/',
    requireRole('OWNER', 'STAFF', 'CASHIER', 'CUSTOMER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const query = validateInvoiceQuery(req.query)
      const result = await billingService.listInvoices(req.tenantId!, query)
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
  // GET /v1/customer-invoices/:id
  // RBAC: OWNER, STAFF, CASHIER, CUSTOMER
  // -------------------------------------------------------------------------
  router.get(
    '/:id',
    requireRole('OWNER', 'STAFF', 'CASHIER', 'CUSTOMER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('Invoice ID must be a valid UUID')
      }
      const invoice = await billingService.getInvoice(req.tenantId!, req.params.id)
      res.status(200).json(invoice)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/customer-invoices/:id/payments
  // RBAC: OWNER, STAFF, CASHIER, CUSTOMER
  // -------------------------------------------------------------------------
  router.post(
    '/:id/payments',
    requireRole('OWNER', 'STAFF', 'CASHIER', 'CUSTOMER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('Invoice ID must be a valid UUID')
      }
      const body = validateRecordInvoicePayment(req.body)
      const actorContext = {
        userId: req.user?.userId,
        role: req.user?.role
      }
      const updatedInvoice = await billingService.recordInvoicePayment(
        req.tenantId!,
        req.params.id,
        body,
        actorContext
      )
      res.status(200).json(updatedInvoice)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/customer-invoices/:id/cancel
  // RBAC: OWNER only
  // -------------------------------------------------------------------------
  router.post(
    '/:id/cancel',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('Invoice ID must be a valid UUID')
      }
      const body = validateCancelInvoice(req.body)
      const actorContext = {
        userId: req.user?.userId,
        role: req.user?.role
      }
      const updatedInvoice = await billingService.cancelInvoice(
        req.tenantId!,
        req.params.id,
        body,
        actorContext
      )
      res.status(200).json(updatedInvoice)
    })
  )

  return router
}
