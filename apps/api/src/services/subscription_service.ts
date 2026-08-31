import { Pool, PoolClient } from 'pg'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'
import { ConflictError } from '../errors/conflict_error'
import {
  SubscriptionDto,
  SubscriptionCreateRequest,
  SubscriptionUpdateRequest,
  validateSubscriptionCreate,
  validateSubscriptionUpdate,
} from '../dto/subscription_dto'
import { withTransaction } from '../db/transaction'
import { isUuid } from '../utils/uuid'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function assertTenant(businessId: string, tenantId: string): void {
  if (tenantId.toLowerCase() !== businessId.toLowerCase()) {
    throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Business identity mismatch')
  }
}

function mapRowToDto(row: Record<string, unknown>): SubscriptionDto {
  return {
    id: row.id as string,
    account_customer_id: (row.account_customer_id as string) ?? null,
    business_id: row.business_id as string,
    plan_code: row.plan_code as string,
    family_code: row.family_code as string,
    source: row.source as SubscriptionDto['source'],
    status: row.status as SubscriptionDto['status'],
    starts_at: row.starts_at as string,
    ends_at: (row.ends_at as string) ?? null,
    trial_ends_at: (row.trial_ends_at as string) ?? null,
    billing_account_id: (row.billing_account_id as string) ?? null,
    internet_service_id: (row.internet_service_id as string) ?? null,
    unit_price: Number(row.unit_price),
    discount: Number(row.discount),
    tax: Number(row.tax),
    final_price: Number(row.final_price),
    currency: row.currency as string,
    billing_cycle: row.billing_cycle as 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

export function createSubscriptionService(pool: Pool) {
  return {
    /**
     * List subscriptions for the authenticated tenant.
     */
    async list(
      query: Record<string, unknown>,
      tenantId: string
    ): Promise<{
      items: SubscriptionDto[]
      total: number
      limit: number
      offset: number
      has_more: boolean
    }> {
      const businessId = typeof query.business_id === 'string' ? query.business_id.trim() : undefined

      if (!businessId || !isUuid(businessId)) {
        throw new ValidationError('business_id must be a valid UUID')
      }

      assertTenant(businessId, tenantId)

      const limit = Math.min(parseInt(String(query.limit ?? '50')), 500)
      const offset = Math.max(parseInt(String(query.offset ?? '0')), 0)

      const status = query.status
      const familyCode = query.family_code
      const source = query.source
      const planCode = query.plan_code

      return withTransaction(pool, async (client) => {
        let queryStr = `
          SELECT s.*, p.family as plan_family
          FROM subscriptions s
          JOIN plans p ON s.plan_code = p.code
          WHERE s.business_id = $1
        `
        const params: unknown[] = [tenantId]
        let paramIndex = 2

        if (query.status) {
          queryStr += ` AND s.status = $${paramIndex++}`
          params.push(query.status)
        }
        if (query.family_code) {
          queryStr += ` AND s.family_code = $${paramIndex++}`
          params.push(query.family_code)
        }
        if (query.source) {
          queryStr += ` AND s.source = $${paramIndex++}`
          params.push(query.source)
        }
        if (query.plan_code) {
          queryStr += ` AND s.plan_code = $${paramIndex++}`
          params.push(query.plan_code)
        }

        // Get total count
        const countQuery = `
          SELECT COUNT(*) FROM subscriptions s
          JOIN plans p ON s.plan_code = p.code
          WHERE s.business_id = $1
          ${query.status ? 'AND s.status = $2' : ''}
          ${query.family_code ? `AND s.family_code = $${params.length + 1}` : ''}
          ${query.source ? `AND s.source = $${params.length + 1}` : ''}
          ${query.plan_code ? `AND s.plan_code = $${params.length + 1}` : ''}
        `
        // Build count params
        const countParams = [tenantId]
        if (query.status) countParams.push(query.status as string)
        if (query.family_code) countParams.push(query.family_code as string)
        if (query.source) countParams.push(query.source as string)
        if (query.plan_code) countParams.push(query.plan_code as string)

        const countResult = await client.query(countQuery, countParams)
        const total = parseInt(countResult.rows[0].count, 10)

        // Get paginated results
        queryStr += ` ORDER BY s.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
        params.push(limit, offset)

        const result = await client.query(queryStr, params)
        const items = result.rows.map(mapRowToDto)

        return {
          items,
          total,
          limit: limit,
          offset: offset,
          has_more: offset + items.length < total,
        }
      })
    },

    /**
     * Get a single subscription by ID.
     */
    async findById(id: string, tenantId: string): Promise<SubscriptionDto> {
      if (!isUuid(id)) {
        throw new ValidationError('Subscription id must be a valid UUID')
      }

      return withTransaction(pool, async (client) => {
        const result = await client.query(
          `SELECT s.*, p.family as plan_family
           FROM subscriptions s
           JOIN plans p ON s.plan_code = p.code
           WHERE s.id = $1 AND s.business_id = $2`,
          [id, tenantId]
        )

        if (result.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Subscription not found')
        }

        return mapRowToDto(result.rows[0])
      })
    },

    /**
     * Create a new subscription.
     * Validates plan, family, source, and creates price snapshot.
     */
    async create(
      data: Record<string, unknown>,
      tenantId: string
    ): Promise<SubscriptionDto> {
      const request = validateSubscriptionCreate(data)
      assertTenant(request.business_id, tenantId)

      return withTransaction(pool, async (client) => {
        // Verify plan exists and get its family
        const planResult = await client.query(
          'SELECT code, family, billing_cycle, pricing FROM plans WHERE code = $1 AND status = \'ACTIVE\'',
          [data.plan_code]
        )

        if (planResult.rows.length === 0) {
          throw new ValidationError('Plan not found or inactive')
        }

        const plan = planResult.rows[0]

        // Verify plan family matches
        if (plan.family !== data.family_code) {
          throw new ValidationError(`Plan ${data.plan_code} belongs to family ${plan.family} but subscription has family_code ${data.family_code}`)
        }

        // Get subscription family replacement policy
        const familyResult = await client.query(
          'SELECT replacement_policy FROM subscription_families WHERE code = $1',
          [data.family_code]
        )

        if (familyResult.rows.length === 0) {
          throw new ValidationError('Subscription family not found')
        }

        // Create price snapshot from plan
        const planPricing = data.pricing ?? {}
        const unitPrice = data.unit_price
        const finalPrice = data.final_price
        const discount = data.discount ?? 0
        const tax = data.tax ?? 0
        const currency = data.currency
        const billingCycle = data.billing_cycle

        // Insert subscription
        const result = await client.query(
          `INSERT INTO subscriptions (
            account_customer_id, business_id, plan_code, family_code, source, status,
            starts_at, ends_at, trial_ends_at, billing_account_id, internet_service_id,
            unit_price, discount, tax, final_price, currency, billing_cycle, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          RETURNING *`,
          [
            null, // account_customer_id - will be set in 40F
            data.business_id,
            data.plan_code,
            data.family_code,
            data.source,
            'PENDING', // initial status
            new Date(), // starts_at
            null, // ends_at
            null, // trial_ends_at
            data.billing_account_id ?? null,
            data.internet_service_id ?? null,
            data.unit_price,
            data.discount ?? 0,
            data.tax ?? 0,
            data.final_price,
            data.currency,
            data.billing_cycle,
            data.metadata ?? {},
          ]
        )

        return mapRowToDto(result.rows[0])
      })
    },

    /**
     * Update subscription (status, metadata).
     * Price snapshot is immutable - enforced by DB trigger.
     */
    async update(
      id: string,
      data: Record<string, unknown>,
      tenantId: string
    ): Promise<SubscriptionDto> {
      const immutablePriceFields = ['unit_price', 'discount', 'tax', 'final_price', 'currency', 'billing_cycle']
      const attemptedPriceFields = immutablePriceFields.filter((f) => data[f] !== undefined)
      if (attemptedPriceFields.length > 0) {
        throw new ConflictError(
          'CONFLICT_ERROR',
          'Price snapshot is immutable after subscription creation',
          { fields: attemptedPriceFields }
        )
      }

      const request = validateSubscriptionUpdate(data)

      return withTransaction(pool, async (client) => {
        // First check if subscription exists and belongs to tenant
        const existing = await client.query(
          'SELECT * FROM subscriptions WHERE id = $1 AND business_id = $2',
          [id, tenantId]
        )

        if (existing.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Subscription not found')
        }

        const current = existing.rows[0]

        // Handle status transitions (DB trigger will validate lifecycle)
        if (data.status !== undefined) {
          const newStatus = data.status
          const oldStatus = current.status

          // Validate transition (DB trigger will also validate)
          const validTransitions: Record<string, string[]> = {
            PENDING: ['ACTIVE', 'CANCELLED'],
            ACTIVE: ['SUSPENDED', 'EXPIRED', 'CANCELLED'],
            SUSPENDED: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
            EXPIRED: ['CANCELLED'],
            CANCELLED: [],
          }

          const allowed = validTransitions[current.status] || []
          if (!allowed.includes(data.status as string)) {
            throw new ValidationError(`Invalid status transition from ${current.status} to ${data.status}`)
          }

          // Handle status-specific logic
          if (data.status === 'ACTIVE') {
            // Activate: set starts_at if not set, clear ends_at
            await client.query(
              `UPDATE subscriptions SET status = 'ACTIVE', starts_at = COALESCE(starts_at, now()), ends_at = NULL, updated_at = now() WHERE id = $1`,
              [id]
            )
          } else if (data.status === 'SUSPENDED') {
            await client.query(
              `UPDATE subscriptions SET status = 'SUSPENDED', updated_at = now() WHERE id = $1`,
              [id]
            )
          } else if (data.status === 'CANCELLED') {
            await client.query(
              `UPDATE subscriptions SET status = 'CANCELLED', ends_at = now(), updated_at = now() WHERE id = $1`,
              [id]
            )
          } else if (data.status === 'EXPIRED') {
            await client.query(
              `UPDATE subscriptions SET status = 'EXPIRED', ends_at = now(), updated_at = now() WHERE id = $1`,
              [id]
            )
          }
        }

        // Handle metadata update
        if (data.metadata !== undefined) {
          await client.query(
            `UPDATE subscriptions SET metadata = $1, updated_at = now() WHERE id = $2`,
            [data.metadata ?? {}, id]
          )
        }

        // Return updated subscription
        const result = await client.query(
          `SELECT s.*, p.family as plan_family
           FROM subscriptions s
           JOIN plans p ON s.plan_code = p.code
           WHERE s.id = $1`,
          [id]
        )

        return mapRowToDto(result.rows[0])
      })
    },

    /**
     * Activate a subscription (PENDING -> ACTIVE).
     */
    async activate(id: string, tenantId: string): Promise<SubscriptionDto> {
      return withTransaction(pool, async (client) => {
        const existing = await client.query(
          'SELECT * FROM subscriptions WHERE id = $1 AND business_id = $2',
          [id, tenantId]
        )

        if (existing.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Subscription not found')
        }

        const current = existing.rows[0]

        if (current.status !== 'PENDING') {
          throw new ValidationError('Only PENDING subscriptions can be activated')
        }

        // Check replaceable family conflict
        const familyResult = await pool.query(
          'SELECT replacement_policy FROM subscription_families WHERE code = (SELECT family_code FROM subscriptions WHERE id = $1)',
          [id]
        )

        if (familyResult.rows[0].replacement_policy === 'REPLACEABLE') {
          const existingActive = await pool.query(
            `SELECT 1 FROM subscriptions
             WHERE business_id = $1 AND family_code = (SELECT family_code FROM subscriptions WHERE id = $2)
             AND status = 'ACTIVE' AND id != $2`,
            [tenantId, id]
          )

          if (existingActive.rows.length > 0) {
            throw new ConflictError(
              'SUBSCRIPTION_FAMILY_CONFLICT',
              'Business already has an active subscription in this replaceable family',
              { family_code: (await pool.query('SELECT family_code FROM subscriptions WHERE id = $1', [id])).rows[0].family_code }
            )
          }
        }

        const result = await pool.query(
          `UPDATE subscriptions
           SET status = 'ACTIVE', starts_at = COALESCE(starts_at, now()), ends_at = NULL, updated_at = now()
           WHERE id = $1
           RETURNING *`,
          [id]
        )

        return mapRowToDto(result.rows[0])
      })
    },

    /**
     * Suspend a subscription (ACTIVE -> SUSPENDED).
     */
    async suspend(id: string, tenantId: string): Promise<SubscriptionDto> {
      return withTransaction(pool, async (client) => {
        const existing = await client.query(
          'SELECT * FROM subscriptions WHERE id = $1 AND business_id = $2',
          [id, tenantId]
        )

        if (existing.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Subscription not found')
        }

        if (existing.rows[0].status !== 'ACTIVE') {
          throw new ValidationError('Only ACTIVE subscriptions can be suspended')
        }

        const result = await client.query(
          `UPDATE subscriptions SET status = 'SUSPENDED', updated_at = now() WHERE id = $1 RETURNING *`,
          [id]
        )

        return mapRowToDto(result.rows[0])
      })
    },

    /**
     * Cancel a subscription (ACTIVE/SUSPENDED -> CANCELLED).
     */
    async cancel(id: string, tenantId: string): Promise<SubscriptionDto> {
      return withTransaction(pool, async (client) => {
        const existing = await client.query(
          'SELECT * FROM subscriptions WHERE id = $1 AND business_id = $2',
          [id, tenantId]
        )

        if (existing.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Subscription not found')
        }

        const current = existing.rows[0]

        if (!['ACTIVE', 'SUSPENDED'].includes(current.status)) {
          throw new ValidationError('Only ACTIVE or SUSPENDED subscriptions can be cancelled')
        }

        const result = await client.query(
          `UPDATE subscriptions SET status = 'CANCELLED', ends_at = now(), updated_at = now() WHERE id = $1 RETURNING *`,
          [id]
        )

        return mapRowToDto(result.rows[0])
      })
    },

/**
     * List subscriptions for a business (with filters).
     */
    async listForBusiness(
      businessId: string,
      tenantId: string,
      filters?: {
        status?: string
        family_code?: string
        source?: string
        plan_code?: string
        limit?: number
        offset?: number
      }
    ): Promise<{ items: SubscriptionDto[]; total: number; limit: number; offset: number; has_more: boolean }> {
      assertTenant(businessId, tenantId)

      const limit = Math.min(filters?.limit ?? 50, 500)
      const offset = filters?.offset ?? 0

      return withTransaction(pool, async (client) => {
        let queryStr = `
          SELECT s.*, p.family as plan_family
          FROM subscriptions s
          JOIN plans p ON s.plan_code = p.code
          WHERE s.business_id = $1
        `
        const params: unknown[] = [tenantId]
        let paramIndex = 2

        // Add filters
        if (filters?.status) {
          queryStr += ` AND s.status = $${paramIndex++}`
          params.push(filters.status)
        }
        if (filters?.family_code) {
          queryStr += ` AND s.family_code = $${paramIndex++}`
          params.push(filters.family_code)
        }
        if (filters?.source) {
          queryStr += ` AND s.source = $${paramIndex++}`
          params.push(filters.source)
        }
        if (filters?.plan_code) {
          queryStr += ` AND s.plan_code = $${paramIndex++}`
          params.push(filters.plan_code)
        }

        // Get total count
        let countQuery = `
          SELECT COUNT(*) FROM subscriptions s
          JOIN plans p ON s.plan_code = p.code
          WHERE s.business_id = $1
        `
        const countParams = [tenantId]
        let countParamIdx = 2

        // Add same filters to count query
        if (filters?.status) {
          countQuery += ` AND s.status = $${countParamIdx++}`
        }
        if (filters?.family_code) {
          countQuery += ` AND s.family_code = $${countParamIdx++}`
        }
        if (filters?.source) {
          countQuery += ` AND s.source = $${countParamIdx++}`
        }
        if (filters?.plan_code) {
          countQuery += ` AND s.plan_code = $${countParamIdx++}`
        }

        const countResult = await client.query(countQuery, countParams)
        const total = parseInt(countResult.rows[0].count, 10)

        // Get paginated results
        queryStr += ` ORDER BY s.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
        params.push(limit, offset)

        const result = await client.query(queryStr, params)
        const items = result.rows.map(mapRowToDto)

        return {
          items,
          total,
          limit,
          offset,
          has_more: offset + items.length < total,
        }
      })
    },
  }
}
