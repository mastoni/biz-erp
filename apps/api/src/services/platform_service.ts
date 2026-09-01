import { Pool, QueryResultRow } from 'pg'
import { ApiError, ValidationError } from '../errors/api_error'
import { isUuid } from '../utils/uuid'
import { withTransaction } from '../db/transaction'

export interface PlatformContext {
  scope: 'platform'
  role: 'PLATFORM_ADMIN' | 'SUPER_ADMIN'
  userId: string
}

export interface PlatformPaginated<T> {
  items: T[]
  total: number
  limit: number
  offset: number
  has_more: boolean
  summary?: Record<string, unknown>
}

export interface BusinessListSummary {
  pending_count: number
  active_count: number
  suspended_count: number
  rejected_count: number
  total: number
}

export interface PlatformBusinessesResponse {
  items: Array<Record<string, unknown>>
  total: number
  limit: number
  offset: number
  has_more: boolean
  summary: BusinessListSummary
}

export interface PublicShowcaseItem {
  id: string
  section: string
  item_type: string
  item_code: string
  display_name: string
  headline: string | null
  description: string | null
  marketing_badge: string | null
  features_list: string[]
  display_order: number
  is_featured: boolean
  cta_text: string
  cta_url: string
  pricing: Record<string, unknown> | null
  target_details?: Record<string, unknown> | null
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 200

function parsePagination(query?: Record<string, unknown>): { limit: number; offset: number } {
  const q = query ?? {}
  const rawLimit = Number(q.limit)
  const rawOffset = Number(q.offset)

  let limit = DEFAULT_LIMIT
  if (Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= MAX_LIMIT) {
    limit = rawLimit
  } else if (Number.isInteger(rawLimit) && rawLimit > MAX_LIMIT) {
    limit = MAX_LIMIT
  }

  let offset = 0
  if (Number.isInteger(rawOffset) && rawOffset >= 0) {
    offset = rawOffset
  }

  return { limit, offset }
}

export function createPlatformService(pool: Pool) {
  async function listPage<T extends QueryResultRow = any>(
    selectClause: string,
    fromClause: string,
    orderBy: string,
    limit: number,
    offset: number
  ): Promise<PlatformPaginated<T>> {
    const countSql = `SELECT COUNT(*)::bigint AS count FROM ${fromClause}`
    const dataSql = `
      SELECT ${selectClause}
      FROM ${fromClause}
      ORDER BY ${orderBy}
      LIMIT $1 OFFSET $2
    `

    const [count, data] = await Promise.all([
      pool.query<{ count: string }>(countSql),
      pool.query<T>(dataSql, [limit, offset])
    ])

    const total = Number(count.rows[0]?.count ?? 0)

    return {
      items: data.rows,
      total,
      limit,
      offset,
      has_more: offset + data.rows.length < total
    }
  }

  return {
    getContext(role: 'PLATFORM_ADMIN' | 'SUPER_ADMIN', userId: string): PlatformContext {
      return { scope: 'platform', role, userId }
    },

    // =========================================================================
    // 1. BUSINESSES (SA-1)
    // =========================================================================
    async listBusinesses(query?: Record<string, unknown>): Promise<PlatformBusinessesResponse> {
      const { limit, offset } = parsePagination(query)
      const q = query ?? {}
      const statusFilter = typeof q.status === 'string' && q.status.trim() !== '' ? q.status.trim().toUpperCase() : undefined
      const searchFilter = typeof q.search === 'string' && q.search.trim() !== '' ? q.search.trim().toLowerCase() : undefined

      const conditions: string[] = []
      const params: any[] = []
      let paramIdx = 1

      if (statusFilter && statusFilter !== 'ALL') {
        const allowedStatuses = ['PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'TERMINATED']
        if (!allowedStatuses.includes(statusFilter)) {
          throw new ValidationError(`Invalid status filter. Allowed: ${allowedStatuses.join(', ')}`)
        }
        conditions.push(`b.status = $${paramIdx}`)
        params.push(statusFilter)
        paramIdx++
      }

      if (searchFilter) {
        conditions.push(`(LOWER(b.name) LIKE $${paramIdx} OR LOWER(COALESCE(u.email, '')) LIKE $${paramIdx})`)
        params.push(`%${searchFilter}%`)
        paramIdx++
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const fromClause = `
        businesses b
        LEFT JOIN users u ON u.id = b.owner_user_id
      `

      const countSql = `SELECT COUNT(*)::bigint AS count FROM ${fromClause} ${whereClause}`
      const countRes = await pool.query(countSql, params)
      const total = Number(countRes.rows[0].count)

      const selectCols = `
        b.id,
        b.name,
        COALESCE(b.status, 'ACTIVE') AS status,
        b.owner_user_id,
        u.email AS owner_email,
        b.approved_at,
        b.approved_by,
        b.rejected_reason,
        b.rejected_at,
        b.suspended_reason,
        b.suspended_at,
        b.created_at,
        b.updated_at
      `

      const queryParams = [...params, limit, offset]
      const dataSql = `
        SELECT ${selectCols}
        FROM ${fromClause}
        ${whereClause}
        ORDER BY b.created_at DESC
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
      `
      const dataRes = await pool.query(dataSql, queryParams)

      // Summary counts across all statuses
      const summaryRes = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'PENDING_REVIEW')::int AS pending_count,
          COUNT(*) FILTER (WHERE status = 'ACTIVE' OR status IS NULL)::int AS active_count,
          COUNT(*) FILTER (WHERE status = 'SUSPENDED')::int AS suspended_count,
          COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected_count,
          COUNT(*)::int AS total
        FROM businesses
      `)

      const summary: BusinessListSummary = summaryRes.rows[0] || {
        pending_count: 0,
        active_count: 0,
        suspended_count: 0,
        rejected_count: 0,
        total: 0
      }

      return {
        items: dataRes.rows,
        total,
        limit,
        offset,
        has_more: offset + dataRes.rows.length < total,
        summary
      }
    },

    async getBusinessById(id: string): Promise<Record<string, unknown>> {
      if (!isUuid(id)) {
        throw new ValidationError('Invalid business id format')
      }

      const sql = `
        SELECT
          b.id,
          b.name,
          COALESCE(b.status, 'ACTIVE') AS status,
          b.owner_user_id,
          u.email AS owner_email,
          b.approved_at,
          b.approved_by,
          appr.email AS approver_email,
          b.rejected_reason,
          b.rejected_at,
          rej.email AS rejector_email,
          b.suspended_reason,
          b.suspended_at,
          susp.email AS suspender_email,
          b.reactivated_at,
          react.email AS reactivator_email,
          b.created_at,
          b.updated_at,
          (SELECT COUNT(*)::int FROM branches WHERE business_id = b.id) AS branch_count,
          (SELECT COUNT(*)::int FROM user_businesses WHERE business_id = b.id) AS user_count,
          (SELECT COUNT(*)::int FROM subscriptions WHERE business_id = b.id AND status = 'ACTIVE') AS active_subscription_count
        FROM businesses b
        LEFT JOIN users u ON u.id = b.owner_user_id
        LEFT JOIN users appr ON appr.id = b.approved_by
        LEFT JOIN users rej ON rej.id = b.rejected_by
        LEFT JOIN users susp ON susp.id = b.suspended_by
        LEFT JOIN users react ON react.id = b.reactivated_by
        WHERE b.id = $1
      `
      const res = await pool.query(sql, [id])
      if (res.rows.length === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Business not found')
      }

      return res.rows[0]
    },

    async approveBusiness(id: string, actorUserId: string): Promise<Record<string, unknown>> {
      if (!isUuid(id)) {
        throw new ValidationError('Invalid business id format')
      }

      return withTransaction(pool, async (client) => {
        const bizRes = await client.query('SELECT id, status, name FROM businesses WHERE id = $1 FOR UPDATE', [id])
        if (bizRes.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Business not found')
        }

        const currentStatus = bizRes.rows[0].status || 'ACTIVE'
        if (currentStatus === 'ACTIVE') {
          throw new ApiError(400, 'INVALID_STATE_TRANSITION', 'Business is already active')
        }
        if (currentStatus !== 'PENDING_REVIEW') {
          throw new ApiError(400, 'INVALID_STATE_TRANSITION', `Cannot approve business with status '${currentStatus}'`)
        }

        const updateSql = `
          UPDATE businesses
          SET
            status = 'ACTIVE',
            approved_by = $1,
            approved_at = now(),
            updated_at = now()
          WHERE id = $2
          RETURNING id, name, status, approved_at, approved_by, updated_at
        `
        const res = await client.query(updateSql, [actorUserId, id])
        return res.rows[0]
      })
    },

    async rejectBusiness(id: string, actorUserId: string, reason?: string): Promise<Record<string, unknown>> {
      if (!isUuid(id)) {
        throw new ValidationError('Invalid business id format')
      }
      if (!reason || reason.trim() === '') {
        throw new ValidationError('Rejection reason is required')
      }

      return withTransaction(pool, async (client) => {
        const bizRes = await client.query('SELECT id, status, name FROM businesses WHERE id = $1 FOR UPDATE', [id])
        if (bizRes.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Business not found')
        }

        const currentStatus = bizRes.rows[0].status || 'ACTIVE'
        if (currentStatus !== 'PENDING_REVIEW') {
          throw new ApiError(400, 'INVALID_STATE_TRANSITION', `Cannot reject business with status '${currentStatus}'`)
        }

        const updateSql = `
          UPDATE businesses
          SET
            status = 'REJECTED',
            rejected_reason = $1,
            rejected_by = $2,
            rejected_at = now(),
            updated_at = now()
          WHERE id = $3
          RETURNING id, name, status, rejected_reason, rejected_at, rejected_by, updated_at
        `
        const res = await client.query(updateSql, [reason.trim(), actorUserId, id])
        return res.rows[0]
      })
    },

    async suspendBusiness(id: string, actorUserId: string, reason?: string): Promise<Record<string, unknown>> {
      if (!isUuid(id)) {
        throw new ValidationError('Invalid business id format')
      }
      if (!reason || reason.trim() === '') {
        throw new ValidationError('Suspension reason is required')
      }

      return withTransaction(pool, async (client) => {
        const bizRes = await client.query('SELECT id, status, name FROM businesses WHERE id = $1 FOR UPDATE', [id])
        if (bizRes.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Business not found')
        }

        const currentStatus = bizRes.rows[0].status || 'ACTIVE'
        if (currentStatus !== 'ACTIVE') {
          throw new ApiError(400, 'INVALID_STATE_TRANSITION', `Only active businesses can be suspended (current status: '${currentStatus}')`)
        }

        const updateSql = `
          UPDATE businesses
          SET
            status = 'SUSPENDED',
            suspended_reason = $1,
            suspended_by = $2,
            suspended_at = now(),
            updated_at = now()
          WHERE id = $3
          RETURNING id, name, status, suspended_reason, suspended_at, suspended_by, updated_at
        `
        const res = await client.query(updateSql, [reason.trim(), actorUserId, id])
        return res.rows[0]
      })
    },

    async reactivateBusiness(id: string, actorUserId: string): Promise<Record<string, unknown>> {
      if (!isUuid(id)) {
        throw new ValidationError('Invalid business id format')
      }

      return withTransaction(pool, async (client) => {
        const bizRes = await client.query('SELECT id, status, name FROM businesses WHERE id = $1 FOR UPDATE', [id])
        if (bizRes.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Business not found')
        }

        const currentStatus = bizRes.rows[0].status || 'ACTIVE'
        if (currentStatus !== 'SUSPENDED') {
          throw new ApiError(400, 'INVALID_STATE_TRANSITION', `Only suspended businesses can be reactivated (current status: '${currentStatus}')`)
        }

        const updateSql = `
          UPDATE businesses
          SET
            status = 'ACTIVE',
            reactivated_by = $1,
            reactivated_at = now(),
            updated_at = now()
          WHERE id = $2
          RETURNING id, name, status, reactivated_at, reactivated_by, updated_at
        `
        const res = await client.query(updateSql, [actorUserId, id])
        return res.rows[0]
      })
    },

    // =========================================================================
    // 2. MODULES & CATALOG
    // =========================================================================
    async listModules(query?: Record<string, unknown>): Promise<PlatformPaginated<Record<string, unknown>>> {
      const { limit, offset } = parsePagination(query)
      return listPage(
        'code, name, pillar, category, is_core, status, created_at, updated_at',
        'modules',
        'created_at DESC',
        limit,
        offset
      )
    },

    // =========================================================================
    // 3. PLANS & PRICING GOVERNANCE (SA-2)
    // =========================================================================
    async listPlans(query?: Record<string, unknown>): Promise<PlatformPaginated<Record<string, unknown>>> {
      const { limit, offset } = parsePagination(query)
      const q = query ?? {}
      const statusFilter = typeof q.status === 'string' && q.status.trim() !== '' ? q.status.trim().toUpperCase() : undefined
      const familyFilter = typeof q.family === 'string' && q.family.trim() !== '' ? q.family.trim() : undefined
      const searchFilter = typeof q.search === 'string' && q.search.trim() !== '' ? q.search.trim().toLowerCase() : undefined

      const conditions: string[] = []
      const params: any[] = []
      let paramIdx = 1

      if (statusFilter && statusFilter !== 'ALL') {
        conditions.push(`p.status = $${paramIdx}`)
        params.push(statusFilter)
        paramIdx++
      }

      if (familyFilter && familyFilter !== 'ALL') {
        conditions.push(`p.family = $${paramIdx}`)
        params.push(familyFilter)
        paramIdx++
      }

      if (searchFilter) {
        conditions.push(`(LOWER(p.name) LIKE $${paramIdx} OR LOWER(p.code) LIKE $${paramIdx})`)
        params.push(`%${searchFilter}%`)
        paramIdx++
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const fromClause = `plans p`

      const countSql = `SELECT COUNT(*)::bigint AS count FROM ${fromClause} ${whereClause}`
      const countRes = await pool.query(countSql, params)
      const total = Number(countRes.rows[0].count)

      const selectCols = `
        p.code,
        p.name,
        p.family,
        p.tier,
        p.billing_cycle,
        p.pricing,
        p.type,
        p.status,
        p.limits,
        p.trial_days,
        p.is_published,
        p.display_order,
        p.version,
        p.created_at,
        p.updated_at,
        (SELECT COUNT(*)::int FROM plan_modules WHERE plan_code = p.code) AS module_count
      `

      const queryParams = [...params, limit, offset]
      const dataSql = `
        SELECT ${selectCols}
        FROM ${fromClause}
        ${whereClause}
        ORDER BY p.display_order ASC, p.created_at DESC
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
      `
      const dataRes = await pool.query(dataSql, queryParams)

      const summaryRes = await pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active_count,
          COUNT(*) FILTER (WHERE status = 'DRAFT')::int AS draft_count,
          COUNT(*) FILTER (WHERE status = 'DEPRECATED')::int AS deprecated_count
        FROM plans
      `)

      return {
        items: dataRes.rows,
        total,
        limit,
        offset,
        has_more: offset + dataRes.rows.length < total,
        summary: summaryRes.rows[0]
      }
    },

    async getPlanByCode(code: string): Promise<Record<string, unknown>> {
      if (!code || typeof code !== 'string') {
        throw new ValidationError('Plan code is required')
      }

      const planSql = `
        SELECT
          p.code,
          p.name,
          p.family,
          p.tier,
          p.billing_cycle,
          p.pricing,
          p.type,
          p.status,
          p.limits,
          p.trial_days,
          p.is_published,
          p.display_order,
          p.version,
          p.metadata,
          p.created_at,
          p.updated_at
        FROM plans p
        WHERE p.code = $1
      `
      const planRes = await pool.query(planSql, [code])
      if (planRes.rows.length === 0) {
        throw new ApiError(404, 'NOT_FOUND', `Plan with code '${code}' not found`)
      }

      const plan = planRes.rows[0]

      // Fetch allocated modules
      const modulesSql = `
        SELECT
          m.code,
          m.name,
          m.pillar,
          m.category,
          m.is_core,
          pm.feature_overrides
        FROM plan_modules pm
        JOIN modules m ON m.code = pm.module_code
        WHERE pm.plan_code = $1
        ORDER BY m.pillar ASC, m.name ASC
      `
      const modulesRes = await pool.query(modulesSql, [code])
      plan.modules = modulesRes.rows

      // Fetch associated showcase items
      const showcaseSql = `
        SELECT id, section, display_name, marketing_badge, display_order, is_featured, is_published
        FROM showcase_items
        WHERE plan_code = $1
        ORDER BY section ASC, display_order ASC
      `
      const showcaseRes = await pool.query(showcaseSql, [code])
      plan.showcase_items = showcaseRes.rows

      return plan
    },

    async createPlan(input: Record<string, any>, actorUserId: string): Promise<Record<string, unknown>> {
      const code = String(input.code || '').trim().toUpperCase()
      const name = String(input.name || '').trim()
      const family = String(input.family || 'ERP_PLAN').trim()
      const tier = String(input.tier || 'STANDARD').trim().toUpperCase()
      const billing_cycle = String(input.billing_cycle || 'MONTHLY').trim().toUpperCase()
      const type = String(input.type || 'STANDALONE').trim().toUpperCase()
      const status = String(input.status || 'DRAFT').trim().toUpperCase()
      const trial_days = Math.max(0, Number(input.trial_days || 0))
      const is_published = Boolean(input.is_published)
      const display_order = Math.max(0, Number(input.display_order || 0))
      const limits = typeof input.limits === 'object' && input.limits !== null ? input.limits : {}

      if (!code || !/^[A-Z0-9_]{3,50}$/.test(code)) {
        throw new ValidationError('Plan code must be 3-50 uppercase alphanumeric characters with underscores')
      }
      if (!name) {
        throw new ValidationError('Plan name is required')
      }

      const allowedCycles = ['MONTHLY', 'QUARTERLY', 'ANNUAL']
      if (!allowedCycles.includes(billing_cycle)) {
        throw new ValidationError(`Invalid billing_cycle. Allowed: ${allowedCycles.join(', ')}`)
      }

      const allowedStatuses = ['DRAFT', 'ACTIVE', 'DEPRECATED']
      if (!allowedStatuses.includes(status)) {
        throw new ValidationError(`Invalid status. Allowed: ${allowedStatuses.join(', ')}`)
      }

      // Format pricing
      const rawPricing = input.pricing || {}
      const base_price = Math.max(0, Number(rawPricing.base_price || 0))
      const discount = Math.max(0, Number(rawPricing.discount || 0))
      const tax = Math.max(0, Number(rawPricing.tax || 0))
      const final_price = Math.max(0, Number(rawPricing.final_price || (base_price - discount + tax)))
      const currency = 'IDR'

      const pricing = {
        base_price,
        discount,
        tax,
        final_price,
        currency
      }

      const sql = `
        INSERT INTO plans (
          code, name, family, tier, billing_cycle, pricing, type, status, limits, trial_days, is_published, display_order, version, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, now(), now()
        ) RETURNING *
      `
      try {
        const res = await pool.query(sql, [
          code, name, family, tier, billing_cycle, JSON.stringify(pricing), type, status, JSON.stringify(limits), trial_days, is_published, display_order
        ])
        return res.rows[0]
      } catch (err: any) {
        if (err.code === '23505') {
          throw new ApiError(409, 'CONFLICT', `Plan with code '${code}' already exists`)
        }
        throw err
      }
    },

    async updatePlan(code: string, input: Record<string, any>, actorUserId: string): Promise<Record<string, unknown>> {
      return withTransaction(pool, async (client) => {
        const checkRes = await client.query('SELECT code, version, status FROM plans WHERE code = $1 FOR UPDATE', [code])
        if (checkRes.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', `Plan with code '${code}' not found`)
        }

        const currentVersion = checkRes.rows[0].version
        if (input.expected_version !== undefined && Number(input.expected_version) !== currentVersion) {
          throw new ApiError(409, 'CONCURRENT_MODIFICATION', `Plan was modified by another transaction (expected version ${input.expected_version}, current ${currentVersion})`)
        }

        const name = input.name !== undefined ? String(input.name).trim() : undefined
        const family = input.family !== undefined ? String(input.family).trim() : undefined
        const tier = input.tier !== undefined ? String(input.tier).trim().toUpperCase() : undefined
        const billing_cycle = input.billing_cycle !== undefined ? String(input.billing_cycle).trim().toUpperCase() : undefined
        const type = input.type !== undefined ? String(input.type).trim().toUpperCase() : undefined
        const trial_days = input.trial_days !== undefined ? Math.max(0, Number(input.trial_days)) : undefined
        const is_published = input.is_published !== undefined ? Boolean(input.is_published) : undefined
        const display_order = input.display_order !== undefined ? Math.max(0, Number(input.display_order)) : undefined
        const limits = input.limits !== undefined ? JSON.stringify(input.limits) : undefined

        let pricingJson: string | undefined = undefined
        if (input.pricing) {
          const raw = input.pricing
          const base_price = Math.max(0, Number(raw.base_price || 0))
          const discount = Math.max(0, Number(raw.discount || 0))
          const tax = Math.max(0, Number(raw.tax || 0))
          const final_price = Math.max(0, Number(raw.final_price || (base_price - discount + tax)))
          pricingJson = JSON.stringify({ base_price, discount, tax, final_price, currency: 'IDR' })
        }

        const sql = `
          UPDATE plans
          SET
            name = COALESCE($1, name),
            family = COALESCE($2, family),
            tier = COALESCE($3, tier),
            billing_cycle = COALESCE($4, billing_cycle),
            type = COALESCE($5, type),
            trial_days = COALESCE($6, trial_days),
            is_published = COALESCE($7, is_published),
            display_order = COALESCE($8, display_order),
            limits = COALESCE($9::jsonb, limits),
            pricing = COALESCE($10::jsonb, pricing),
            version = version + 1,
            updated_at = now()
          WHERE code = $11
          RETURNING *
        `
        const res = await client.query(sql, [
          name, family, tier, billing_cycle, type, trial_days, is_published, display_order, limits, pricingJson, code
        ])
        return res.rows[0]
      })
    },

    async setPlanStatus(code: string, newStatus: string, actorUserId: string): Promise<Record<string, unknown>> {
      const allowed = ['DRAFT', 'ACTIVE', 'DEPRECATED']
      const status = String(newStatus).trim().toUpperCase()
      if (!allowed.includes(status)) {
        throw new ValidationError(`Invalid plan status. Allowed: ${allowed.join(', ')}`)
      }

      return withTransaction(pool, async (client) => {
        const checkRes = await client.query('SELECT code, status FROM plans WHERE code = $1 FOR UPDATE', [code])
        if (checkRes.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', `Plan with code '${code}' not found`)
        }

        const currentStatus = checkRes.rows[0].status
        if (currentStatus === status) {
          return checkRes.rows[0]
        }

        const updateSql = `
          UPDATE plans
          SET
            status = $1,
            version = version + 1,
            updated_at = now()
          WHERE code = $2
          RETURNING *
        `
        const res = await client.query(updateSql, [status, code])
        return res.rows[0]
      })
    },

    async setPlanModules(
      code: string,
      modules: Array<{ module_code: string; feature_overrides?: Record<string, any> }>,
      actorUserId: string
    ): Promise<Record<string, unknown>> {
      if (!Array.isArray(modules)) {
        throw new ValidationError('Modules must be an array')
      }

      return withTransaction(pool, async (client) => {
        const planRes = await client.query('SELECT code FROM plans WHERE code = $1 FOR UPDATE', [code])
        if (planRes.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', `Plan with code '${code}' not found`)
        }

        // Validate all module_code exist
        const moduleCodes = Array.from(new Set(modules.map(m => m.module_code)))
        if (moduleCodes.length > 0) {
          const modCheck = await client.query(
            `SELECT code FROM modules WHERE code = ANY($1::text[])`,
            [moduleCodes]
          )
          if (modCheck.rows.length !== moduleCodes.length) {
            const found = new Set(modCheck.rows.map(r => r.code))
            const missing = moduleCodes.filter(c => !found.has(c))
            throw new ApiError(400, 'INVALID_MODULE', `Modules not found: ${missing.join(', ')}`)
          }
        }

        // Clear existing plan_modules
        await client.query('DELETE FROM plan_modules WHERE plan_code = $1', [code])

        // Insert new plan_modules
        for (const mod of modules) {
          await client.query(
            `INSERT INTO plan_modules (plan_code, module_code, feature_overrides, created_at)
             VALUES ($1, $2, $3, now())`,
            [code, mod.module_code, JSON.stringify(mod.feature_overrides || {})]
          )
        }

        // Update plan version
        await client.query('UPDATE plans SET version = version + 1, updated_at = now() WHERE code = $1', [code])

        return { plan_code: code, module_count: modules.length }
      })
    },

    // =========================================================================
    // 4. BUNDLE GOVERNANCE (SA-2)
    // =========================================================================
    async listBundles(query?: Record<string, unknown>): Promise<PlatformPaginated<Record<string, unknown>>> {
      const { limit, offset } = parsePagination(query)
      const q = query ?? {}
      const statusFilter = typeof q.status === 'string' && q.status.trim() !== '' ? q.status.trim().toUpperCase() : undefined
      const searchFilter = typeof q.search === 'string' && q.search.trim() !== '' ? q.search.trim().toLowerCase() : undefined

      const conditions: string[] = []
      const params: any[] = []
      let paramIdx = 1

      if (statusFilter && statusFilter !== 'ALL') {
        conditions.push(`b.status = $${paramIdx}`)
        params.push(statusFilter)
        paramIdx++
      }

      if (searchFilter) {
        conditions.push(`(LOWER(b.name) LIKE $${paramIdx} OR LOWER(b.code) LIKE $${paramIdx})`)
        params.push(`%${searchFilter}%`)
        paramIdx++
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const fromClause = `bundles b`

      const countSql = `SELECT COUNT(*)::bigint AS count FROM ${fromClause} ${whereClause}`
      const countRes = await pool.query(countSql, params)
      const total = Number(countRes.rows[0].count)

      const selectCols = `
        b.code,
        b.name,
        b.pricing,
        b.target_segment,
        b.installation_required,
        b.installation_service_code,
        b.presentation_metadata,
        b.status,
        b.is_published,
        b.display_order,
        b.version,
        b.created_at,
        b.updated_at,
        (SELECT COUNT(*)::int FROM bundle_items WHERE bundle_code = b.code) AS item_count
      `

      const queryParams = [...params, limit, offset]
      const dataSql = `
        SELECT ${selectCols}
        FROM ${fromClause}
        ${whereClause}
        ORDER BY b.display_order ASC, b.created_at DESC
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
      `
      const dataRes = await pool.query(dataSql, queryParams)

      const summaryRes = await pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active_count,
          COUNT(*) FILTER (WHERE status = 'DRAFT')::int AS draft_count,
          COUNT(*) FILTER (WHERE status = 'DEPRECATED')::int AS deprecated_count
        FROM bundles
      `)

      return {
        items: dataRes.rows,
        total,
        limit,
        offset,
        has_more: offset + dataRes.rows.length < total,
        summary: summaryRes.rows[0]
      }
    },

    async getBundleByCode(code: string): Promise<Record<string, unknown>> {
      if (!code || typeof code !== 'string') {
        throw new ValidationError('Bundle code is required')
      }

      const bundleSql = `
        SELECT
          b.code,
          b.name,
          b.pricing,
          b.target_segment,
          b.installation_required,
          b.installation_service_code,
          b.presentation_metadata,
          b.status,
          b.is_published,
          b.display_order,
          b.version,
          b.created_at,
          b.updated_at
        FROM bundles b
        WHERE b.code = $1
      `
      const bundleRes = await pool.query(bundleSql, [code])
      if (bundleRes.rows.length === 0) {
        throw new ApiError(404, 'NOT_FOUND', `Bundle with code '${code}' not found`)
      }

      const bundle = bundleRes.rows[0]

      // Fetch items
      const itemsSql = `
        SELECT id, bundle_code, item_type, item_code, quantity, required, created_at
        FROM bundle_items
        WHERE bundle_code = $1
        ORDER BY id ASC
      `
      const itemsRes = await pool.query(itemsSql, [code])
      bundle.items = itemsRes.rows

      // Fetch showcase items
      const showcaseSql = `
        SELECT id, section, display_name, marketing_badge, display_order, is_featured, is_published
        FROM showcase_items
        WHERE bundle_code = $1
        ORDER BY section ASC, display_order ASC
      `
      const showcaseRes = await pool.query(showcaseSql, [code])
      bundle.showcase_items = showcaseRes.rows

      return bundle
    },

    async createBundle(input: Record<string, any>, actorUserId: string): Promise<Record<string, unknown>> {
      const code = String(input.code || '').trim().toUpperCase()
      const name = String(input.name || '').trim()
      const target_segment = input.target_segment ? String(input.target_segment).trim() : null
      const installation_required = Boolean(input.installation_required)
      const installation_service_code = input.installation_service_code ? String(input.installation_service_code).trim() : null
      const status = String(input.status || 'DRAFT').trim().toUpperCase()
      const is_published = Boolean(input.is_published)
      const display_order = Math.max(0, Number(input.display_order || 0))
      const presentation_metadata = typeof input.presentation_metadata === 'object' && input.presentation_metadata !== null ? input.presentation_metadata : {}

      if (!code || !/^[A-Z0-9_]{3,50}$/.test(code)) {
        throw new ValidationError('Bundle code must be 3-50 uppercase alphanumeric characters with underscores')
      }
      if (!name) {
        throw new ValidationError('Bundle name is required')
      }

      const allowedStatuses = ['DRAFT', 'ACTIVE', 'DEPRECATED']
      if (!allowedStatuses.includes(status)) {
        throw new ValidationError(`Invalid status. Allowed: ${allowedStatuses.join(', ')}`)
      }

      const rawPricing = input.pricing || {}
      const pricing = {
        one_time: Math.max(0, Number(rawPricing.one_time || 0)),
        monthly: Math.max(0, Number(rawPricing.monthly || 0)),
        commitment_months: Math.max(1, Number(rawPricing.commitment_months || 12))
      }

      const sql = `
        INSERT INTO bundles (
          code, name, pricing, target_segment, installation_required, installation_service_code, presentation_metadata, status, is_published, display_order, version, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, now(), now()
        ) RETURNING *
      `
      try {
        const res = await pool.query(sql, [
          code, name, JSON.stringify(pricing), target_segment, installation_required, installation_service_code, JSON.stringify(presentation_metadata), status, is_published, display_order
        ])
        return res.rows[0]
      } catch (err: any) {
        if (err.code === '23505') {
          throw new ApiError(409, 'CONFLICT', `Bundle with code '${code}' already exists`)
        }
        throw err
      }
    },

    async updateBundle(code: string, input: Record<string, any>, actorUserId: string): Promise<Record<string, unknown>> {
      return withTransaction(pool, async (client) => {
        const checkRes = await client.query('SELECT code, version FROM bundles WHERE code = $1 FOR UPDATE', [code])
        if (checkRes.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', `Bundle with code '${code}' not found`)
        }

        const currentVersion = checkRes.rows[0].version
        if (input.expected_version !== undefined && Number(input.expected_version) !== currentVersion) {
          throw new ApiError(409, 'CONCURRENT_MODIFICATION', `Bundle was modified by another transaction (expected version ${input.expected_version}, current ${currentVersion})`)
        }

        const name = input.name !== undefined ? String(input.name).trim() : undefined
        const target_segment = input.target_segment !== undefined ? String(input.target_segment).trim() : undefined
        const installation_required = input.installation_required !== undefined ? Boolean(input.installation_required) : undefined
        const installation_service_code = input.installation_service_code !== undefined ? String(input.installation_service_code).trim() : undefined
        const is_published = input.is_published !== undefined ? Boolean(input.is_published) : undefined
        const display_order = input.display_order !== undefined ? Math.max(0, Number(input.display_order)) : undefined
        const presentation_metadata = input.presentation_metadata !== undefined ? JSON.stringify(input.presentation_metadata) : undefined

        let pricingJson: string | undefined = undefined
        if (input.pricing) {
          const raw = input.pricing
          pricingJson = JSON.stringify({
            one_time: Math.max(0, Number(raw.one_time || 0)),
            monthly: Math.max(0, Number(raw.monthly || 0)),
            commitment_months: Math.max(1, Number(raw.commitment_months || 12))
          })
        }

        const sql = `
          UPDATE bundles
          SET
            name = COALESCE($1, name),
            target_segment = COALESCE($2, target_segment),
            installation_required = COALESCE($3, installation_required),
            installation_service_code = COALESCE($4, installation_service_code),
            is_published = COALESCE($5, is_published),
            display_order = COALESCE($6, display_order),
            presentation_metadata = COALESCE($7::jsonb, presentation_metadata),
            pricing = COALESCE($8::jsonb, pricing),
            version = version + 1,
            updated_at = now()
          WHERE code = $9
          RETURNING *
        `
        const res = await client.query(sql, [
          name, target_segment, installation_required, installation_service_code, is_published, display_order, presentation_metadata, pricingJson, code
        ])
        return res.rows[0]
      })
    },

    async setBundleStatus(code: string, newStatus: string, actorUserId: string): Promise<Record<string, unknown>> {
      const allowed = ['DRAFT', 'ACTIVE', 'DEPRECATED']
      const status = String(newStatus).trim().toUpperCase()
      if (!allowed.includes(status)) {
        throw new ValidationError(`Invalid bundle status. Allowed: ${allowed.join(', ')}`)
      }

      return withTransaction(pool, async (client) => {
        const checkRes = await client.query('SELECT code, status FROM bundles WHERE code = $1 FOR UPDATE', [code])
        if (checkRes.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', `Bundle with code '${code}' not found`)
        }

        // When activating bundle, validate items integrity
        if (status === 'ACTIVE') {
          const itemsRes = await client.query('SELECT item_type, item_code, quantity FROM bundle_items WHERE bundle_code = $1', [code])
          if (itemsRes.rows.length === 0) {
            throw new ApiError(400, 'BUNDLE_EMPTY', 'Cannot activate a bundle without items')
          }

          for (const item of itemsRes.rows) {
            if (item.item_type === 'PLAN') {
              const p = await client.query('SELECT status FROM plans WHERE code = $1', [item.item_code])
              if (p.rows.length === 0 || p.rows[0].status !== 'ACTIVE') {
                throw new ApiError(400, 'BUNDLE_ITEM_INACTIVE', `Referenced plan '${item.item_code}' is not active`)
              }
            } else if (['PRODUCT', 'HARDWARE', 'SERVICE'].includes(item.item_type)) {
              const cp = await client.query('SELECT status FROM catalog_products WHERE code = $1', [item.item_code])
              if (cp.rows.length === 0 || cp.rows[0].status !== 'ACTIVE') {
                throw new ApiError(400, 'BUNDLE_ITEM_INACTIVE', `Referenced product '${item.item_code}' is not active`)
              }
            }
          }
        }

        const updateSql = `
          UPDATE bundles
          SET
            status = $1,
            version = version + 1,
            updated_at = now()
          WHERE code = $2
          RETURNING *
        `
        const res = await client.query(updateSql, [status, code])
        return res.rows[0]
      })
    },

    async setBundleItems(
      code: string,
      items: Array<{ item_type: string; item_code: string; quantity: number; required?: boolean }>,
      actorUserId: string
    ): Promise<Record<string, unknown>> {
      if (!Array.isArray(items)) {
        throw new ValidationError('Items must be an array')
      }

      return withTransaction(pool, async (client) => {
        const bundleRes = await client.query('SELECT code FROM bundles WHERE code = $1 FOR UPDATE', [code])
        if (bundleRes.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', `Bundle with code '${code}' not found`)
        }

        const allowedTypes = ['PLAN', 'PRODUCT', 'SERVICE', 'HARDWARE']

        // Validate each item
        for (const item of items) {
          const type = String(item.item_type || '').toUpperCase()
          if (!allowedTypes.includes(type)) {
            throw new ValidationError(`Invalid item_type '${item.item_type}'. Allowed: ${allowedTypes.join(', ')}`)
          }
          if (Number(item.quantity) < 1) {
            throw new ValidationError(`Item quantity must be at least 1 (got ${item.quantity} for '${item.item_code}')`)
          }

          if (type === 'PLAN') {
            const p = await client.query('SELECT code FROM plans WHERE code = $1', [item.item_code])
            if (p.rows.length === 0) {
              throw new ApiError(400, 'INVALID_ITEM', `Plan with code '${item.item_code}' not found`)
            }
          } else {
            const cp = await client.query('SELECT code FROM catalog_products WHERE code = $1', [item.item_code])
            if (cp.rows.length === 0) {
              throw new ApiError(400, 'INVALID_ITEM', `Catalog product with code '${item.item_code}' not found`)
            }
          }
        }

        // Replace bundle items
        await client.query('DELETE FROM bundle_items WHERE bundle_code = $1', [code])

        for (const item of items) {
          await client.query(
            `INSERT INTO bundle_items (bundle_code, item_type, item_code, quantity, required, created_at)
             VALUES ($1, $2, $3, $4, $5, now())`,
            [code, item.item_type.toUpperCase(), item.item_code, Math.max(1, Number(item.quantity)), item.required !== false]
          )
        }

        await client.query('UPDATE bundles SET version = version + 1, updated_at = now() WHERE code = $1', [code])

        return { bundle_code: code, item_count: items.length }
      })
    },

    // =========================================================================
    // 5. SHOWCASE GOVERNANCE (SA-2)
    // =========================================================================
    async listShowcaseItems(query?: Record<string, unknown>): Promise<PlatformPaginated<Record<string, unknown>>> {
      const { limit, offset } = parsePagination(query)
      const q = query ?? {}
      const sectionFilter = typeof q.section === 'string' && q.section.trim() !== '' ? q.section.trim().toUpperCase() : undefined
      const isPublishedFilter = q.is_published !== undefined ? q.is_published === 'true' || q.is_published === true : undefined

      const conditions: string[] = []
      const params: any[] = []
      let paramIdx = 1

      if (sectionFilter && sectionFilter !== 'ALL') {
        conditions.push(`s.section = $${paramIdx}`)
        params.push(sectionFilter)
        paramIdx++
      }

      if (isPublishedFilter !== undefined) {
        conditions.push(`s.is_published = $${paramIdx}`)
        params.push(isPublishedFilter)
        paramIdx++
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const fromClause = `showcase_items s`

      const countSql = `SELECT COUNT(*)::bigint AS count FROM ${fromClause} ${whereClause}`
      const countRes = await pool.query(countSql, params)
      const total = Number(countRes.rows[0].count)

      const selectCols = `
        s.id,
        s.section,
        s.item_type,
        s.plan_code,
        s.bundle_code,
        s.catalog_product_code,
        s.custom_item_code,
        s.display_name,
        s.headline,
        s.description,
        s.marketing_badge,
        s.features_list,
        s.display_order,
        s.is_featured,
        s.is_published,
        s.cta_text,
        s.cta_url,
        s.version,
        s.created_at,
        s.updated_at
      `

      const queryParams = [...params, limit, offset]
      const dataSql = `
        SELECT ${selectCols}
        FROM ${fromClause}
        ${whereClause}
        ORDER BY s.section ASC, s.display_order ASC, s.created_at DESC
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
      `
      const dataRes = await pool.query(dataSql, queryParams)

      return {
        items: dataRes.rows,
        total,
        limit,
        offset,
        has_more: offset + dataRes.rows.length < total
      }
    },

    async getShowcaseItemById(id: string): Promise<Record<string, unknown>> {
      if (!isUuid(id)) {
        throw new ValidationError('Invalid showcase item id format')
      }

      const res = await pool.query('SELECT * FROM showcase_items WHERE id = $1', [id])
      if (res.rows.length === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Showcase item not found')
      }

      return res.rows[0]
    },

    async createShowcaseItem(input: Record<string, any>, actorUserId: string): Promise<Record<string, unknown>> {
      const section = String(input.section || '').trim().toUpperCase()
      const item_type = String(input.item_type || '').trim().toUpperCase()
      const display_name = String(input.display_name || '').trim()
      const headline = input.headline ? String(input.headline).trim() : null
      const description = input.description ? String(input.description).trim() : null
      const marketing_badge = input.marketing_badge ? String(input.marketing_badge).trim() : null
      const features_list = Array.isArray(input.features_list) ? input.features_list : []
      const display_order = Math.max(0, Number(input.display_order || 0))
      const is_featured = Boolean(input.is_featured)
      const is_published = input.is_published !== undefined ? Boolean(input.is_published) : true
      const cta_text = String(input.cta_text || 'Pilih Paket').trim()
      const cta_url = String(input.cta_url || '/register').trim()

      const allowedSections = ['HERO_FEATURED', 'ERP_PLANS', 'ISP_PLANS', 'BUNDLES', 'HARDWARE', 'PROMOS']
      if (!allowedSections.includes(section)) {
        throw new ValidationError(`Invalid section. Allowed: ${allowedSections.join(', ')}`)
      }

      const allowedTypes = ['PLAN', 'BUNDLE', 'CATALOG_PRODUCT', 'CUSTOM']
      if (!allowedTypes.includes(item_type)) {
        throw new ValidationError(`Invalid item_type. Allowed: ${allowedTypes.join(', ')}`)
      }

      if (!display_name) {
        throw new ValidationError('Display name is required')
      }

      let plan_code: string | null = null
      let bundle_code: string | null = null
      let catalog_product_code: string | null = null
      let custom_item_code: string | null = null

      if (item_type === 'PLAN') {
        if (input.bundle_code || input.catalog_product_code || input.custom_item_code) {
          throw new ValidationError('Target exclusivity violated: cannot provide other target codes when item_type is PLAN')
        }
        plan_code = String(input.plan_code || '').trim()
        if (!plan_code) throw new ValidationError('plan_code is required for PLAN showcase item')
        const p = await pool.query('SELECT code FROM plans WHERE code = $1', [plan_code])
        if (p.rows.length === 0) throw new ApiError(400, 'INVALID_TARGET', `Plan '${plan_code}' not found`)
      } else if (item_type === 'BUNDLE') {
        if (input.plan_code || input.catalog_product_code || input.custom_item_code) {
          throw new ValidationError('Target exclusivity violated: cannot provide other target codes when item_type is BUNDLE')
        }
        bundle_code = String(input.bundle_code || '').trim()
        if (!bundle_code) throw new ValidationError('bundle_code is required for BUNDLE showcase item')
        const b = await pool.query('SELECT code FROM bundles WHERE code = $1', [bundle_code])
        if (b.rows.length === 0) throw new ApiError(400, 'INVALID_TARGET', `Bundle '${bundle_code}' not found`)
      } else if (item_type === 'CATALOG_PRODUCT') {
        if (input.plan_code || input.bundle_code || input.custom_item_code) {
          throw new ValidationError('Target exclusivity violated: cannot provide other target codes when item_type is CATALOG_PRODUCT')
        }
        catalog_product_code = String(input.catalog_product_code || '').trim()
        if (!catalog_product_code) throw new ValidationError('catalog_product_code is required for CATALOG_PRODUCT showcase item')
        const cp = await pool.query('SELECT code FROM catalog_products WHERE code = $1', [catalog_product_code])
        if (cp.rows.length === 0) throw new ApiError(400, 'INVALID_TARGET', `Catalog product '${catalog_product_code}' not found`)
      } else if (item_type === 'CUSTOM') {
        if (input.plan_code || input.bundle_code || input.catalog_product_code) {
          throw new ValidationError('Target exclusivity violated: cannot provide other target codes when item_type is CUSTOM')
        }
        custom_item_code = String(input.custom_item_code || display_name).trim()
      }

      const sql = `
        INSERT INTO showcase_items (
          section, item_type, plan_code, bundle_code, catalog_product_code, custom_item_code,
          display_name, headline, description, marketing_badge, features_list,
          display_order, is_featured, is_published, cta_text, cta_url, version, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 1, now(), now()
        ) RETURNING *
      `
      const res = await pool.query(sql, [
        section, item_type, plan_code, bundle_code, catalog_product_code, custom_item_code,
        display_name, headline, description, marketing_badge, JSON.stringify(features_list),
        display_order, is_featured, is_published, cta_text, cta_url
      ])
      return res.rows[0]
    },

    async updateShowcaseItem(id: string, input: Record<string, any>, actorUserId: string): Promise<Record<string, unknown>> {
      if (!isUuid(id)) {
        throw new ValidationError('Invalid showcase item id format')
      }

      return withTransaction(pool, async (client) => {
        const checkRes = await client.query('SELECT id, version FROM showcase_items WHERE id = $1 FOR UPDATE', [id])
        if (checkRes.rows.length === 0) {
          throw new ApiError(404, 'NOT_FOUND', 'Showcase item not found')
        }

        const currentVersion = checkRes.rows[0].version
        if (input.expected_version !== undefined && Number(input.expected_version) !== currentVersion) {
          throw new ApiError(409, 'CONCURRENT_MODIFICATION', `Showcase item was modified by another transaction (expected version ${input.expected_version}, current ${currentVersion})`)
        }

        const display_name = input.display_name !== undefined ? String(input.display_name).trim() : undefined
        const headline = input.headline !== undefined ? String(input.headline).trim() : undefined
        const description = input.description !== undefined ? String(input.description).trim() : undefined
        const marketing_badge = input.marketing_badge !== undefined ? String(input.marketing_badge).trim() : undefined
        const features_list = input.features_list !== undefined ? JSON.stringify(input.features_list) : undefined
        const display_order = input.display_order !== undefined ? Math.max(0, Number(input.display_order)) : undefined
        const is_featured = input.is_featured !== undefined ? Boolean(input.is_featured) : undefined
        const is_published = input.is_published !== undefined ? Boolean(input.is_published) : undefined
        const cta_text = input.cta_text !== undefined ? String(input.cta_text).trim() : undefined
        const cta_url = input.cta_url !== undefined ? String(input.cta_url).trim() : undefined

        const sql = `
          UPDATE showcase_items
          SET
            display_name = COALESCE($1, display_name),
            headline = COALESCE($2, headline),
            description = COALESCE($3, description),
            marketing_badge = COALESCE($4, marketing_badge),
            features_list = COALESCE($5::jsonb, features_list),
            display_order = COALESCE($6, display_order),
            is_featured = COALESCE($7, is_featured),
            is_published = COALESCE($8, is_published),
            cta_text = COALESCE($9, cta_text),
            cta_url = COALESCE($10, cta_url),
            version = version + 1,
            updated_at = now()
          WHERE id = $11
          RETURNING *
        `
        const res = await client.query(sql, [
          display_name, headline, description, marketing_badge, features_list, display_order, is_featured, is_published, cta_text, cta_url, id
        ])
        return res.rows[0]
      })
    },

    async setShowcasePublish(id: string, is_published: boolean, actorUserId: string): Promise<Record<string, unknown>> {
      if (!isUuid(id)) {
        throw new ValidationError('Invalid showcase item id format')
      }

      const res = await pool.query(`
        UPDATE showcase_items
        SET
          is_published = $1,
          version = version + 1,
          updated_at = now()
        WHERE id = $2
        RETURNING *
      `, [is_published, id])

      if (res.rows.length === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Showcase item not found')
      }
      return res.rows[0]
    },

    async deleteShowcaseItem(id: string, actorUserId: string): Promise<void> {
      if (!isUuid(id)) {
        throw new ValidationError('Invalid showcase item id format')
      }

      const res = await pool.query('DELETE FROM showcase_items WHERE id = $1 RETURNING id', [id])
      if (res.rows.length === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Showcase item not found')
      }
    },

    // =========================================================================
    // 6. PUBLIC SHOWCASE API (For Landing Page & Public Visitors)
    // =========================================================================
    async getPublicShowcase(sectionFilter?: string): Promise<{ items: PublicShowcaseItem[] }> {
      const conditions: string[] = ['s.is_published = TRUE']
      const params: any[] = []
      let paramIdx = 1

      if (sectionFilter && sectionFilter.trim() !== '' && sectionFilter !== 'ALL') {
        conditions.push(`s.section = $${paramIdx}`)
        params.push(sectionFilter.trim().toUpperCase())
        paramIdx++
      }

      const sql = `
        SELECT
          s.id,
          s.section,
          s.item_type,
          s.plan_code,
          s.bundle_code,
          s.catalog_product_code,
          s.custom_item_code,
          s.display_name,
          s.headline,
          s.description,
          s.marketing_badge,
          s.features_list,
          s.display_order,
          s.is_featured,
          s.cta_text,
          s.cta_url,
          p.status AS plan_status,
          p.pricing AS plan_pricing,
          p.family AS plan_family,
          p.billing_cycle AS plan_billing_cycle,
          b.status AS bundle_status,
          b.pricing AS bundle_pricing,
          cp.status AS catalog_product_status,
          cp.base_price AS catalog_product_base_price,
          cp.billing_model AS catalog_product_billing_model
        FROM showcase_items s
        LEFT JOIN plans p ON p.code = s.plan_code
        LEFT JOIN bundles b ON b.code = s.bundle_code
        LEFT JOIN catalog_products cp ON cp.code = s.catalog_product_code
        WHERE ${conditions.join(' AND ')}
        ORDER BY s.section ASC, s.display_order ASC, s.created_at ASC
      `

      const res = await pool.query(sql, params)

      // Filter out invalid/non-active underlying targets and build clean DTO
      const publicItems: PublicShowcaseItem[] = []

      for (const row of res.rows) {
        let item_code = ''
        let pricing: Record<string, unknown> | null = null
        let target_details: Record<string, unknown> | null = null

        if (row.item_type === 'PLAN') {
          // If plan is not active, skip public exposure
          if (row.plan_status !== 'ACTIVE') continue
          item_code = row.plan_code
          pricing = row.plan_pricing || null
          target_details = {
            family: row.plan_family,
            billing_cycle: row.plan_billing_cycle
          }
        } else if (row.item_type === 'BUNDLE') {
          if (row.bundle_status !== 'ACTIVE') continue
          item_code = row.bundle_code
          pricing = row.bundle_pricing || null
        } else if (row.item_type === 'CATALOG_PRODUCT') {
          if (row.catalog_product_status !== 'ACTIVE') continue
          item_code = row.catalog_product_code
          pricing = {
            base_price: Number(row.catalog_product_base_price),
            billing_model: row.catalog_product_billing_model,
            currency: 'IDR'
          }
        } else if (row.item_type === 'CUSTOM') {
          item_code = row.custom_item_code || row.id
        }

        publicItems.push({
          id: row.id,
          section: row.section,
          item_type: row.item_type,
          item_code,
          display_name: row.display_name,
          headline: row.headline,
          description: row.description,
          marketing_badge: row.marketing_badge,
          features_list: Array.isArray(row.features_list) ? row.features_list : [],
          display_order: row.display_order,
          is_featured: row.is_featured,
          cta_text: row.cta_text,
          cta_url: row.cta_url,
          pricing,
          target_details
        })
      }

      return { items: publicItems }
    },

    // =========================================================================
    // 7. SUBSCRIPTIONS (List)
    // =========================================================================
    async listSubscriptions(query?: Record<string, unknown>): Promise<PlatformPaginated<Record<string, unknown>>> {
      const { limit, offset } = parsePagination(query)
      return listPage(
        `s.id,
         s.business_id,
         s.account_customer_id,
         s.plan_code,
         p.family AS plan_family,
         s.family_code,
         s.source,
         s.status,
         s.starts_at,
         s.ends_at,
         s.billing_cycle,
         s.final_price,
         s.currency,
         s.created_at`,
        'subscriptions s JOIN plans p ON s.plan_code = p.code',
        's.created_at DESC',
        limit,
        offset
      )
    }
  }
}
