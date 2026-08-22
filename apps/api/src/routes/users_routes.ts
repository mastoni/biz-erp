import { Router, Request, Response, NextFunction } from 'express'
import { Pool } from 'pg'
import { createJwtService } from '../services/jwt_service'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { asyncHandler } from '../utils/async_handler'
import { createUserService } from '../services/user_service'
import { ApiError } from '../errors/api_error'
import { validateCreateUser, validateRevokeUser } from '../dto/user_dto'

export function createUsersRoutes(pool: Pool): Router {
  const router = Router()
  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const userService = createUserService(pool)

  router.use(requireSyncAuth(jwtService) as any)

  router.get(
    '/',
    requireRole('OWNER') as any,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const businessId = req.tenantId!
      const result = await userService.list(businessId)
      res.status(200).json(result)
    })
  )

  router.post(
    '/',
    requireRole('OWNER') as any,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const authReq = req as SyncAuthenticatedRequest
      const businessId = req.tenantId!
      const request = validateCreateUser(req.body)
      const actorUserId = authReq.user!.userId

      const user = await userService.create(businessId, request, actorUserId)
      res.status(201).json(user)
    })
  )

  router.patch(
    '/:id',
    requireRole('OWNER') as any,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const authReq = req as SyncAuthenticatedRequest
      const businessId = req.tenantId!
      const targetUserId = req.params.id
      const actorUserId = authReq.user!.userId

      const request = validateRevokeUser(req.body)
      await userService.revoke(businessId, targetUserId, actorUserId)

      res.status(200).json({ message: 'User access revoked successfully' })
    })
  )

  return router
}
