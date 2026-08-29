import { Router, RequestHandler } from 'express'
import { Pool } from 'pg'
import { createJwtService } from '../services/jwt_service'
import { createFinanceService } from '../services/finance_service'
import { asyncHandler } from '../utils/async_handler'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'

export function createFinanceRoutes(pool: Pool): Router {
  const router = Router()

  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const service = createFinanceService(pool)

  const DEFAULT_LIMIT = 50
  const MAX_LIMIT = 200

  function parseLimit(raw: unknown): number {
    if (typeof raw !== 'string') return DEFAULT_LIMIT
    const parsed = parseInt(raw, 10)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      throw new ValidationError(`limit must be an integer between 1 and ${MAX_LIMIT}`)
    }
    return parsed
  }

  function parseOffset(raw: unknown): number {
    if (typeof raw !== 'string') return 0
    const parsed = parseInt(raw, 10)
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new ValidationError('offset must be a non-negative integer')
    }
    return parsed
  }

  function parseBranchId(raw: unknown): string | undefined {
    if (typeof raw !== 'string') return undefined
    if (!isUuid(raw)) {
      throw new ValidationError('branch_id must be a valid UUID')
    }
    return raw
  }

  router.use(requireSyncAuth(jwtService) as RequestHandler)

  router.get(
    '/accounts',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const result = await service.listAccounts(req.tenantId!)
      res.status(200).json(result)
    })
  )

  router.get(
    '/journals',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const journals = await service.listJournals(req.tenantId!, {
        branchId: parseBranchId(req.query.branch_id),
        status: req.query.status as any,
        limit: parseLimit(req.query.limit),
        offset: parseOffset(req.query.offset)
      })
      res.status(200).json(journals)
    })
  )

  router.get(
    '/journals/:id',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('journal_id must be a valid UUID')
      }
      const journal = await service.getJournal(req.params.id, req.tenantId!)
      if (!journal) {
        res.status(404).json({ error: 'Journal not found' })
        return
      }
      res.status(200).json(journal)
    })
  )

  router.get(
    '/cashflow',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const cashflow = await service.getCashflow(req.tenantId!, parseBranchId(req.query.branch_id))
      res.status(200).json(cashflow)
    })
  )

  router.get(
    '/summary',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const summary = await service.getSummary(req.tenantId!)
      res.status(200).json(summary)
    })
  )

  router.post(
    '/postings/sale',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const { sale_id } = req.body as { sale_id: string }
      if (!sale_id || typeof sale_id !== 'string' || !isUuid(sale_id)) {
        throw new ValidationError('sale_id must be a valid UUID')
      }
      const result = await service.postSale(sale_id, req.tenantId!)
      res.status(201).json(result)
    })
  )

  router.post(
    '/postings/payment',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const { payment_id } = req.body as { payment_id: string }
      if (!payment_id || typeof payment_id !== 'string' || !isUuid(payment_id)) {
        throw new ValidationError('payment_id must be a valid UUID')
      }
      const result = await service.postPurchasePayment(payment_id, req.tenantId!)
      res.status(201).json(result)
    })
  )

  router.post(
    '/reversals',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const { journal_id } = req.body as { journal_id: string }
      if (!journal_id || typeof journal_id !== 'string' || !isUuid(journal_id)) {
        throw new ValidationError('journal_id must be a valid UUID')
      }
      const result = await service.createReversal(journal_id, req.tenantId!)
      res.status(201).json(result)
    })
  )

  return router
}