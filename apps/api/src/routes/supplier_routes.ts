import { Router, RequestHandler } from 'express'
import { Pool } from 'pg'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { createJwtService } from '../services/jwt_service'
import { createSupplierService } from '../services/supplier_service'
import { asyncHandler } from '../utils/async_handler'
import { isUuid } from '../utils/uuid'
import { ValidationError } from '../errors/validation_error'
import { createHash } from 'crypto'
import { SupplierCreateRequest, SupplierUpdateRequest } from '../dto/supplier_dto'

export function createSupplierRoutes(pool: Pool): Router {
  const router = Router()

  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const service = createSupplierService(pool)

  // -------------------------------------------------------------------------
  // Request hash helpers (server-side canonical computation)
  // -------------------------------------------------------------------------

  function computeCreateHash(body: SupplierCreateRequest): string {
    const hashStr = `create|${body.business_id}|${body.id}|${body.name}|${body.contact ?? 'null'}|${body.phone ?? 'null'}|${body.email ?? 'null'}|${body.category ?? 'null'}|${body.term}|${body.status}`
    return createHash('sha256').update(hashStr).digest('hex')
  }

  function computeUpdateHash(body: SupplierUpdateRequest, supplierId: string): string {
    const hashStr = `update|${body.business_id}|${supplierId}|${body.expected_server_version}|${body.name ?? 'null'}|${body.contact ?? 'null'}|${body.phone ?? 'null'}|${body.email ?? 'null'}|${body.category ?? 'null'}|${body.term ?? 'null'}|${body.status ?? 'null'}`
    return createHash('sha256').update(hashStr).digest('hex')
  }

  function computeDeleteHash(businessId: string, supplierId: string): string {
    const hashStr = `delete|${businessId}|${supplierId}`
    return createHash('sha256').update(hashStr).digest('hex')
  }

  function getIdempotencyKey(req: SyncAuthenticatedRequest): string {
    const key = req.headers['idempotency-key']
    if (typeof key !== 'string' || !isUuid(key)) {
      throw new ValidationError('Idempotency-Key header must be a valid UUID')
    }
    return key
  }

  // All supplier endpoints require a valid JWT
  router.use(requireSyncAuth(jwtService) as RequestHandler)

  // -------------------------------------------------------------------------
  // GET /v1/suppliers
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
  // GET /v1/suppliers/summary
  // RBAC: OWNER + CASHIER
  // Query: business_id (required)
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
  // GET /v1/suppliers/:id
  // RBAC: OWNER + CASHIER
  // -------------------------------------------------------------------------
  router.get(
    '/:id',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const supplier = await service.findById(req.params.id, req.tenantId!)
      res.status(200).json(supplier)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/suppliers
  // RBAC: OWNER only
  // Body: { id, business_id, name, contact?, phone?, email?, category?, term?, status? }
  // Header: Idempotency-Key (UUID)
  // -------------------------------------------------------------------------
  router.post(
    '/',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const idempotencyKey = getIdempotencyKey(req)
      const requestHash = computeCreateHash(req.body)
      const supplier = await service.create(req.body, idempotencyKey, requestHash, req.tenantId!)
      res.status(201).json(supplier)
    })
  )

  // -------------------------------------------------------------------------
  // PUT /v1/suppliers/:id
  // RBAC: OWNER only
  // Body: { business_id, expected_server_version, name?, contact?, phone?, email?, category?, term?, status? }
  // Header: Idempotency-Key (UUID)
  // -------------------------------------------------------------------------
  router.put(
    '/:id',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const idempotencyKey = getIdempotencyKey(req)
      const requestHash = computeUpdateHash(req.body, req.params.id)
      const supplier = await service.update(
        req.params.id,
        req.body,
        idempotencyKey,
        requestHash,
        req.tenantId!
      )
      res.status(200).json(supplier)
    })
  )

  // -------------------------------------------------------------------------
  // DELETE /v1/suppliers/:id
  // RBAC: OWNER only
  // Soft-deletes the supplier (sets deleted_at, status = nonaktif)
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
