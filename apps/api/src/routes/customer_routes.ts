import { RequestHandler, Router } from 'express'
import { Pool } from 'pg'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { createJwtService } from '../services/jwt_service'
import { createCustomerService } from '../services/customer_service'
import { asyncHandler } from '../utils/async_handler'

export function createCustomerRoutes(pool: Pool): Router {
  const router = Router()

  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const service = createCustomerService(pool)

  // All customer endpoints require a valid JWT
  router.use(requireSyncAuth(jwtService) as RequestHandler)

  // -------------------------------------------------------------------------
  // GET /v1/customers
  // RBAC: OWNER + CASHIER
  // Query: business_id (required), limit (1-500, default 50), offset (0+, default 0)
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
  // GET /v1/customers/:id
  // RBAC: OWNER + CASHIER
  // -------------------------------------------------------------------------
  router.get(
    '/:id',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const customer = await service.findById(req.params.id, req.tenantId!)
      res.status(200).json(customer)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/customers
  // RBAC: OWNER only
  // Body: { business_id, name, phone?, email? }
  // -------------------------------------------------------------------------
  router.post(
    '/',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const customer = await service.create(req.body, req.tenantId!)
      res.status(201).json(customer)
    })
  )

  // -------------------------------------------------------------------------
  // PUT /v1/customers/:id
  // RBAC: OWNER only
  // Body: { business_id, name?, phone?, email? }
  // -------------------------------------------------------------------------
  router.put(
    '/:id',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const customer = await service.update(req.params.id, req.body, req.tenantId!)
      res.status(200).json(customer)
    })
  )

  // -------------------------------------------------------------------------
  // DELETE /v1/customers/:id
  // RBAC: OWNER only
  // Soft-deletes the customer; returns 204 No Content
  // -------------------------------------------------------------------------
  router.delete(
    '/:id',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      await service.softDelete(req.params.id, req.tenantId!)
      res.status(204).send()
    })
  )

  return router
}
