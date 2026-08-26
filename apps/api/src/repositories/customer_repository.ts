import { PoolClient } from 'pg'
import { CustomerDto, CustomerSummaryDto, CustomerTier } from '../dto/customer_dto'

// ---------------------------------------------------------------------------
// Shared column list — includes deleted_at for sync tombstones
// ---------------------------------------------------------------------------

const CUSTOMER_COLUMNS = `
  id,
  business_id,
  name,
  phone,
  email,
  tier,
  points,
  server_version,
  created_at,
  updated_at,
  deleted_at
`

// ---------------------------------------------------------------------------
// Patch shape for update
// ---------------------------------------------------------------------------

export interface CustomerPatch {
  name?: string
  phone?: string | null
  email?: string | null
  tier?: CustomerTier
  points?: number
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const customerRepository = {
  /**
   * List active (non-deleted) customers for a tenant with offset pagination.
   * Joins sales to compute lifetime spend_minor and last_visit_epoch.
   */
  async list(
    client: PoolClient,
    businessId: string,
    limit: number,
    offset: number
  ): Promise<{ rows: CustomerDto[]; total: number }> {
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM customers
      WHERE business_id = $1
        AND deleted_at IS NULL
    `
    const countResult = await client.query(countSql, [businessId])
    const total = countResult.rows[0].total as number

    const rowSql = `
      SELECT
        c.id,
        c.business_id,
        c.name,
        c.phone,
        c.email,
        c.tier,
        c.points,
        COALESCE(s.spend_minor, 0)::bigint AS spend_minor,
        CASE WHEN s.last_visit IS NOT NULL THEN (EXTRACT(EPOCH FROM s.last_visit) * 1000)::bigint ELSE NULL END AS last_visit_epoch,
        c.server_version,
        c.created_at,
        c.updated_at,
        c.deleted_at
      FROM customers c
      LEFT JOIN (
        SELECT customer_id, SUM(total_minor) AS spend_minor, MAX(created_at) AS last_visit
        FROM sales
        WHERE business_id = $1
        GROUP BY customer_id
      ) s ON s.customer_id = c.id
      WHERE c.business_id = $1
        AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC, c.id ASC
      LIMIT $2
      OFFSET $3
    `
    const rowResult = await client.query(rowSql, [businessId, limit, offset])

    const rows: CustomerDto[] = rowResult.rows.map((r: any) => ({
      id: r.id,
      business_id: r.business_id,
      name: r.name,
      phone: r.phone ?? null,
      email: r.email ?? null,
      tier: r.tier as CustomerTier,
      points: Number(r.points || 0),
      spend_minor: Number(r.spend_minor || 0),
      last_visit_epoch: r.last_visit_epoch ? Number(r.last_visit_epoch) : null,
      server_version: Number(r.server_version),
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
      deleted_at: r.deleted_at ? (r.deleted_at instanceof Date ? r.deleted_at.toISOString() : String(r.deleted_at)) : null,
    }))

    return { rows, total }
  },

  /**
   * Find a single active customer scoped to the tenant with spend & last visit linkage.
   */
  async findById(
    client: PoolClient,
    businessId: string,
    customerId: string
  ): Promise<CustomerDto | null> {
    const sql = `
      SELECT
        c.id,
        c.business_id,
        c.name,
        c.phone,
        c.email,
        c.tier,
        c.points,
        COALESCE(s.spend_minor, 0)::bigint AS spend_minor,
        CASE WHEN s.last_visit IS NOT NULL THEN (EXTRACT(EPOCH FROM s.last_visit) * 1000)::bigint ELSE NULL END AS last_visit_epoch,
        c.server_version,
        c.created_at,
        c.updated_at,
        c.deleted_at
      FROM customers c
      LEFT JOIN (
        SELECT customer_id, SUM(total_minor) AS spend_minor, MAX(created_at) AS last_visit
        FROM sales
        WHERE business_id = $2
        GROUP BY customer_id
      ) s ON s.customer_id = c.id
      WHERE c.id = $1
        AND c.business_id = $2
        AND c.deleted_at IS NULL
    `
    const result = await client.query(sql, [customerId, businessId])
    if (result.rows.length === 0) return null

    const r = result.rows[0]
    return {
      id: r.id,
      business_id: r.business_id,
      name: r.name,
      phone: r.phone ?? null,
      email: r.email ?? null,
      tier: r.tier as CustomerTier,
      points: Number(r.points || 0),
      spend_minor: Number(r.spend_minor || 0),
      last_visit_epoch: r.last_visit_epoch ? Number(r.last_visit_epoch) : null,
      server_version: Number(r.server_version),
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
      deleted_at: r.deleted_at ? (r.deleted_at instanceof Date ? r.deleted_at.toISOString() : String(r.deleted_at)) : null,
    }
  },

  /**
   * Compute customer KPI summary: total, gold, silver, regular, and monthly spend.
   */
  async getSummary(
    client: PoolClient,
    businessId: string
  ): Promise<CustomerSummaryDto> {
    const sql = `
      WITH customer_stats AS (
        SELECT
          COUNT(*)::int AS total_customers,
          COUNT(*) FILTER (WHERE tier = 'Gold')::int AS gold_members,
          COUNT(*) FILTER (WHERE tier = 'Silver')::int AS silver_members,
          COUNT(*) FILTER (WHERE tier = 'Reguler')::int AS regular_members
        FROM customers
        WHERE business_id = $1
          AND deleted_at IS NULL
      ),
      spend_stats AS (
        SELECT
          COALESCE(SUM(total_minor), 0)::bigint AS monthly_spend_minor
        FROM sales
        WHERE business_id = $1
          AND customer_id IS NOT NULL
          AND created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta')
      )
      SELECT
        c.total_customers,
        c.gold_members,
        c.silver_members,
        c.regular_members,
        s.monthly_spend_minor
      FROM customer_stats c
      CROSS JOIN spend_stats s
    `
    const result = await client.query(sql, [businessId])
    const r = result.rows[0] || {}

    return {
      total_customers: Number(r.total_customers || 0),
      gold_members: Number(r.gold_members || 0),
      silver_members: Number(r.silver_members || 0),
      regular_members: Number(r.regular_members || 0),
      monthly_spend_minor: Number(r.monthly_spend_minor || 0),
    }
  },

  /**
   * Insert a new customer and return the persisted row.
   */
  async insert(
    client: PoolClient,
    data: {
      id: string
      business_id: string
      name: string
      phone: string | null
      email: string | null
      tier: CustomerTier
      points: number
    }
  ): Promise<CustomerDto> {
    const sql = `
      INSERT INTO customers (id, business_id, name, phone, email, tier, points, server_version, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 1, now(), now())
      RETURNING ${CUSTOMER_COLUMNS}
    `
    const result = await client.query(sql, [
      data.id,
      data.business_id,
      data.name,
      data.phone,
      data.email,
      data.tier,
      data.points,
    ])
    const r = result.rows[0]
    return {
      id: r.id,
      business_id: r.business_id,
      name: r.name,
      phone: r.phone ?? null,
      email: r.email ?? null,
      tier: r.tier as CustomerTier,
      points: Number(r.points || 0),
      spend_minor: 0,
      last_visit_epoch: null,
      server_version: Number(r.server_version),
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
      deleted_at: null,
    }
  },

  /**
   * Apply a partial patch to an active customer with optimistic locking.
   * Returns the updated row, or null if the customer does not exist / is deleted / version mismatch.
   */
  async update(
    client: PoolClient,
    businessId: string,
    customerId: string,
    expectedServerVersion: number,
    patch: CustomerPatch
  ): Promise<CustomerDto | null> {
    const setClauses: string[] = []
    const values: unknown[] = [customerId, businessId, expectedServerVersion]
    let paramIndex = 4

    if (patch.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`)
      values.push(patch.name)
    }

    if ('phone' in patch) {
      setClauses.push(`phone = $${paramIndex++}`)
      values.push(patch.phone ?? null)
    }

    if ('email' in patch) {
      setClauses.push(`email = $${paramIndex++}`)
      values.push(patch.email ?? null)
    }

    if (patch.tier !== undefined) {
      setClauses.push(`tier = $${paramIndex++}`)
      values.push(patch.tier)
    }

    if (patch.points !== undefined) {
      setClauses.push(`points = $${paramIndex++}`)
      values.push(patch.points)
    }

    // Always bump updated_at and server_version
    setClauses.push('updated_at = now()')
    setClauses.push('server_version = server_version + 1')

    const sql = `
      UPDATE customers
      SET ${setClauses.join(', ')}
      WHERE id = $1
        AND business_id = $2
        AND server_version = $3
        AND deleted_at IS NULL
      RETURNING ${CUSTOMER_COLUMNS}
    `
    const result = await client.query(sql, values)
    if (result.rows.length === 0) return null

    // Retrieve full customer with spend & last visit
    return this.findById(client, businessId, customerId)
  },

  /**
   * Soft-delete a customer by setting deleted_at = now() and incrementing server_version.
   */
  async softDelete(
    client: PoolClient,
    businessId: string,
    customerId: string
  ): Promise<CustomerDto | null> {
    const sql = `
      UPDATE customers
      SET deleted_at = now(), updated_at = now(), server_version = server_version + 1
      WHERE id = $1
        AND business_id = $2
        AND deleted_at IS NULL
      RETURNING ${CUSTOMER_COLUMNS}
    `
    const result = await client.query(sql, [customerId, businessId])
    if (result.rows.length === 0) return null

    const r = result.rows[0]
    return {
      id: r.id,
      business_id: r.business_id,
      name: r.name,
      phone: r.phone ?? null,
      email: r.email ?? null,
      tier: r.tier as CustomerTier,
      points: Number(r.points || 0),
      spend_minor: 0,
      last_visit_epoch: null,
      server_version: Number(r.server_version),
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
      deleted_at: r.deleted_at ? (r.deleted_at instanceof Date ? r.deleted_at.toISOString() : String(r.deleted_at)) : null,
    }
  },

  /**
   * Find customers for a business after a given server_version.
   * Includes soft-deleted customers (tombstones) for sync propagation.
   */
  async findByBusinessAfter(
    client: PoolClient,
    businessId: string,
    afterVersion: number,
    limit: number
  ): Promise<CustomerDto[]> {
    const sql = `
      SELECT ${CUSTOMER_COLUMNS}
      FROM customers
      WHERE business_id = $1
        AND server_version > $2
      ORDER BY server_version ASC, id ASC
      LIMIT $3
    `
    const result = await client.query(sql, [businessId, afterVersion, limit])
    return result.rows.map((r: any) => ({
      id: r.id,
      business_id: r.business_id,
      name: r.name,
      phone: r.phone ?? null,
      email: r.email ?? null,
      tier: r.tier as CustomerTier,
      points: Number(r.points || 0),
      spend_minor: 0,
      last_visit_epoch: null,
      server_version: Number(r.server_version),
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
      deleted_at: r.deleted_at ? (r.deleted_at instanceof Date ? r.deleted_at.toISOString() : String(r.deleted_at)) : null,
    }))
  },
}
