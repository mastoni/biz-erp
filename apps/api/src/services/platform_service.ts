import { Pool } from 'pg'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'
import { isUuid } from '../utils/uuid'

export interface PlatformPaginated<T> {
  items: T[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export interface BusinessListSummary {
  pending_count: number
  active_count: number
  suspended_count: number
  rejected_count: number
  total: number
}

export interface PlatformBusinessesResponse extends PlatformPaginated<Record<string, unknown>> {
  summary: BusinessListSummary
}

export interface PlatformContext {
  scope: 'platform'
  role: 'PLATFORM_ADMIN' | 'SUPER_ADMIN'
  userId: string
}

// Parse and validate pagination. Defaults: limit=50, offset=0.
// Max limit is 200 (per the platform API contract). Invalid values
// (non-integer, out-of-range) reject with 400 VALIDATION_ERROR.
function parsePagination(query?: Record<string, unknown>): { limit: number; offset: number } {
  const q = query ?? {}
  let limit = 50
  let offset = 0

  if (q.limit !== undefined) {
    const n = Number(q.limit)
    if (!Number.isInteger(n) || n < 1 || n > 200) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'limit must be an integer between 1 and 200')
    }
    limit = n
  }

  if (q.offset !== undefined) {
    const n = Number(q.offset)
    if (!Number.isInteger(n) || n < 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'offset must be a non-negative integer')
    }
    offset = n
  }

  return { limit, offset }
}

export function createPlatformService(pool: Pool) {
  // Generic platform-wide paged reader over a canonical entity. `columns` and
  // `from` are HARD-CODED constants from this module (never request input), so
  // string interpolation here is safe from SQL injection.
  async function listPage<T>(
    columns: string,
    from: string,
    orderBy: string,
    limit: number,
    offset: number
  ): Promise<PlatformPaginated<T>> {
    const data = await pool.query(
      `SELECT ${columns} FROM ${from} ORDER BY ${orderBy} LIMIT $1 OFFSET $2`,
      [limit, offset]
    )
    const countRes = await pool.query(`SELECT COUNT(*)::bigint AS count FROM ${from}`)
    const total = Number(countRes.rows[0].count)

    return {
      items: data.rows as T[],
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
      const summaryRow = summaryRes.rows[0]
      const summary: BusinessListSummary = {
        pending_count: Number(summaryRow.pending_count) || 0,
        active_count: Number(summaryRow.active_count) || 0,
        suspended_count: Number(summaryRow.suspended_count) || 0,
        rejected_count: Number(summaryRow.rejected_count) || 0,
        total: Number(summaryRow.total) || 0
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
          b.rejected_by,
          rej.email AS rejector_email,
          b.suspended_reason,
          b.suspended_at,
          b.suspended_by,
          susp.email AS suspender_email,
          b.reactivated_at,
          b.reactivated_by,
          react.email AS reactivator_email,
          b.created_at,
          b.updated_at,
          (SELECT COUNT(*)::int FROM branches WHERE business_id = b.id) AS branch_count,
          (SELECT COUNT(*)::int FROM subscriptions WHERE business_id = b.id AND status = 'ACTIVE') AS active_subscription_count,
          (SELECT COUNT(*)::int FROM user_businesses WHERE business_id = b.id AND status = 'ACTIVE') AS user_count
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

      const bizRes = await pool.query('SELECT id, status, name FROM businesses WHERE id = $1', [id])
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
      const res = await pool.query(updateSql, [actorUserId, id])
      return res.rows[0]
    },

    async rejectBusiness(id: string, actorUserId: string, reason: string): Promise<Record<string, unknown>> {
      if (!isUuid(id)) {
        throw new ValidationError('Invalid business id format')
      }
      if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        throw new ValidationError('Rejection reason is required')
      }

      const bizRes = await pool.query('SELECT id, status, name FROM businesses WHERE id = $1', [id])
      if (bizRes.rows.length === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Business not found')
      }

      const currentStatus = bizRes.rows[0].status || 'ACTIVE'
      if (currentStatus === 'ACTIVE') {
        throw new ApiError(400, 'INVALID_STATE_TRANSITION', 'Cannot reject an active business. Use suspend instead.')
      }
      if (currentStatus !== 'PENDING_REVIEW') {
        throw new ApiError(400, 'INVALID_STATE_TRANSITION', `Cannot reject business with status '${currentStatus}'`)
      }

      const updateSql = `
        UPDATE businesses
        SET
          status = 'REJECTED',
          rejected_by = $1,
          rejected_at = now(),
          rejected_reason = $2,
          updated_at = now()
        WHERE id = $3
        RETURNING id, name, status, rejected_at, rejected_by, rejected_reason, updated_at
      `
      const res = await pool.query(updateSql, [actorUserId, reason.trim(), id])
      return res.rows[0]
    },

    async suspendBusiness(id: string, actorUserId: string, reason: string): Promise<Record<string, unknown>> {
      if (!isUuid(id)) {
        throw new ValidationError('Invalid business id format')
      }
      if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        throw new ValidationError('Suspension reason is required')
      }

      const bizRes = await pool.query('SELECT id, status, name FROM businesses WHERE id = $1', [id])
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
          suspended_by = $1,
          suspended_at = now(),
          suspended_reason = $2,
          updated_at = now()
        WHERE id = $3
        RETURNING id, name, status, suspended_at, suspended_by, suspended_reason, updated_at
      `
      const res = await pool.query(updateSql, [actorUserId, reason.trim(), id])
      return res.rows[0]
    },

    async reactivateBusiness(id: string, actorUserId: string): Promise<Record<string, unknown>> {
      if (!isUuid(id)) {
        throw new ValidationError('Invalid business id format')
      }

      const bizRes = await pool.query('SELECT id, status, name FROM businesses WHERE id = $1', [id])
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
      const res = await pool.query(updateSql, [actorUserId, id])
      return res.rows[0]
    },

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

    async listPlans(query?: Record<string, unknown>): Promise<PlatformPaginated<Record<string, unknown>>> {
      const { limit, offset } = parsePagination(query)
      return listPage(
        'code, name, family, tier, billing_cycle, type, status, created_at, updated_at',
        'plans',
        'created_at DESC',
        limit,
        offset
      )
    },

    async listBundles(query?: Record<string, unknown>): Promise<PlatformPaginated<Record<string, unknown>>> {
      const { limit, offset } = parsePagination(query)
      return listPage(
        'code, name, target_segment, installation_required, status, created_at, updated_at',
        'bundles',
        'created_at DESC',
        limit,
        offset
      )
    },

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
