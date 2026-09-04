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

  // -------------------------------------------------------------------------
  // GET /v1/public/commercial/resolve?plan=... OR ?bundle=...
  // Public commercial info resolution for registration flow.
  // -------------------------------------------------------------------------
  router.get(
    '/commercial/resolve',
    asyncHandler(async (req, res) => {
      const planCode = typeof req.query.plan === 'string' ? req.query.plan.trim().toUpperCase() : undefined
      const bundleCode = typeof req.query.bundle === 'string' ? req.query.bundle.trim().toUpperCase() : undefined

      if (planCode) {
        const planRes = await pool.query(
          `SELECT p.code, p.name, p.family, p.tier, p.billing_cycle, p.pricing, p.type, p.trial_days,
                  s.marketing_badge, s.headline, s.description, s.features_list
           FROM plans p
           LEFT JOIN showcase_items s ON s.plan_code = p.code AND s.is_published = TRUE
           WHERE p.code = $1 AND p.status = 'ACTIVE'
           LIMIT 1`,
          [planCode]
        )
        if (planRes.rows.length > 0) {
          const row = planRes.rows[0]
          return res.status(200).json({
            type: 'PLAN',
            code: row.code,
            name: row.name,
            family: row.family,
            billing_cycle: row.billing_cycle,
            pricing: row.pricing,
            trial_days: row.trial_days,
            marketing_badge: row.marketing_badge || null,
            headline: row.headline || null,
            description: row.description || null,
            features_list: row.features_list || []
          })
        }
      }

      if (bundleCode) {
        const bundleRes = await pool.query(
          `SELECT b.code, b.name, b.pricing, b.presentation_metadata,
                  s.marketing_badge, s.headline, s.description, s.features_list
           FROM bundles b
           LEFT JOIN showcase_items s ON s.bundle_code = b.code AND s.is_published = TRUE
           WHERE b.code = $1 AND b.status = 'ACTIVE'
           LIMIT 1`,
          [bundleCode]
        )
        if (bundleRes.rows.length > 0) {
          const row = bundleRes.rows[0]
          return res.status(200).json({
            type: 'BUNDLE',
            code: row.code,
            name: row.name,
            pricing: row.pricing,
            presentation_metadata: row.presentation_metadata,
            marketing_badge: row.marketing_badge || null,
            headline: row.headline || null,
            description: row.description || null,
            features_list: row.features_list || []
          })
        }
      }

      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Plan or bundle not found or inactive'
        }
      })
    })
  )

  return router
}
