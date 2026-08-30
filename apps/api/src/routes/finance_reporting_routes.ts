import { Router, RequestHandler } from 'express'
import { Pool } from 'pg'
import { createJwtService } from '../services/jwt_service'
import { createFinanceReportingService } from '../services/finance_reporting_service'
import { asyncHandler } from '../utils/async_handler'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'

function parseDate(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    throw new ValidationError('date must be in YYYY-MM-DD format')
  }
  return raw.trim()
}

function parseBranchId(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null
  if (!isUuid(raw)) {
    throw new ValidationError('branch_id must be a valid UUID')
  }
  return raw
}

export function createFinanceReportingRoutes(pool: Pool): Router {
  const router = Router()

  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const service = createFinanceReportingService(pool)

  router.use(requireSyncAuth(jwtService) as RequestHandler)

  router.get(
    '/profit-loss',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const result = await service.getProfitLoss(
        req.tenantId!,
        parseBranchId(req.query.branch_id),
        parseDate(req.query.from),
        parseDate(req.query.to)
      )
      res.status(200).json(result)
    })
  )

  router.get(
    '/balance-sheet',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const asOf = parseDate(req.query.as_of ?? req.query.to)
      if (!asOf) {
        throw new ValidationError('as_of (or to) date parameter is required')
      }
      const result = await service.getBalanceSheet(
        req.tenantId!,
        asOf,
        parseBranchId(req.query.branch_id)
      )
      res.status(200).json(result)
    })
  )

  router.get(
    '/cashflow',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const result = await service.getCashflowReport(
        req.tenantId!,
        parseBranchId(req.query.branch_id),
        parseDate(req.query.from),
        parseDate(req.query.to)
      )
      res.status(200).json(result)
    })
  )

  router.get(
    '/general-ledger',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const fromDate = parseDate(req.query.from)
      const toDate = parseDate(req.query.to)
      if (!fromDate || !toDate) {
        throw new ValidationError('from and to date parameters are required')
      }
      let accountId: string | null = null
      if (req.query.account_id) {
        if (!isUuid(String(req.query.account_id))) {
          throw new ValidationError('account_id must be a valid UUID')
        }
        accountId = String(req.query.account_id)
      }
      const result = await service.getGeneralLedger(
        req.tenantId!,
        fromDate,
        toDate,
        parseBranchId(req.query.branch_id),
        accountId
      )
      res.status(200).json(result)
    })
  )

  router.get(
    '/account-balances',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const result = await service.getAccountBalancesReport(
        req.tenantId!,
        parseBranchId(req.query.branch_id),
        parseDate(req.query.from),
        parseDate(req.query.to)
      )
      res.status(200).json(result)
    })
  )

  return router
}
