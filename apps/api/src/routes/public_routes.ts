import { Router } from 'express'
import { Pool } from 'pg'
import { createPlatformService } from '../services/platform_service'
import { asyncHandler } from '../utils/async_handler'

export function createPublicRoutes(pool: Pool): Router {
  const router = Router()
  const platformService = createPlatformService(pool)

  // -------------------------------------------------------------------------
  // GET /v1/public/showcase
  // Publicly accessible showcase items for Landing Page and prospective users.
  // Unauthenticated, rate-limited, strictly returns only published items with
  // active underlying targets.
  // -------------------------------------------------------------------------
  router.get(
    '/showcase',
    asyncHandler(async (req, res) => {
      const section = typeof req.query.section === 'string' ? req.query.section : undefined
      const result = await platformService.getPublicShowcase(section)
      res.status(200).json(result)
    })
  )

  return router
}
