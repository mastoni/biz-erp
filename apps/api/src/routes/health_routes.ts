import { Router } from 'express'
import { Pool } from 'pg'
import { asyncHandler } from '../utils/async_handler'

export function createHealthRouter(pool: Pool): Router {
  const router = Router()

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      try {
        await pool.query('SELECT 1')

        res.status(200).json({
          status: 'ok',
          database: 'ok',
          timestamp: new Date().toISOString()
        })
      } catch {
        res.status(503).json({
          status: 'error',
          database: 'unavailable',
          timestamp: new Date().toISOString()
        })
      }
    })
  )

  return router
}
