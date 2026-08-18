import { RequestHandler, Router } from 'express'
import { Pool } from 'pg'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { createJwtService } from '../services/jwt_service'
import { asyncHandler } from '../utils/async_handler'
import { validateBranchCreate } from '../dto/branch_dto'
import { branchRepository } from '../repositories/branch_repository'
import { ApiError } from '../errors/api_error'

export function createBranchRoutes(pool: Pool): Router {
  const router = Router()
  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)

  router.use(requireSyncAuth(jwtService) as RequestHandler)

  router.get(
    '/',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const client = await pool.connect()
      try {
        const branches = await branchRepository.findAll(client, req.tenantId!)
        res.status(200).json({ items: branches })
      } finally {
        client.release()
      }
    })
  )

  router.post(
    '/',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const data = validateBranchCreate(req.body)
      
      if (data.business_id !== req.tenantId) {
         throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Business identity mismatch')
      }

      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        // Check uniqueness
        const exist = await client.query('SELECT id FROM branches WHERE business_id = $1 AND name = $2', [data.business_id, data.name])
        if (exist.rowCount && exist.rowCount > 0) {
            throw new ApiError(409, 'CONFLICT', 'Branch name already exists in this business')
        }
        const created = await branchRepository.create(client, data)
        await client.query('COMMIT')
        res.status(201).json(created)
      } catch(err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    })
  )

  return router
}
