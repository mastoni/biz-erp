import { PoolClient } from 'pg'
import { SupplierDto, SupplierSummaryDto, SupplierTerm, SupplierStatus } from '../dto/supplier_dto'

// ---------------------------------------------------------------------------
// Shared column list — includes deleted_at for sync tombstones
// ---------------------------------------------------------------------------

const SUPPLIER_COLUMNS = `
  id,
  business_id,
  code,
  name,
  contact,
  phone,
  email,
  category,
  term,
  status,
  server_version,
  created_at,
  updated_at,
  deleted_at
`

// ---------------------------------------------------------------------------
// Patch shape for update
// ---------------------------------------------------------------------------

export interface SupplierPatch {
  name?: string
  contact?: string | null
  phone?: string | null
  email?: string | null
  category?: string | null
  term?: SupplierTerm
  status?: SupplierStatus
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function mapRowToDto(row: any): SupplierDto {
  return {
    id: row.id,
    business_id: row.business_id,
    code: row.code,
    name: row.name,
    contact: row.contact ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    category: row.category ?? null,
    term: row.term as SupplierTerm,
    status: row.status as SupplierStatus,
    server_version: Number(row.server_version),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    deleted_at: row.deleted_at ? (row.deleted_at instanceof Date ? row.deleted_at.toISOString() : String(row.deleted_at)) : null,
  }
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const supplierRepository = {
  /**
   * List active (non-deleted) suppliers for a tenant with offset pagination.
   */
  async list(
    client: PoolClient,
    businessId: string,
    limit: number,
    offset: number
  ): Promise<{ rows: SupplierDto[]; total: number }> {
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM suppliers
      WHERE business_id = $1
        AND deleted_at IS NULL
    `
    const countResult = await client.query(countSql, [businessId])
    const total = countResult.rows[0].total as number

    const rowSql = `
      SELECT ${SUPPLIER_COLUMNS}
      FROM suppliers
      WHERE business_id = $1
        AND deleted_at IS NULL
      ORDER BY name ASC, id ASC
      LIMIT $2
      OFFSET $3
    `
    const rowResult = await client.query(rowSql, [businessId, limit, offset])

    const rows: SupplierDto[] = rowResult.rows.map(mapRowToDto)

    return { rows, total }
  },

  /**
   * Compute supplier KPI summary: total, active, inactive.
   */
  async getSummary(
    client: PoolClient,
    businessId: string
  ): Promise<SupplierSummaryDto> {
    const sql = `
      SELECT
        COUNT(*)::int AS total_suppliers,
        COUNT(*) FILTER (WHERE status = 'aktif')::int AS active_suppliers,
        COUNT(*) FILTER (WHERE status = 'nonaktif')::int AS inactive_suppliers
      FROM suppliers
      WHERE business_id = $1
        AND deleted_at IS NULL
    `

    const result = await client.query(sql, [businessId])
    const r = result.rows[0] || {}

    return {
      total_suppliers: Number(r.total_suppliers || 0),
      active_suppliers: Number(r.active_suppliers || 0),
      inactive_suppliers: Number(r.inactive_suppliers || 0),
    }
  },

  /**
   * Find a single active supplier scoped to the tenant.
   */
  async findById(
    client: PoolClient,
    businessId: string,
    supplierId: string
  ): Promise<SupplierDto | null> {
    const sql = `
      SELECT ${SUPPLIER_COLUMNS}
      FROM suppliers
      WHERE id = $1
        AND business_id = $2
        AND deleted_at IS NULL
    `
    const result = await client.query(sql, [supplierId, businessId])
    if (result.rows.length === 0) return null
    return mapRowToDto(result.rows[0])
  },

  /**
   * Check if a supplier code already exists for the given business.
   */
  async findByCode(
    client: PoolClient,
    businessId: string,
    code: string
  ): Promise<SupplierDto | null> {
    const sql = `
      SELECT ${SUPPLIER_COLUMNS}
      FROM suppliers
      WHERE business_id = $1
        AND code = $2
        AND deleted_at IS NULL
    `
    const result = await client.query(sql, [businessId, code])
    if (result.rows.length === 0) return null
    return mapRowToDto(result.rows[0])
  },

  /**
   * Insert a new supplier and return the persisted row.
   */
  async insert(
    client: PoolClient,
    data: {
      id: string
      business_id: string
      code: string
      name: string
      contact: string | null
      phone: string | null
      email: string | null
      category: string | null
      term: SupplierTerm
      status: SupplierStatus
    }
  ): Promise<SupplierDto> {
    const sql = `
      INSERT INTO suppliers (
        id, business_id, code, name, contact, phone, email,
        category, term, status, server_version, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, now(), now())
      RETURNING ${SUPPLIER_COLUMNS}
    `
    const result = await client.query(sql, [
      data.id,
      data.business_id,
      data.code,
      data.name,
      data.contact,
      data.phone,
      data.email,
      data.category,
      data.term,
      data.status,
    ])
    return mapRowToDto(result.rows[0])
  },

  /**
   * Apply a partial patch to an active supplier with optimistic locking.
   * Returns the updated row, or null if the supplier does not exist / is deleted / version mismatch.
   */
  async update(
    client: PoolClient,
    businessId: string,
    supplierId: string,
    expectedServerVersion: number,
    patch: SupplierPatch
  ): Promise<SupplierDto | null> {
    const setClauses: string[] = []
    const values: unknown[] = [supplierId, businessId, expectedServerVersion]
    let paramIndex = 4

    if (patch.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`)
      values.push(patch.name)
    }

    if ('contact' in patch) {
      setClauses.push(`contact = $${paramIndex++}`)
      values.push(patch.contact ?? null)
    }

    if ('phone' in patch) {
      setClauses.push(`phone = $${paramIndex++}`)
      values.push(patch.phone ?? null)
    }

    if ('email' in patch) {
      setClauses.push(`email = $${paramIndex++}`)
      values.push(patch.email ?? null)
    }

    if ('category' in patch) {
      setClauses.push(`category = $${paramIndex++}`)
      values.push(patch.category ?? null)
    }

    if (patch.term !== undefined) {
      setClauses.push(`term = $${paramIndex++}`)
      values.push(patch.term)
    }

    if ('status' in patch) {
      setClauses.push(`status = $${paramIndex++}`)
      values.push(patch.status)
    }

    // Always bump updated_at and server_version
    setClauses.push('updated_at = now()')
    setClauses.push('server_version = server_version + 1')

    const sql = `
      UPDATE suppliers
      SET ${setClauses.join(', ')}
      WHERE id = $1
        AND business_id = $2
        AND server_version = $3
        AND deleted_at IS NULL
      RETURNING ${SUPPLIER_COLUMNS}
    `
    const result = await client.query(sql, values)
    if (result.rows.length === 0) return null

    return mapRowToDto(result.rows[0])
  },

  /**
   * Soft-delete a supplier by setting deleted_at = now() and status = 'nonaktif'.
   * Increments server_version for sync propagation.
   */
  async softDelete(
    client: PoolClient,
    businessId: string,
    supplierId: string
  ): Promise<SupplierDto | null> {
    const sql = `
      UPDATE suppliers
      SET deleted_at = now(), status = 'nonaktif', updated_at = now(), server_version = server_version + 1
      WHERE id = $1
        AND business_id = $2
        AND deleted_at IS NULL
      RETURNING ${SUPPLIER_COLUMNS}
    `
    const result = await client.query(sql, [supplierId, businessId])
    if (result.rows.length === 0) return null
    return mapRowToDto(result.rows[0])
  },

  /**
   * Find suppliers for a business after a given server_version.
   * Includes soft-deleted suppliers (tombstones) for sync propagation.
   */
  async findByBusinessAfter(
    client: PoolClient,
    businessId: string,
    afterVersion: number,
    limit: number
  ): Promise<SupplierDto[]> {
    const sql = `
      SELECT ${SUPPLIER_COLUMNS}
      FROM suppliers
      WHERE business_id = $1
        AND server_version > $2
      ORDER BY server_version ASC, id ASC
      LIMIT $3
    `
    const result = await client.query(sql, [businessId, afterVersion, limit])
    return result.rows.map(mapRowToDto)
  },
}
