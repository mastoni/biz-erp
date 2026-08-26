import { Router } from 'express'
import { Pool } from 'pg'
import { createJwtService } from '../services/jwt_service'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { asyncHandler } from '../utils/async_handler'
import { createReportService } from '../services/report_service'
import { isUuid } from '../utils/uuid'
import { ApiError } from '../errors/api_error'
import { ReportDateRange } from '../dto/report_dto'

export function createReportsRoutes(pool: Pool): Router {
  const router = Router()
  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const reportService = createReportService(pool)

  router.use(requireSyncAuth(jwtService) as any)

  router.get(
    '/sales-summary',
    requireRole('OWNER', 'CASHIER') as any,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const businessId = req.tenantId!
      const dateRange = parseDateRange(req.query)

      const report = await reportService.getSalesSummary(businessId, dateRange)
      res.status(200).json({ sales_summary: report })
    })
  )

  router.get(
    '/product-sales',
    requireRole('OWNER', 'CASHIER') as any,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const businessId = req.tenantId!
      const dateRange = parseDateRange(req.query)

      const report = await reportService.getProductSales(businessId, dateRange)
      res.status(200).json({ product_sales: report })
    })
  )

  router.get(
    '/customer-sales',
    requireRole('OWNER', 'CASHIER') as any,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const businessId = req.tenantId!
      const dateRange = parseDateRange(req.query)

      const report = await reportService.getCustomerSales(businessId, dateRange)
      res.status(200).json({ customer_sales: report })
    })
  )

  router.get(
    '/sales-hourly',
    requireRole('OWNER', 'CASHIER') as any,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const businessId = req.tenantId!
      const dateRange = parseDateRange(req.query)

      const report = await reportService.getHourlySales(businessId, dateRange)
      res.status(200).json(report)
    })
  )

  router.get(
    '/recent-sales',
    requireRole('OWNER', 'CASHIER') as any,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const businessId = req.tenantId!
      let branch_id: string | undefined
      if (req.query.branch_id !== undefined) {
        if (typeof req.query.branch_id !== 'string' || !isUuid(req.query.branch_id)) {
          throw new ApiError(400, 'BAD_REQUEST', 'branch_id must be a valid UUID')
        }
        branch_id = req.query.branch_id
      }

      let limit: number | undefined
      if (req.query.limit !== undefined) {
        const parsedLimit = Number(req.query.limit)
        if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
          throw new ApiError(400, 'BAD_REQUEST', 'limit must be a positive integer')
        }
        limit = Math.min(parsedLimit, 50)
      }

      const report = await reportService.getRecentSales(businessId, { branch_id, limit })
      res.status(200).json(report)
    })
  )

  router.get(
    '/sales-daily',
    requireRole('OWNER', 'CASHIER') as any,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const businessId = req.tenantId!
      const dateRange = parseDateRange(req.query)

      const report = await reportService.getDailySales(businessId, dateRange)
      res.status(200).json(report)
    })
  )

  return router
}

function parseDateRange(query: any): ReportDateRange {
  let from = typeof query.from === 'string' ? query.from : new Date().toISOString().split('T')[0]
  let to = typeof query.to === 'string' ? query.to : new Date().toISOString().split('T')[0]

  if (!from || !to) {
    throw new ApiError(400, 'BAD_REQUEST', 'from and to query parameters are required (YYYY-MM-DD)')
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    from = `${from}T00:00:00.000Z`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    to = `${to}T23:59:59.999Z`
  }

  let branch_id: string | undefined
  if (query.branch_id !== undefined) {
    if (typeof query.branch_id !== 'string' || !isUuid(query.branch_id)) {
      throw new ApiError(400, 'BAD_REQUEST', 'branch_id must be a valid UUID')
    }
    branch_id = query.branch_id
  }

  return { from, to, branch_id }
}
