import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { requireSyncAuth, requireRole, SyncAuthenticatedRequest } from '../middleware/auth';
import { createStoreSettingsService } from '../services/store_settings_service';

export function createStoreSettingsRoutes(pool: Pool): Router {
  const router = Router();
  const storeSettingsService = createStoreSettingsService(pool);

  /**
   * GET /v1/settings/store
   * Fetch resolved store & hardware configuration.
   * Scoped to authenticated tenant and optional active branch.
   * Allowed roles: OWNER, CASHIER
   */
  router.get(
    '/store',
    requireSyncAuth,
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
    requireSyncAuth,
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
