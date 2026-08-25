import { RequestHandler, Router } from 'express'
import { Pool } from 'pg'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { createJwtService } from '../services/jwt_service'
import { BranchService } from '../services/branch_service'
import { asyncHandler } from '../utils/async_handler'
import { validateBranchCreate } from '../dto/branch_dto'

export function createBranchRoutes(pool: Pool): Router {
  const router = Router()
  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const branchService = new BranchService(pool)

  router.use(requireSyncAuth(jwtService) as RequestHandler)

  router.get(
    '/',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const branches = await branchService.listBranches(req.tenantId!)
      res.status(200).json({ items: branches })
    })
  )

  router.post(
    '/',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const data = validateBranchCreate(req.body)
      const created = await branchService.createBranch(req.tenantId!, data)
      res.status(201).json(created)
    })
  )

  return router
}
