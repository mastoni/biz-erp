import { Router, RequestHandler } from 'express'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { requireSyncAuth, SyncAuthenticatedRequest, requireRole } from '../middleware/auth'
import { createJwtService } from '../services/jwt_service'
import { createFinanceService } from '../services/finance_service'
import {
  incomeRepository,
  IncomeMethod,
  IncomePatch,
  IncomeStatus,
  IncomeListFilters,
} from '../repositories/income_repository'
import { withTransaction } from '../db/transaction'
import { asyncHandler } from '../utils/async_handler'
import { isUuid } from '../utils/uuid'
import { ValidationError } from '../errors/validation_error'
import { ApiError } from '../errors/api_error'
import { ConflictError } from '../errors/conflict_error'

const VALID_METHODS: ReadonlyArray<IncomeMethod> = ['cash', 'bank_transfer', 'debit', 'credit']
const VALID_STATUSES: ReadonlyArray<IncomeStatus> = ['draft', 'posted', 'reversed']
const ALLOWED_CREATE_FIELDS = new Set<string>([
  'date',
  'amount_minor',
  'method',
  'category',
  'reference',
  'description',
  'branch_id',
  'business_id',
])
const ALLOWED_PATCH_FIELDS = new Set<string>([
  'date',
  'amount_minor',
  'method',
  'category',
  'reference',
  'description',
  'branch_id',
  'expected_server_version',
])
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

function assertTenant(businessId: string, tenantId: string): void {
  if (businessId.toLowerCase() !== tenantId.toLowerCase()) {
    throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Business identity mismatch')
  }
}

function parseLimit(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_LIMIT
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    throw new ValidationError(`limit must be an integer between 1 and ${MAX_LIMIT}`)
  }
  return parsed
}

function parseOffset(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return 0
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ValidationError('offset must be a non-negative integer')
  }
  return parsed
}

function parseBranchId(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw === 'string' && raw.trim() === '') return undefined
  const s = typeof raw === 'string' ? raw.trim() : String(raw)
  if (!isUuid(s)) {
    throw new ValidationError('branch_id must be a valid UUID')
  }
  return s
}

function parseStatus(raw: unknown): IncomeStatus | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw === 'string' && raw.trim() === '') return undefined
  const s = typeof raw === 'string' ? raw.trim() : String(raw)
  if (!VALID_STATUSES.includes(s as IncomeStatus)) {
    throw new ValidationError('status must be one of: draft, posted, reversed')
  }
  return s as IncomeStatus
}

function validateDate(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new ValidationError('date is required')
  }
  const d = raw.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new ValidationError('date must be in YYYY-MM-DD format')
  }
  const parsed = new Date(d + 'T00:00:00Z')
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError('date is not a valid calendar date')
  }
  return d
}

function validateAmount(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw <= 0) {
    throw new ValidationError('amount_minor must be a positive integer')
  }
  return raw
}

function validateMethod(raw: unknown): IncomeMethod {
  if (typeof raw !== 'string' || !VALID_METHODS.includes(raw as IncomeMethod)) {
    throw new ValidationError(`method must be one of: ${VALID_METHODS.join(', ')}`)
  }
  return raw as IncomeMethod
}

function validateDescription(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new ValidationError('description is required')
  }
  const d = raw.trim()
  if (d.length > 500) {
    throw new ValidationError('description is too long (max 500 characters)')
  }
  return d
}

function validateOptionalText(raw: unknown, name: string): string | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'string') {
    throw new ValidationError(`${name} must be a string`)
  }
  const t = raw.trim()
  if (t === '') return null
  if (t.length > 255) {
    throw new ValidationError(`${name} is too long (max 255 characters)`)
  }
  return t
}

function validateIncomeCreate(body: unknown, tenantId: string) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('Request body must be an object')
  }
  const b = body as Record<string, unknown>
  for (const key of Object.keys(b)) {
    if (!ALLOWED_CREATE_FIELDS.has(key)) {
      throw new ValidationError(`Unexpected field: ${key}`)
    }
  }

  const business_id =
    typeof b.business_id === 'string' && b.business_id.trim() !== ''
      ? b.business_id.trim()
      : tenantId
  assertTenant(business_id, tenantId)

  return {
    business_id,
    date: validateDate(b.date),
    amount_minor: validateAmount(b.amount_minor),
    method: validateMethod(b.method),
    category: validateOptionalText(b.category, 'category'),
    reference: validateOptionalText(b.reference, 'reference'),
    description: validateDescription(b.description),
    branch_id: parseBranchId(b.branch_id) ?? null,
  }
}

function validateIncomePatch(body: unknown) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('Request body must be an object')
  }
  const b = body as Record<string, unknown>
  for (const key of Object.keys(b)) {
    if (!ALLOWED_PATCH_FIELDS.has(key)) {
      throw new ValidationError(`Unexpected field: ${key}`)
    }
  }

  const expectedServerVersion = b.expected_server_version
  if (
    typeof expectedServerVersion !== 'number' ||
    !Number.isInteger(expectedServerVersion) ||
    expectedServerVersion < 1
  ) {
    throw new ValidationError('expected_server_version is required and must be a positive integer')
  }

  const patch: IncomePatch = {}
  if (b.date !== undefined) patch.date = validateDate(b.date)
  if (b.amount_minor !== undefined) patch.amount_minor = validateAmount(b.amount_minor)
  if (b.method !== undefined) patch.method = validateMethod(b.method)
  if (b.category !== undefined) patch.category = validateOptionalText(b.category, 'category')
  if (b.reference !== undefined) patch.reference = validateOptionalText(b.reference, 'reference')
  if (b.description !== undefined) patch.description = validateDescription(b.description)
  if (b.branch_id !== undefined) {
    patch.branch_id = b.branch_id === null ? null : (parseBranchId(b.branch_id) ?? null)
  }

  if (Object.keys(patch).length === 0) {
    throw new ValidationError('No updatable fields provided')
  }

  return { expectedServerVersion, patch }
}

function buildListFilters(query: Record<string, unknown>): IncomeListFilters {
  return {
    branchId: parseBranchId(query.branch_id) ?? undefined,
    status: parseStatus(query.status),
    category:
      typeof query.category === 'string' && query.category.trim() !== ''
        ? query.category.trim()
        : undefined,
    date_from:
      typeof query.date_from === 'string' && query.date_from.trim() !== ''
        ? query.date_from.trim()
        : undefined,
    date_to:
      typeof query.date_to === 'string' && query.date_to.trim() !== ''
        ? query.date_to.trim()
        : undefined,
    search:
      typeof query.search === 'string' && query.search.trim() !== ''
        ? query.search.trim()
        : undefined,
    limit: parseLimit(query.limit),
    offset: parseOffset(query.offset),
  }
}

export function createIncomeRoutes(pool: Pool): Router {
  const router = Router()
  const jwtSecret = process.env.JWT_SECRET
  const jwtIssuer = process.env.JWT_ISSUER
  const jwtAudience = process.env.JWT_AUDIENCE

  if (!jwtSecret || !jwtIssuer || !jwtAudience) {
    throw new Error('JWT_SECRET, JWT_ISSUER, and JWT_AUDIENCE must be set in the environment')
  }

  const jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)
  const financeService = createFinanceService(pool)

  router.use(requireSyncAuth(jwtService) as RequestHandler)

  router.get(
    '/',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const filters = buildListFilters(req.query as Record<string, unknown>)
      const result = await withTransaction(pool, async (client) =>
        incomeRepository.list(client, req.tenantId!, filters)
      )
      res.status(200).json(result)
    })
  )

  router.get(
    '/:id',
    requireRole('OWNER', 'CASHIER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('id must be a valid UUID')
      }
      const income = await withTransaction(pool, async (client) =>
        incomeRepository.findById(client, req.tenantId!, req.params.id)
      )
      if (!income) {
        throw new ApiError(404, 'NOT_FOUND', 'Income not found')
      }
      res.status(200).json(income)
    })
  )

  router.post(
    '/',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      const data = validateIncomeCreate(req.body, req.tenantId!)
      const created = await withTransaction(pool, async (client) =>
        incomeRepository.create(client, {
          id: randomUUID(),
          business_id: data.business_id,
          branch_id: data.branch_id,
          date: data.date,
          amount_minor: data.amount_minor,
          method: data.method,
          category: data.category,
          reference: data.reference,
          description: data.description,
        })
      )
      res.status(201).json(created)
    })
  )

  router.patch(
    '/:id',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('id must be a valid UUID')
      }
      const { expectedServerVersion, patch } = validateIncomePatch(req.body)
      const updated = await withTransaction(pool, async (client) => {
        const income = await incomeRepository.findById(client, req.tenantId!, req.params.id)
        if (!income) {
          throw new ApiError(404, 'NOT_FOUND', 'Income not found')
        }
        if (income.status !== 'draft') {
          throw new ValidationError('Only draft incomes can be modified')
        }
        if (income.server_version !== expectedServerVersion) {
          throw new ConflictError(
            'VERSION_CONFLICT',
            'Income was modified by another request',
            { current_server_version: income.server_version }
          )
        }
        const result = await incomeRepository.updateDraft(
          client,
          req.tenantId!,
          req.params.id,
          expectedServerVersion,
          patch
        )
        if (!result) {
          throw new ConflictError('VERSION_CONFLICT', 'Concurrent modification detected')
        }
        return result
      })
      res.status(200).json(updated)
    })
  )

  router.delete(
    '/:id',
    requireRole('OWNER') as RequestHandler,
    asyncHandler<SyncAuthenticatedRequest>(async (req, res) => {
      if (!isUuid(req.params.id)) {
        throw new ValidationError('id must be a valid UUID')
      }
      await withTransaction(pool, async (client) => {
        const income = await incomeRepository.findById(client, req.tenantId!, req.params.id)
        if (!income) {
          throw new ApiError(404, 'NOT_FOUND', 'Income not found')
        }
        if (income.status !== 'draft') {
          throw new ValidationError('Only draft incomes can be deleted')
        }
        const deleted = await incomeRepository.softDeleteDraft(client, req.tenantId!, req.params.id)
        if (!deleted) {
          throw new ApiError(404, 'NOT_FOUND', 'Income not found')
        }
      })
      res.status(204).send()
    })
  )

  return router
}
