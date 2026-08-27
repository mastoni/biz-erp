import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { Pool } from 'pg';
import { requireSyncAuth, requireRole, SyncAuthenticatedRequest } from '../middleware/auth';
import { createJwtService } from '../services/jwt_service';
import { createStoreSettingsService } from '../services/store_settings_service';

export function createStoreSettingsRoutes(pool: Pool): Router {
  const router = Router();

  const jwtSecret = process.env.JWT_SECRET;
  const jwtIssuer = process.env.JWT_ISSUER;
  const jwtAudience = process.env.JWT_AUDIENCE;

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment');
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience);
  const storeSettingsService = createStoreSettingsService(pool);

  /**
   * GET /v1/settings/store
   * Fetch resolved store & hardware configuration.
   * Scoped to authenticated tenant and optional active branch.
   * Allowed roles: OWNER, CASHIER
   */
  router.get(
    '/store',
    requireSyncAuth(jwtService) as RequestHandler,
    requireRole('OWNER', 'CASHIER'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = (req as any).tenantId;
        const branchId = typeof req.query.branch_id === 'string' ? req.query.branch_id : null;

        const settings = await storeSettingsService.getResolvedSettings(tenantId, branchId, tenantId);
        res.status(200).json(settings);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * PUT /v1/settings/store
   * Update store & hardware configuration.
   * Scoped to authenticated tenant and optional active branch.
   * Allowed roles: OWNER only (CASHIER is forbidden)
   */
  router.put(
    '/store',
    requireSyncAuth(jwtService) as RequestHandler,
    requireRole('OWNER'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = (req as any).tenantId;
        const branchId = typeof req.query.branch_id === 'string' ? req.query.branch_id : null;

        const updated = await storeSettingsService.updateSettings(tenantId, branchId, req.body, tenantId);
        res.status(200).json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
