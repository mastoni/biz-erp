import { Router } from 'express'
import { Pool } from 'pg'
import { createJwtService } from '../services/jwt_service'
import {
  createPlatformJwtAuthMiddleware,
  PlatformAuthenticatedRequest,
  requirePlatformRole
} from '../middleware/auth'
import { createPlatformService } from '../services/platform_service'
import { asyncHandler } from '../utils/async_handler'

export function createPlatformRoutes(pool: Pool): Router {
  const router = Router()

  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const platformAuth = createPlatformJwtAuthMiddleware(jwtService)
  const platformService = createPlatformService(pool)

  // Every platform route is gated by the platform auth middleware. Tenant tokens
  // and legacy (no-scope) tokens are rejected with 403 WRONG_SCOPE before any
  // handler runs. The middleware never sets req.businessId on platform routes.
  router.use(platformAuth as any)

  // -------------------------------------------------------------------------
  // GET /v1/platform/context
  // Safe, non-sensitive authenticated platform context. Does NOT expose any
  // tenant/business scope (platform tokens carry none).
  // -------------------------------------------------------------------------
  router.get(
    '/context',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const user = req.platformUser!
      // businessId is explicitly null: platform tokens carry no tenant/business
      // scope. It is a static literal, never derived from req.businessId.
      res.status(200).json({ ...platformService.getContext(user.role, user.userId), businessId: null })
    })
  )

  // -------------------------------------------------------------------------
  // GET /v1/platform/businesses
  // Canonical: businesses. Platform-wide (no tenant filter). Paginated.
  // -------------------------------------------------------------------------
  router.get(
    '/businesses',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.listBusinesses(req.query as Record<string, unknown>)
      res.status(200).json(result)
    })
  )

  // -------------------------------------------------------------------------
  // GET /v1/platform/modules
  // Canonical: modules (40B). Platform-wide. Paginated.
  // -------------------------------------------------------------------------
  router.get(
    '/modules',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.listModules(req.query as Record<string, unknown>)
      res.status(200).json(result)
    })
  )

  // -------------------------------------------------------------------------
  // GET /v1/platform/plans
  // Canonical: plans (40B). Platform-wide. Paginated.
  // -------------------------------------------------------------------------
  router.get(
    '/plans',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.listPlans(req.query as Record<string, unknown>)
      res.status(200).json(result)
    })
  )

  // -------------------------------------------------------------------------
  // GET /v1/platform/bundles
  // Canonical: bundles (40B). Platform-wide. Paginated.
  // -------------------------------------------------------------------------
  router.get(
    '/bundles',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.listBundles(req.query as Record<string, unknown>)
      res.status(200).json(result)
    })
  )

  // -------------------------------------------------------------------------
  // GET /v1/platform/subscriptions
  // Canonical: subscriptions (40C). Platform-wide (all businesses). Paginated.
  // Read-only overview; no entitlement logic.
  // -------------------------------------------------------------------------
  router.get(
    '/subscriptions',
    requirePlatformRole() as any,
    asyncHandler<PlatformAuthenticatedRequest>(async (req, res) => {
      const result = await platformService.listSubscriptions(req.query as Record<string, unknown>)
      res.status(200).json(result)
    })
  )

  return router
}
