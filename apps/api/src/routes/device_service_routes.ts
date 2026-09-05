import { RequestHandler, Router } from 'express'
import { Pool } from 'pg'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { createJwtService } from '../services/jwt_service'
import { createDeviceInstallationService } from '../services/device_installation_service'
import { asyncHandler } from '../utils/async_handler'
import { isUuid } from '../utils/uuid'
import { ValidationError } from '../errors/validation_error'
import {
  validateCreateDeviceService,
  validateUpdateDeviceService,
  validateCompleteDeviceService,
  validateDeviceServiceQuery
} from '../dto/device_service_dto'

export function createDeviceServiceRoutes(pool: Pool): Router {
  const router = Router()

  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const service = createDeviceInstallationService(pool)

  router.use(requireSyncAuth(jwtService) as RequestHandler)

  // -------------------------------------------------------------------------
  // GET /v1/device-services
  // RBAC: OWNER, STAFF
  // Query filters: device_id, customer_id, service_type, status, technician_name,
  //               search, limit, offset
  // -------------------------------------------------------------------------
  router.get(
    '/',
    requireRole('OWNER', 'STAFF') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const filters = validateDeviceServiceQuery(req.query)
      const result = await service.listWorkOrders(req.tenantId!, filters)
      res.status(200).json(result)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/device-services
  // RBAC: OWNER, STAFF
  // Creates a work order (INSTALLATION, MAINTENANCE, REPAIR, REPLACEMENT, DECOMMISSION)
  // -------------------------------------------------------------------------
  router.post(
    '/',
    requireRole('OWNER', 'STAFF') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const actor = req.user?.userId ?? 'UNKNOWN'
      const payload = validateCreateDeviceService(req.body)
      const workOrder = await service.createWorkOrder(req.tenantId!, payload, actor)
      res.status(201).json(workOrder)
    })
  )

  // -------------------------------------------------------------------------
  // GET /v1/device-services/:id
  // RBAC: OWNER, STAFF
  // Returns work order detail with associated device and replacement device info
  // -------------------------------------------------------------------------
  router.get(
    '/:id',
    requireRole('OWNER', 'STAFF') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('service ID must be a valid UUID')
      }
      const workOrder = await service.getWorkOrder(req.tenantId!, req.params.id)
      res.status(200).json(workOrder)
    })
  )

  // -------------------------------------------------------------------------
  // PATCH /v1/device-services/:id
  // RBAC: OWNER, STAFF
  // Updates status, technician, scheduled date, findings, or notes
  // -------------------------------------------------------------------------
  router.patch(
    '/:id',
    requireRole('OWNER', 'STAFF') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('service ID must be a valid UUID')
      }
      const patch = validateUpdateDeviceService(req.body)
      const updated = await service.updateWorkOrder(req.tenantId!, req.params.id, patch)
      res.status(200).json(updated)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/device-services/:id/complete
  // RBAC: OWNER, STAFF
  // Completes work order. For REPLACEMENT, executes atomic RMA hardware swap
  // -------------------------------------------------------------------------
  router.post(
    '/:id/complete',
    requireRole('OWNER', 'STAFF') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('service ID must be a valid UUID')
      }
      const actor = req.user?.userId ?? 'UNKNOWN'
      const payload = validateCompleteDeviceService(req.body)
      const completed = await service.completeWorkOrder(req.tenantId!, req.params.id, payload, actor)
      res.status(200).json(completed)
    })
  )

  return router
}
