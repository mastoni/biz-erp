import { Router, RequestHandler } from 'express'
import { Pool } from 'pg'
import { createJwtService } from '../services/jwt_service'
import { createFinanceService } from '../services/finance_service'
import { asyncHandler } from '../utils/async_handler'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'

export function createReceivableRoutes(pool: Pool): Router {
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

  function parseCustomerId(raw: unknown): string | undefined {
    if (typeof raw !== 'string') return undefined
    if (!isUuid(raw)) {
      throw new ValidationError('customer_id must be a valid UUID')
    }
    return raw
  }

  function parseStatus(raw: unknown): 'OPEN' | 'PARTIAL' | 'PAID' | 'REVERSED' | undefined {
    if (typeof raw !== 'string') return undefined
    if (!['OPEN', 'PARTIAL', 'PAID', 'REVERSED'].includes(raw)) {
      throw new ValidationError('status must be one of: OPEN, PARTIAL, PAID, REVERSED')
    }
    return raw as 'OPEN' | 'PARTIAL' | 'PAID' | 'REVERSED'
  }

  function parseDate(raw: unknown): string | undefined {
    if (typeof raw !== 'string') return undefined
    if (!isUuid(raw) && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      throw new ValidationError('date must be in YYYY-MM-DD format')
    }
    return raw
  }

  router.use(requireSyncAuth(jwtService) as RequestHandler)

  router.get(
    '/',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const result = await service.listReceivables(req.tenantId!, {
        branchId: parseBranchId(req.query.branch_id),
        customerId: parseCustomerId(req.query.customer_id),
        status: parseStatus(req.query.status),
        dateFrom: parseDate(req.query.date_from),
        dateTo: parseDate(req.query.date_to),
        limit: parseLimit(req.query.limit),
        offset: parseOffset(req.query.offset)
      })
      res.status(200).json(result)
    })
  )

  router.get(
    '/:id',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('receivable_id must be a valid UUID')
      }
      const receivable = await service.getReceivable(req.params.id, req.tenantId!)
      if (!receivable) {
        res.status(404).json({ error: 'Receivable not found' })
        return
      }
      res.status(200).json(receivable)
    })
  )

  router.get(
    '/:id/payments',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('receivable_id must be a valid UUID')
      }
      const payments = await service.listCustomerPayments(
        req.params.id,
        req.tenantId!,
        parseLimit(req.query.limit),
        parseOffset(req.query.offset)
      )
      res.status(200).json(payments)
    })
  )

  router.get(
    '/sale/:saleId',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.saleId)) {
        throw new ValidationError('sale_id must be a valid UUID')
      }
      const receivable = await service.getReceivableBySale(req.params.saleId, req.tenantId!)
      if (!receivable) {
        res.status(404).json({ error: 'Receivable not found for this sale' })
        return
      }
      res.status(200).json(receivable)
    })
  )

  router.post(
    '/postings/receivable',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const { receivable_id } = req.body as { receivable_id: string }
      if (!receivable_id || typeof receivable_id !== 'string' || !isUuid(receivable_id)) {
        throw new ValidationError('receivable_id must be a valid UUID')
      }
      const result = await service.postReceivable(receivable_id, req.tenantId!)
      res.status(201).json(result)
    })
  )

  router.post(
    '/:id/collections',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('receivable_id must be a valid UUID')
      }
      const { amount_minor, method, customer_id, reference, date } = req.body as {
        amount_minor: number
        method: 'cash' | 'bank_transfer' | 'debit' | 'credit'
        customer_id?: string | null
        reference?: string | null
        date?: string
      }
      if (!amount_minor || typeof amount_minor !== 'number' || amount_minor <= 0) {
        throw new ValidationError('amount_minor must be a positive number')
      }
      if (!method || typeof method !== 'string') {
        throw new ValidationError('method is required')
      }
      if (customer_id !== undefined && customer_id !== null && (!isUuid(customer_id) || typeof customer_id !== 'string')) {
        throw new ValidationError('customer_id must be a valid UUID or null')
      }
      const result = await service.collectCustomerPayment(
        req.params.id,
        req.tenantId!,
        amount_minor,
        method,
        customer_id ?? null,
        reference ?? null,
        date
      )
      res.status(201).json(result)
    })
  )

  router.post(
    '/:id/reversals',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('receivable_id must be a valid UUID')
      }
      const { type, sale_id, payment_id } = req.body as { type: string; sale_id?: string; payment_id?: string }
      if (type === 'credit_sale') {
        if (!sale_id || typeof sale_id !== 'string' || !isUuid(sale_id)) {
          throw new ValidationError('sale_id must be a valid UUID when type = credit_sale')
        }
        const result = await service.reverseCreditSale(sale_id, req.tenantId!)
        res.status(201).json(result)
        return
      }
      if (type === 'customer_payment') {
        if (!payment_id || typeof payment_id !== 'string' || !isUuid(payment_id)) {
          throw new ValidationError('payment_id must be a valid UUID when type = customer_payment')
        }
        const result = await service.reverseCustomerPayment(payment_id, req.tenantId!)
        res.status(201).json(result)
        return
      }
      throw new ValidationError('type must be "credit_sale" or "customer_payment"')
    })
  )

  router.post(

    '/payments/:paymentId/reversals',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.paymentId)) {
        throw new ValidationError('payment_id must be a valid UUID')
      }
      const result = await service.reverseCustomerPayment(req.params.paymentId, req.tenantId!)
      res.status(201).json(result)
    })
  )

  return router
}
