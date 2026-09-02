import { RequestHandler, Router } from 'express'
import { Pool } from 'pg'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { createJwtService } from '../services/jwt_service'
import { createProvisioningService } from '../services/provisioning_service'
import { asyncHandler } from '../utils/async_handler'
import { isUuid } from '../utils/uuid'
import { ValidationError } from '../errors/validation_error'

export function createProvisioningRoutes(pool: Pool): Router {
  const router = Router()

  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const service = createProvisioningService(pool)

  // All provisioning endpoints require a valid JWT
  router.use(requireSyncAuth(jwtService) as RequestHandler)

  // -------------------------------------------------------------------------
  // GET /v1/provisioning/jobs
  // RBAC: OWNER + CASHIER
  // Query: status?, service_code?, action?, limit, offset
  // -------------------------------------------------------------------------
  router.get(
    '/jobs',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const result = await service.listJobs(req.query, req.tenantId!)
      res.status(200).json(result)
    })
  )

  // -------------------------------------------------------------------------
  // GET /v1/provisioning/jobs/:id
  // RBAC: OWNER + CASHIER
  // -------------------------------------------------------------------------
  router.get(
    '/jobs/:id',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('Job id must be a valid UUID')
      }
      const job = await service.getJobById(req.params.id, req.tenantId!)
      res.status(200).json(job)
    })
  )

  // -------------------------------------------------------------------------
  // GET /v1/provisioning/jobs/:id/logs
  // RBAC: OWNER + CASHIER
  // -------------------------------------------------------------------------
  router.get(
    '/jobs/:id/logs',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('Job id must be a valid UUID')
      }
      const logs = await service.getAuditLogs(req.params.id, req.tenantId!)
      res.status(200).json({ items: logs })
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/provisioning/jobs
  // RBAC: OWNER only
  // Body: CreateProvisioningJobRequest
  // -------------------------------------------------------------------------
  router.post(
    '/jobs',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const job = await service.createJob(req.body, req.tenantId!, {
        actorId: req.user?.userId,
        actorScope: 'tenant',
      })
      // Execute job transition
      const processedJob = await service.processJob(job.id, req.tenantId!, {
        actorId: req.user?.userId,
        actorScope: 'tenant',
      })
      res.status(201).json(processedJob)
    })
  )

  // -------------------------------------------------------------------------
  // POST /v1/provisioning/jobs/:id/retry
  // RBAC: OWNER only
  // -------------------------------------------------------------------------
  router.post(
    '/jobs/:id/retry',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('Job id must be a valid UUID')
      }
      const retriedJob = await service.retryJob(req.params.id, req.tenantId!, {
        actorId: req.user?.userId,
        actorScope: 'tenant',
      })
      res.status(200).json(retriedJob)
    })
  )

  return router
}
