import { PoolClient } from 'pg'

export type IncomeMethod = 'cash' | 'bank_transfer' | 'debit' | 'credit'
export type IncomeStatus = 'draft' | 'posted' | 'reversed'

export interface IncomeDto {
  id: string
  business_id: string
  branch_id: string | null
  date: string
  amount_minor: number
  method: IncomeMethod
  category: string | null
  reference: string | null
  description: string
  status: IncomeStatus
  server_version: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface IncomePatch {
  branch_id?: string | null
  date?: string
  amount_minor?: number
  method?: IncomeMethod
  category?: string | null
  reference?: string | null
  description?: string
  status?: IncomeStatus
}

export interface IncomeListFilters {
  branchId?: string
  status?: IncomeStatus
  category?: string
  date_from?: string
  date_to?: string
  search?: string
  limit?: number
  offset?: number
}

// ---------------------------------------------------------------------------
// Shared column list (includes deleted_at for soft-delete awareness)
// ---------------------------------------------------------------------------

const INCOME_COLUMNS = `
  id,
  business_id,
  branch_id,
  date::text AS date,
  amount_minor,
  method,
  category,
  reference,
  description,
  status,
  server_version,
  created_at,
  updated_at,
  deleted_at
`

function mapRowToDto(row: any): IncomeDto {
  return {
    id: row.id,
    business_id: row.business_id,
    branch_id: row.branch_id ?? null,
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date),
    amount_minor: Number(row.amount_minor),
    method: row.method as IncomeMethod,
    category: row.category ?? null,
    reference: row.reference ?? null,
    description: row.description,
    status: row.status as IncomeStatus,
    server_version: Number(row.server_version),
    created_at:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    deleted_at: row.deleted_at
      ? row.deleted_at instanceof Date
        ? row.deleted_at.toISOString()
        : String(row.deleted_at)
      : null,
  }
}

export const incomeRepository = {
  /**
   * Insert a new Income as a draft. business_id is supplied by the caller
   * (the authenticated tenant); the repository never derives or overrides it.
   */
  async create(
    client: PoolClient,
    data: {
      id: string
      business_id: string
      branch_id: string | null
      date: string
      amount_minor: number
      method: IncomeMethod
      category: string | null
      reference: string | null
      description: string
    }
  ): Promise<IncomeDto> {
    const sql = `
      INSERT INTO incomes (
        id, business_id, branch_id, date, amount_minor, method,
        category, reference, description, status, server_version, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', 1, now(), now())
      RETURNING ${INCOME_COLUMNS}
    `
    const result = await client.query(sql, [
      data.id,
      data.business_id,
      data.branch_id,
      data.date,
      data.amount_minor,
      data.method,
      data.category,
      data.reference,
      data.description,
    ])
    return mapRowToDto(result.rows[0])
  },

  /**
   * Find a single Income scoped to the tenant. Soft-deleted rows are excluded.
   * Returns null when not found or when it belongs to another tenant.
   */
  async findById(
    client: PoolClient,
    businessId: string,
    incomeId: string
  ): Promise<IncomeDto | null> {
    const sql = `
      SELECT ${INCOME_COLUMNS}
      FROM incomes
      WHERE id = $1
        AND business_id = $2
        AND deleted_at IS NULL
    `
    const result = await client.query(sql, [incomeId, businessId])
    if (result.rows.length === 0) return null
    return mapRowToDto(result.rows[0])
  },

  /**
   * List Incomes for a tenant with optional filters and parameterized pagination.
   * Default scope excludes soft-deleted rows. No runtime values are interpolated
   * into the SQL string; only parameter indices are.
   */
  async list(
    client: PoolClient,
    businessId: string,
    filters: IncomeListFilters = {}
  ): Promise<{ rows: IncomeDto[]; total: number }> {
    const limit = filters.limit ?? 50
    const offset = filters.offset ?? 0

    const conditions = ['i.business_id = $1', 'i.deleted_at IS NULL']
    const params: unknown[] = [businessId]
    let paramIndex = 2

    if (filters.branchId) {
      conditions.push(`i.branch_id = $${paramIndex++}`)
      params.push(filters.branchId)
    }
    if (filters.status) {
      conditions.push(`i.status = $${paramIndex++}`)
      params.push(filters.status)
    }
    if (filters.category) {
      conditions.push(`i.category = $${paramIndex++}`)
      params.push(filters.category)
    }
    if (filters.date_from) {
      conditions.push(`i.date >= $${paramIndex++}`)
      params.push(filters.date_from)
    }
    if (filters.date_to) {
      conditions.push(`i.date <= $${paramIndex++}`)
      params.push(filters.date_to)
    }
    if (filters.search) {
      const pattern = `%${filters.search}%`
      conditions.push(
        `(i.reference ILIKE $${paramIndex} OR i.description ILIKE $${paramIndex} OR i.category ILIKE $${paramIndex})`
      )
      params.push(pattern)
      paramIndex++
    }

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM incomes i
      WHERE ${conditions.join(' AND ')}
    `
    const countResult = await client.query(countSql, params)
    const total = countResult.rows[0].total as number

    const rowSql = `
      SELECT ${INCOME_COLUMNS}
      FROM incomes i
      WHERE ${conditions.join(' AND ')}
      ORDER BY i.date DESC, i.created_at DESC, i.id DESC
      LIMIT $${paramIndex++}
      OFFSET $${paramIndex++}
    `
    const rowResult = await client.query(rowSql, [...params, limit, offset])
    return { rows: rowResult.rows.map(mapRowToDto), total }
  },

  /**
   * Apply a partial patch to a DRAFT Income with optimistic locking.
   * Returns the updated row, or null if the income does not exist / is not a
   * draft / is soft-deleted / version mismatch. business_id is never mutated.
   */
  async updateDraft(
    client: PoolClient,
    businessId: string,
    incomeId: string,
    expectedServerVersion: number,
    patch: IncomePatch
  ): Promise<IncomeDto | null> {
    const setClauses: string[] = []
    const values: unknown[] = [incomeId, businessId, expectedServerVersion]
    let paramIndex = 4

    if (patch.branch_id !== undefined) {
      setClauses.push(`branch_id = $${paramIndex++}`)
      values.push(patch.branch_id)
    }
    if (patch.date !== undefined) {
      setClauses.push(`date = $${paramIndex++}`)
      values.push(patch.date)
    }
    if (patch.amount_minor !== undefined) {
      setClauses.push(`amount_minor = $${paramIndex++}`)
      values.push(patch.amount_minor)
    }
    if (patch.method !== undefined) {
      setClauses.push(`method = $${paramIndex++}`)
      values.push(patch.method)
    }
    if (patch.category !== undefined) {
      setClauses.push(`category = $${paramIndex++}`)
      values.push(patch.category)
    }
    if (patch.reference !== undefined) {
      setClauses.push(`reference = $${paramIndex++}`)
      values.push(patch.reference)
    }
    if (patch.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`)
      values.push(patch.description)
    }
    if (patch.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`)
      values.push(patch.status)
    }

    setClauses.push('updated_at = now()')
    setClauses.push('server_version = server_version + 1')

    const sql = `
      UPDATE incomes
      SET ${setClauses.join(', ')}
      WHERE id = $1
        AND business_id = $2
        AND server_version = $3
        AND status = 'draft'
        AND deleted_at IS NULL
      RETURNING ${INCOME_COLUMNS}
    `
    const result = await client.query(sql, values)
    if (result.rows.length === 0) return null
    return mapRowToDto(result.rows[0])
  },

  /**
   * Soft-delete a DRAFT Income (never physical DELETE).
   * Returns the updated row, or null if not a draft / not found / already deleted.
   */
  async softDeleteDraft(
    client: PoolClient,
    businessId: string,
    incomeId: string
  ): Promise<IncomeDto | null> {
    const sql = `
      UPDATE incomes
      SET deleted_at = now(), updated_at = now(), server_version = server_version + 1
      WHERE id = $1
        AND business_id = $2
        AND status = 'draft'
        AND deleted_at IS NULL
      RETURNING ${INCOME_COLUMNS}
    `
    const result = await client.query(sql, [incomeId, businessId])
    if (result.rows.length === 0) return null
    return mapRowToDto(result.rows[0])
  },

  /**
   * Sync query: find Incomes with server_version > afterVersion (includes
   * soft-deleted tombstones for sync propagation).
   */
  async findByBusinessAfter(
    client: PoolClient,
    businessId: string,
    afterVersion: number,
    limit: number
  ): Promise<IncomeDto[]> {
    const sql = `
      SELECT ${INCOME_COLUMNS}
      FROM incomes
      WHERE business_id = $1
        AND server_version > $2
      ORDER BY server_version ASC, id ASC
      LIMIT $3
    `
    const result = await client.query(sql, [businessId, afterVersion, limit])
    return result.rows.map(mapRowToDto)
  },
}
