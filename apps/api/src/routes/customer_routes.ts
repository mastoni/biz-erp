import { RequestHandler, Router } from 'express'
import { Pool } from 'pg'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { createJwtService } from '../services/jwt_service'
import { createCustomerService } from '../services/customer_service'
import { asyncHandler } from '../utils/async_handler'
import { isUuid } from '../utils/uuid'
import { ValidationError } from '../errors/validation_error'
import { createHash } from 'crypto'

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

  // -------------------------------------------------------------------------
  // Request hash helpers (server-side canonical computation)
  // -------------------------------------------------------------------------
  function computeCreateHash(reqBody: Record<string, any>): string {
    const hashStr = `create|${reqBody.business_id}|${reqBody.id}|${reqBody.name}|${reqBody.phone ?? 'null'}|${reqBody.email ?? 'null'}`
    return createHash('sha256').update(hashStr).digest('hex')
  }

  function computeUpdateHash(reqBody: Record<string, any>, customerId: string): string {
    const hashStr = `update|${reqBody.business_id}|${customerId}|${reqBody.expected_server_version}|${reqBody.name ?? 'null'}|${reqBody.phone ?? 'null'}|${reqBody.email ?? 'null'}`
    return createHash('sha256').update(hashStr).digest('hex')
  }

  function computeDeleteHash(businessId: string, customerId: string): string {
    const hashStr = `delete|${businessId}|${customerId}`
    return createHash('sha256').update(hashStr).digest('hex')
  }

  function getIdempotencyKey(req: SyncAuthenticatedRequest): string {
    const key = req.headers['idempotency-key']
    if (typeof key !== 'string' || !isUuid(key)) {
      throw new ValidationError('Idempotency-Key header must be a valid UUID')
    }
    return key
  }

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
  // Body: { id, business_id, name, phone?, email? }
  // Header: Idempotency-Key (UUID)
  // -------------------------------------------------------------------------
  router.post(
    '/',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const idempotencyKey = getIdempotencyKey(req)
      const requestHash = computeCreateHash(req.body)
      const customer = await service.create(req.body, idempotencyKey, requestHash, req.tenantId!)
      res.status(201).json(customer)
    })
  )

  // -------------------------------------------------------------------------
  // PUT /v1/customers/:id
  // RBAC: OWNER only
  // Body: { business_id, expected_server_version, name?, phone?, email? }
  // Header: Idempotency-Key (UUID)
  // -------------------------------------------------------------------------
  router.put(
    '/:id',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const idempotencyKey = getIdempotencyKey(req)
      const requestHash = computeUpdateHash(req.body, req.params.id)
      const customer = await service.update(req.params.id, req.body, idempotencyKey, requestHash, req.tenantId!)
      res.status(200).json(customer)
    })
  )

  // -------------------------------------------------------------------------
  // DELETE /v1/customers/:id
  // RBAC: OWNER only
  // Soft-deletes the customer; returns 204 No Content
  // Header: Idempotency-Key (UUID)
  // -------------------------------------------------------------------------
  router.delete(
    '/:id',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const idempotencyKey = getIdempotencyKey(req)
      const requestHash = computeDeleteHash(req.tenantId!, req.params.id)
      await service.softDelete(req.params.id, idempotencyKey, requestHash, req.tenantId!)
      res.status(204).send()
    })
  )

  return router
}
