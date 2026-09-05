import { RequestHandler, Router } from 'express'
import { Pool } from 'pg'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { createJwtService } from '../services/jwt_service'
import { createDeviceService } from '../services/device_service'
import { asyncHandler } from '../utils/async_handler'
import { isUuid } from '../utils/uuid'
import { ValidationError } from '../errors/validation_error'
import {
  validateCreateDevice,
  validateBulkCreateDevice,
  validateUpdateDevice,
  validateAssignDevice,
  validateUnassignDevice,
  validateDeviceQuery
} from '../dto/device_dto'

export function createDeviceRoutes(pool: Pool): Router {
  const router = Router()

  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const service = createDeviceService(pool)

  router.use(requireSyncAuth(jwtService) as RequestHandler)

  // -------------------------------------------------------------------------
  // GET /v1/devices
  // RBAC: OWNER, STAFF, CASHIER (read-only)
  // Query filters: branch_id, customer_id, product_id, device_type, status,
  //               ownership_type, search, limit, offset
  // -------------------------------------------------------------------------
  router.get(
    '/',
    requireRole('OWNER', 'STAFF', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const filters = validateDeviceQuery(req.query)
      const result = await service.listDevices(req.tenantId!, filters)
      res.status(200).json(result)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/devices
  // RBAC: OWNER, STAFF
  // Supports single registration or bulk registration (if body.items is present)
  // -------------------------------------------------------------------------
  router.post(
    '/',
    requireRole('OWNER', 'STAFF') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const actor = req.user?.userId ?? 'UNKNOWN'
      const body = req.body as Record<string, unknown>

      if (body && Array.isArray(body.items)) {
        const bulkPayload = validateBulkCreateDevice(req.body)
        const devices = await service.createBulkDevices(req.tenantId!, bulkPayload, actor)
        res.status(201).json(devices)
      } else {
        const createPayload = validateCreateDevice(req.body)
        const device = await service.createDevice(req.tenantId!, createPayload, actor)
        res.status(201).json(device)
      }
    })
  )

  // -------------------------------------------------------------------------
  // GET /v1/devices/:id
  // RBAC: OWNER, STAFF, CASHIER
  // Returns device detail with branch, product, and customer relationships
  // -------------------------------------------------------------------------
  router.get(
    '/:id',
    requireRole('OWNER', 'STAFF', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('device ID must be a valid UUID')
      }
      const device = await service.getDevice(req.tenantId!, req.params.id)
      res.status(200).json(device)
    })
  )

  // -------------------------------------------------------------------------
  // PATCH /v1/devices/:id
  // RBAC: OWNER, STAFF
  // Partial update of metadata, notes, branch, product, or warranty
  // -------------------------------------------------------------------------
  router.patch(
    '/:id',
    requireRole('OWNER', 'STAFF') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('device ID must be a valid UUID')
      }
      const patch = validateUpdateDevice(req.body)
      const updated = await service.updateDevice(req.tenantId!, req.params.id, patch)
      res.status(200).json(updated)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/devices/:id/assign
  // RBAC: OWNER, STAFF
  // Transactional assignment of an IN_STOCK device to a customer
  // -------------------------------------------------------------------------
  router.post(
    '/:id/assign',
    requireRole('OWNER', 'STAFF') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('device ID must be a valid UUID')
      }
      const actor = req.user?.userId ?? 'UNKNOWN'
      const payload = validateAssignDevice(req.body)
      const updated = await service.assignDevice(req.tenantId!, req.params.id, payload, actor)
      res.status(200).json(updated)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/devices/:id/unassign
  // RBAC: OWNER, STAFF
  // Transactional unassignment of an INSTALLED device back to stock/defective
  // -------------------------------------------------------------------------
  router.post(
    '/:id/unassign',
    requireRole('OWNER', 'STAFF') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('device ID must be a valid UUID')
      }
      const actor = req.user?.userId ?? 'UNKNOWN'
      const payload = validateUnassignDevice(req.body)
      const updated = await service.unassignDevice(req.tenantId!, req.params.id, payload, actor)
      res.status(200).json(updated)
    })
  )

  return router
}
