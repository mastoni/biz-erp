import { PoolClient } from 'pg'

export type ReceivableStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'REVERSED'

export interface ReceivableDto {
  id: string
  business_id: string
  sale_id: string
  customer_id: string
  branch_id: string | null
  amount_minor: number
  paid_minor: number
  outstanding_minor: number
  date: string
  reference: string | null
  description: string
  status: ReceivableStatus
  server_version: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ReceivableListFilters {
  branchId?: string
  customerId?: string
  status?: ReceivableStatus
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}

// SELECT column list (with alias prefix)
const RECEIVABLE_COLUMNS = `
  r.id,
  r.business_id,
  r.sale_id,
  r.customer_id,
  r.branch_id,
  r.amount_minor,
  r.paid_minor,
  r.outstanding_minor,
  r.date::text AS date,
  r.reference,
  r.description,
  r.status,
  r.server_version,
  r.created_at,
  r.updated_at,
  r.deleted_at
`

// RETURNING column list (no alias prefix)
const RECEIVABLE_RETURNING = `
  id,
  business_id,
  sale_id,
  customer_id,
  branch_id,
  amount_minor,
  paid_minor,
  outstanding_minor,
  date::text AS date,
  reference,
  description,
  status,
  server_version,
  created_at,
  updated_at,
  deleted_at
`

function mapRowToDto(row: any): ReceivableDto {
  return {
    id: row.id,
    business_id: row.business_id,
    sale_id: row.sale_id,
    customer_id: row.customer_id,
    branch_id: row.branch_id ?? null,
    amount_minor: Number(row.amount_minor),
    paid_minor: Number(row.paid_minor),
    outstanding_minor: Number(row.outstanding_minor),
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date),
    reference: row.reference ?? null,
    description: row.description,
    status: row.status as ReceivableStatus,
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

export const receivableRepository = {
  async create(
    client: PoolClient,
    data: {
      id: string
      business_id: string
      sale_id: string
      customer_id: string
      branch_id: string | null
      amount_minor: number
      paid_minor: number
      outstanding_minor: number
      date: string
      reference: string | null
      description: string
      status: ReceivableStatus
    }
  ): Promise<ReceivableDto> {
    const sql = `
      INSERT INTO receivables (
        id, business_id, sale_id, customer_id, branch_id,
        amount_minor, paid_minor, outstanding_minor, date, reference,
        description, status, server_version, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, now(), now())
      RETURNING ${RECEIVABLE_RETURNING}
    `
    const result = await client.query(sql, [
      data.id,
      data.business_id,
      data.sale_id,
      data.customer_id,
      data.branch_id,
      data.amount_minor,
      data.paid_minor,
      data.outstanding_minor,
      data.date,
      data.reference,
      data.description,
      data.status,
    ])
    return mapRowToDto(result.rows[0])
  },

  async findById(
    client: PoolClient,
    businessId: string,
    receivableId: string
  ): Promise<ReceivableDto | null> {
    const sql = `
      SELECT ${RECEIVABLE_COLUMNS}
      FROM receivables r
      WHERE r.id = $1
        AND r.business_id = $2
        AND r.deleted_at IS NULL
    `
    const result = await client.query(sql, [receivableId, businessId])
    if (result.rows.length === 0) return null
    return mapRowToDto(result.rows[0])
  },

  async findBySale(
    client: PoolClient,
    businessId: string,
    saleId: string
  ): Promise<ReceivableDto | null> {
    const sql = `
      SELECT ${RECEIVABLE_COLUMNS}
      FROM receivables r
      WHERE r.sale_id = $1
        AND r.business_id = $2
        AND r.deleted_at IS NULL
    `
    const result = await client.query(sql, [saleId, businessId])
    if (result.rows.length === 0) return null
    return mapRowToDto(result.rows[0])
  },

  async list(
    client: PoolClient,
    businessId: string,
    filters: ReceivableListFilters = {}
  ): Promise<{ rows: ReceivableDto[]; total: number }> {
    const limit = filters.limit ?? 50
    const offset = filters.offset ?? 0

    const conditions = ['r.business_id = $1', 'r.deleted_at IS NULL']
    const params: unknown[] = [businessId]
    let paramIndex = 2

    if (filters.branchId) {
      conditions.push(`r.branch_id = $${paramIndex++}`)
      params.push(filters.branchId)
    }
    if (filters.customerId) {
      conditions.push(`r.customer_id = $${paramIndex++}`)
      params.push(filters.customerId)
    }
    if (filters.status) {
      conditions.push(`r.status = $${paramIndex++}`)
      params.push(filters.status)
    }
    if (filters.date_from) {
      conditions.push(`r.date >= $${paramIndex++}`)
      params.push(filters.date_from)
    }
    if (filters.date_to) {
      conditions.push(`r.date <= $${paramIndex++}`)
      params.push(filters.date_to)
    }

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM receivables r
      WHERE ${conditions.join(' AND ')}
    `
    const countResult = await client.query(countSql, params)
    const total = countResult.rows[0].total as number

    const rowSql = `
      SELECT ${RECEIVABLE_COLUMNS}
      FROM receivables r
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.date DESC, r.created_at DESC, r.id DESC
      LIMIT $${paramIndex++}
      OFFSET $${paramIndex++}
    `
    const rowResult = await client.query(rowSql, [...params, limit, offset])
    return { rows: rowResult.rows.map(mapRowToDto), total }
  },

  async updateSettlement(
    client: PoolClient,
    businessId: string,
    receivableId: string,
    expectedServerVersion: number,
    paidMinor: number,
    outstandingMinor: number,
    status: ReceivableStatus
  ): Promise<ReceivableDto | null> {
    const sql = `
      UPDATE receivables r
      SET
        paid_minor = $4,
        outstanding_minor = $5,
        status = $6,
        server_version = server_version + 1,
        updated_at = now()
      WHERE r.id = $1
        AND r.business_id = $2
        AND r.server_version = $3
        AND r.deleted_at IS NULL
      RETURNING ${RECEIVABLE_RETURNING}
    `
    const result = await client.query(sql, [
      receivableId,
      businessId,
      expectedServerVersion,
      paidMinor,
      outstandingMinor,
      status,
    ])
    if (result.rows.length === 0) return null
    return mapRowToDto(result.rows[0])
  },

  async updateStatus(
    client: PoolClient,
    businessId: string,
    receivableId: string,
    expectedServerVersion: number,
    status: ReceivableStatus
  ): Promise<ReceivableDto | null> {
    const sql = `
      UPDATE receivables r
      SET
        status = $4,
        server_version = server_version + 1,
        updated_at = now()
      WHERE r.id = $1
        AND r.business_id = $2
        AND r.server_version = $3
        AND r.deleted_at IS NULL
      RETURNING ${RECEIVABLE_RETURNING}
    `
    const result = await client.query(sql, [
      receivableId,
      businessId,
      expectedServerVersion,
      status,
    ])
    if (result.rows.length === 0) return null
    return mapRowToDto(result.rows[0])
  },

  /**
   * Lock a receivable row for update (pessimistic locking).
   * Used by reversal operations to prevent concurrent modification.
   */
  async lockById(
    client: PoolClient,
    businessId: string,
    receivableId: string
  ): Promise<ReceivableDto | null> {
    const sql = `
      SELECT ${RECEIVABLE_COLUMNS}
      FROM receivables r
      WHERE r.id = $1
        AND r.business_id = $2
        AND r.deleted_at IS NULL
      FOR UPDATE
    `
    const result = await client.query(sql, [receivableId, businessId])
    if (result.rows.length === 0) return null
    return mapRowToDto(result.rows[0])
  },

  /**
   * Soft-delete a receivable (never physical DELETE).
   * Sets deleted_at and increments server_version.
   * Returns the updated row, or null if not found / version mismatch.
   */
  async softDelete(
    client: PoolClient,
    businessId: string,
    receivableId: string,
    expectedServerVersion: number
  ): Promise<ReceivableDto | null> {
    const sql = `
      UPDATE receivables r
      SET
        deleted_at = now(),
        server_version = server_version + 1,
        updated_at = now()
      WHERE r.id = $1
        AND r.business_id = $2
        AND r.server_version = $3
        AND r.deleted_at IS NULL
      RETURNING ${RECEIVABLE_RETURNING}
    `
    const result = await client.query(sql, [receivableId, businessId, expectedServerVersion])
    if (result.rows.length === 0) return null
    return mapRowToDto(result.rows[0])
  },

  /**
   * Soft-delete a receivable without optimistic locking (for admin cleanup).
   * Still never physical DELETE.
   */
  async softDeleteForce(
    client: PoolClient,
    businessId: string,
    receivableId: string
  ): Promise<ReceivableDto | null> {
    const sql = `
      UPDATE receivables r
      SET
        deleted_at = now(),
        server_version = server_version + 1,
        updated_at = now()
      WHERE r.id = $1
        AND r.business_id = $2
        AND r.deleted_at IS NULL
      RETURNING ${RECEIVABLE_RETURNING}
    `
    const result = await client.query(sql, [receivableId, businessId])
    if (result.rows.length === 0) return null
    return mapRowToDto(result.rows[0])
  },

  /**
   * Sync query: find receivables with server_version > afterVersion
   * (includes soft-deleted tombstones for sync propagation).
   */
  async findByBusinessAfter(
    client: PoolClient,
    businessId: string,
    afterVersion: number,
    limit: number
  ): Promise<ReceivableDto[]> {
    const sql = `
      SELECT ${RECEIVABLE_COLUMNS}
      FROM receivables r
      WHERE r.business_id = $1
        AND r.server_version > $2
      ORDER BY r.server_version ASC, r.id ASC
      LIMIT $3
    `
    const result = await client.query(sql, [businessId, afterVersion, limit])
    return result.rows.map(mapRowToDto)
  },
}
