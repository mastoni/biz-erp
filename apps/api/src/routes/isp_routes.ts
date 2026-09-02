import { RequestHandler, Router } from 'express'
import { Pool } from 'pg'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole, requireEntitlement } from '../middleware/auth'
import { createJwtService } from '../services/jwt_service'
import { createIspService } from '../services/isp_service'
import { asyncHandler } from '../utils/async_handler'
import { isUuid } from '../utils/uuid'
import { ValidationError } from '../errors/validation_error'
import { ProvisioningAction, VALID_PROVISIONING_ACTIONS } from '../dto/provisioning_dto'

export function createIspRoutes(pool: Pool): Router {
  const router = Router()

  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const service = createIspService(pool)

  // All ISP endpoints require authentication and active ISP_MANAGEMENT entitlement
  router.use(requireSyncAuth(jwtService) as RequestHandler)
  router.use(requireEntitlement(jwtService, pool, 'ISP_MANAGEMENT') as RequestHandler)

  // ---------------------------------------------------------------------------
  // Gateway Routes
  // ---------------------------------------------------------------------------

  // POST /v1/isp/gateways
  router.post(
    '/gateways',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const result = await service.createGateway(req.tenantId!, req.body, {
        actorId: req.user?.userId,
        actorScope: 'tenant',
      })
      res.status(201).json({ success: true, data: result })
    })
  )

  // GET /v1/isp/gateways
  router.get(
    '/gateways',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const items = await service.listGateways(req.tenantId!)
      res.status(200).json({ success: true, data: items })
    })
  )

  // GET /v1/isp/gateways/:id
  router.get(
    '/gateways/:id',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const result = await service.getGatewayById(req.params.id, req.tenantId!)
      res.status(200).json({ success: true, data: result })
    })
  )

  // PATCH /v1/isp/gateways/:id
  router.patch(
    '/gateways/:id',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const result = await service.updateGateway(req.params.id, req.tenantId!, req.body)
      res.status(200).json({ success: true, data: result })
    })
  )

  // DELETE /v1/isp/gateways/:id
  router.delete(
    '/gateways/:id',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const result = await service.deleteGateway(req.params.id, req.tenantId!)
      res.status(200).json(result)
    })
  )

  // ---------------------------------------------------------------------------
  // Subscriber Routes
  // ---------------------------------------------------------------------------

  // POST /v1/isp/subscribers
  router.post(
    '/subscribers',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const result = await service.createSubscriber(req.tenantId!, req.body, {
        actorId: req.user?.userId,
        actorScope: 'tenant',
      })
      res.status(201).json({ success: true, data: result })
    })
  )

  // GET /v1/isp/subscribers
  router.get(
    '/subscribers',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const query = {
        customer_id: typeof req.query.customer_id === 'string' ? req.query.customer_id : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
      }
      const items = await service.listSubscribers(req.tenantId!, query)
      res.status(200).json({ success: true, data: items })
    })
  )

  // GET /v1/isp/subscribers/:id
  router.get(
    '/subscribers/:id',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const result = await service.getSubscriberById(req.params.id, req.tenantId!)
      res.status(200).json({ success: true, data: result })
    })
  )

  // PATCH /v1/isp/subscribers/:id
  router.patch(
    '/subscribers/:id',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const result = await service.updateSubscriber(req.params.id, req.tenantId!, req.body)
      res.status(200).json({ success: true, data: result })
    })
  )

  // POST /v1/isp/subscribers/:id/provision
  router.post(
    '/subscribers/:id/provision',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const body = req.body as Record<string, unknown>
      const action = String(body.action || '').toUpperCase() as ProvisioningAction

      if (!VALID_PROVISIONING_ACTIONS.includes(action)) {
        throw new ValidationError(`action must be one of: ${VALID_PROVISIONING_ACTIONS.join(', ')}`)
      }

      const idempotencyKey = typeof body.idempotency_key === 'string' ? body.idempotency_key : null

      const result = await service.executeProvisioningAction(
        req.params.id,
        req.tenantId!,
        action,
        idempotencyKey,
        {
          actorId: req.user?.userId,
          actorScope: 'tenant',
        }
      )

      res.status(200).json({ success: true, data: result })
    })
  )

  // GET /v1/isp/subscribers/:id/telemetry
  router.get(
    '/subscribers/:id/telemetry',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const result = await service.getDeviceTelemetry(req.params.id, req.tenantId!)
      res.status(200).json({ success: true, data: result })
    })
  )

  // POST /v1/isp/subscribers/:id/reboot
  router.post(
    '/subscribers/:id/reboot',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const result = await service.rebootDevice(req.params.id, req.tenantId!)
      res.status(200).json({ success: true, data: result })
    })
  )

  // GET /v1/isp/subscribers/:id/troubleshoot
  router.get(
    '/subscribers/:id/troubleshoot',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const result = await service.diagnoseTroubleshooting(req.params.id, req.tenantId!)
      res.status(200).json({ success: true, data: result })
    })
  )

  return router
}
