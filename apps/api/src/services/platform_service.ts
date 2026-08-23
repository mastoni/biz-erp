import { Pool } from 'pg'
import { ApiError } from '../errors/api_error'

export interface PlatformPaginated<T> {
  items: T[]
  total: number
  limit: number
  offset: number
  has_more: boolean
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

    async listBusinesses(query?: Record<string, unknown>): Promise<PlatformPaginated<Record<string, unknown>>> {
      const { limit, offset } = parsePagination(query)
      return listPage('id, name, created_at', 'businesses', 'created_at DESC', limit, offset)
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
