import { PoolClient } from 'pg'
import { CustomerDto } from '../dto/customer_dto'

// ---------------------------------------------------------------------------
// Shared column list — includes deleted_at for sync tombstones
// ---------------------------------------------------------------------------

const CUSTOMER_COLUMNS = `
  id,
  business_id,
  name,
  phone,
  email,
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
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const customerRepository = {
  /**
   * List active (non-deleted) customers for a tenant with offset pagination.
   * Returns both the page rows and the total active count for the tenant.
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
      SELECT ${CUSTOMER_COLUMNS}
      FROM customers
      WHERE business_id = $1
        AND deleted_at IS NULL
      ORDER BY created_at ASC, id ASC
      LIMIT $2
      OFFSET $3
    `
    const rowResult = await client.query(rowSql, [businessId, limit, offset])

    return { rows: rowResult.rows as CustomerDto[], total }
  },

  /**
   * Find a single active customer scoped to the tenant.
   * Returns null when not found or soft-deleted (caller treats both as NOT_FOUND).
   */
  async findById(
    client: PoolClient,
    businessId: string,
    customerId: string
  ): Promise<CustomerDto | null> {
    const sql = `
      SELECT ${CUSTOMER_COLUMNS}
      FROM customers
      WHERE id = $1
        AND business_id = $2
        AND deleted_at IS NULL
    `
    const result = await client.query(sql, [customerId, businessId])
    return (result.rows[0] as CustomerDto | undefined) ?? null
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
    }
  ): Promise<CustomerDto> {
    const sql = `
      INSERT INTO customers (id, business_id, name, phone, email, server_version, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 1, now(), now())
      RETURNING ${CUSTOMER_COLUMNS}
    `
    const result = await client.query(sql, [
      data.id,
      data.business_id,
      data.name,
      data.phone,
      data.email,
    ])
    return result.rows[0] as CustomerDto
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
    return (result.rows[0] as CustomerDto | undefined) ?? null
  },

  /**
   * Soft-delete a customer by setting deleted_at = now() and incrementing server_version.
   * Returns the deleted customer row (for sync), or null if not found / already deleted.
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
    return (result.rows[0] as CustomerDto | undefined) ?? null
  },

  /**
   * Find customers for a business after a given server_version.
   * Includes soft-deleted customers (tombstones) for sync propagation.
   * Used for cursor-based incremental sync.
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
    return result.rows as CustomerDto[]
  },
}
