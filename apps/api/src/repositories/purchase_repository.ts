import { PoolClient } from 'pg'
import {
  PurchaseDto,
  PurchaseItemDto,
  PurchasePaymentDto,
  PurchaseSummaryDto,
  PurchaseStatus,
  SupplierTerm,
  PaymentMethod,
} from '../dto/purchase_dto'

// ---------------------------------------------------------------------------
// Column selectors
// ---------------------------------------------------------------------------

const PURCHASE_COLUMNS = `
  p.id,
  p.business_id,
  p.branch_id,
  p.supplier_id,
  p.code,
  p.date::text,
  p.due_date::text,
  p.supplier_term,
  p.status,
  p.total_minor,
  p.paid_minor,
  p.outstanding_minor,
  p.received_minor,
  p.note,
  p.server_version,
  p.created_at,
  p.updated_at,
  p.deleted_at
`

const PURCHASE_RETURNING_COLUMNS = `
  id,
  business_id,
  branch_id,
  supplier_id,
  code,
  date::text,
  due_date::text,
  supplier_term,
  status,
  total_minor,
  paid_minor,
  outstanding_minor,
  received_minor,
  note,
  server_version,
  created_at,
  updated_at,
  deleted_at
`

const PURCHASE_ITEM_COLUMNS = `
  id,
  purchase_id,
  product_id,
  product_name,
  ordered_qty,
  received_qty,
  unit_cost_minor,
  subtotal_minor
`

const PURCHASE_PAYMENT_COLUMNS = `
  id,
  business_id,
  purchase_id,
  amount_minor,
  method,
  reference,
  idempotency_key,
  created_at
`

// ---------------------------------------------------------------------------
// Row Mappers
// ---------------------------------------------------------------------------

export function mapRowToPurchaseDto(row: any): PurchaseDto {
  return {
    id: row.id,
    business_id: row.business_id,
    branch_id: row.branch_id,
    supplier_id: row.supplier_id,
    code: row.code,
    date: row.date,
    due_date: row.due_date,
    supplier_term: row.supplier_term as SupplierTerm,
    status: row.status as PurchaseStatus,
    total_minor: Number(row.total_minor),
    paid_minor: Number(row.paid_minor),
    outstanding_minor: Number(row.outstanding_minor),
    received_minor: Number(row.received_minor),
    note: row.note ?? null,
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
    supplier_name: row.supplier_name ?? undefined,
    branch_name: row.branch_name ?? undefined,
  }
}

export function mapRowToPurchaseItemDto(row: any): PurchaseItemDto {
  return {
    id: row.id,
    purchase_id: row.purchase_id,
    product_id: row.product_id ?? null,
    product_name: row.product_name,
    ordered_qty: Number(row.ordered_qty),
    received_qty: Number(row.received_qty),
    unit_cost_minor: Number(row.unit_cost_minor),
    subtotal_minor: Number(row.subtotal_minor),
  }
}

export function mapRowToPurchasePaymentDto(row: any): PurchasePaymentDto {
  return {
    id: row.id,
    business_id: row.business_id,
    purchase_id: row.purchase_id,
    amount_minor: Number(row.amount_minor),
    method: row.method as PaymentMethod,
    reference: row.reference ?? null,
    idempotency_key: row.idempotency_key,
    created_at:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const purchaseRepository = {
  /**
   * Acquire tenant-scoped advisory transaction lock for purchase code sequence.
   */
  async lockCodeSequence(client: PoolClient, businessId: string): Promise<void> {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('purchase_code:' || $1))`, [
      businessId,
    ])
  },

  /**
   * Get the next sequence number for a supplier's POs within a tenant.
   * Matches codes like '{supplierCode}/PO/%'.
   */
  async getNextCodeSequence(
    client: PoolClient,
    businessId: string,
    supplierCode: string
  ): Promise<number> {
    const pattern = `${supplierCode.trim().toUpperCase()}/PO/%`
    const sql = `
      SELECT code
      FROM purchases
      WHERE business_id = $1
        AND code LIKE $2
      ORDER BY id DESC
    `
    const result = await client.query(sql, [businessId, pattern])

    let maxSeq = 0
    for (const row of result.rows) {
      const parts = String(row.code).split('/PO/')
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10)
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num
        }
      }
    }

    return maxSeq + 1
  },

  /**
   * List purchases for a tenant with optional filtering and pagination.
   */
  async list(
    client: PoolClient,
    businessId: string,
    options: {
      branchId?: string
      supplierId?: string
      status?: PurchaseStatus
      limit: number
      offset: number
    }
  ): Promise<{ rows: PurchaseDto[]; total: number }> {
    const conditions: string[] = ['p.business_id = $1', 'p.deleted_at IS NULL']
    const params: any[] = [businessId]
    let paramIndex = 2

    if (options.branchId) {
      conditions.push(`p.branch_id = $${paramIndex++}`)
      params.push(options.branchId)
    }

    if (options.supplierId) {
      conditions.push(`p.supplier_id = $${paramIndex++}`)
      params.push(options.supplierId)
    }

    if (options.status) {
      conditions.push(`p.status = $${paramIndex++}`)
      params.push(options.status)
    }

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM purchases p
      WHERE ${conditions.join(' AND ')}
    `
    const countResult = await client.query(countSql, params)
    const total = countResult.rows[0].total as number

    const rowSql = `
      SELECT
        ${PURCHASE_COLUMNS},
        s.name AS supplier_name,
        b.name AS branch_name
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN branches b ON b.id = p.branch_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.date DESC, p.created_at DESC, p.id DESC
      LIMIT $${paramIndex++}
      OFFSET $${paramIndex++}
    `
    const rowResult = await client.query(rowSql, [...params, options.limit, options.offset])
    const rows = rowResult.rows.map(mapRowToPurchaseDto)

    return { rows, total }
  },

  /**
   * Calculate KPI summary for purchases.
   */
  async getSummary(
    client: PoolClient,
    businessId: string,
    options?: { branchId?: string; supplierId?: string }
  ): Promise<PurchaseSummaryDto> {
    const conditions: string[] = ['p.business_id = $1', 'p.deleted_at IS NULL']
    const params: any[] = [businessId]
    let paramIndex = 2

    if (options?.branchId) {
      conditions.push(`p.branch_id = $${paramIndex++}`)
      params.push(options.branchId)
    }

    if (options?.supplierId) {
      conditions.push(`p.supplier_id = $${paramIndex++}`)
      params.push(options.supplierId)
    }

    const sql = `
      SELECT
        COUNT(*)::int AS total_purchases,
        COUNT(*) FILTER (WHERE p.status = 'draft')::int AS draft_count,
        COUNT(*) FILTER (WHERE p.status = 'sent')::int AS sent_count,
        COUNT(*) FILTER (WHERE p.status = 'partial')::int AS partial_count,
        COUNT(*) FILTER (WHERE p.status = 'received')::int AS received_count,
        COUNT(*) FILTER (WHERE p.status = 'cancelled')::int AS cancelled_count,
        COALESCE(SUM(p.total_minor) FILTER (WHERE p.status != 'cancelled'), 0)::bigint AS total_value_minor,
        COALESCE(SUM(p.paid_minor) FILTER (WHERE p.status != 'cancelled'), 0)::bigint AS total_paid_minor,
        COALESCE(SUM(p.outstanding_minor) FILTER (WHERE p.status != 'cancelled'), 0)::bigint AS total_outstanding_minor
      FROM purchases p
      WHERE ${conditions.join(' AND ')}
    `
    const result = await client.query(sql, params)
    const r = result.rows[0] || {}

    return {
      total_purchases: Number(r.total_purchases || 0),
      draft_count: Number(r.draft_count || 0),
      sent_count: Number(r.sent_count || 0),
      partial_count: Number(r.partial_count || 0),
      received_count: Number(r.received_count || 0),
      cancelled_count: Number(r.cancelled_count || 0),
      total_value_minor: Number(r.total_value_minor || 0),
      total_paid_minor: Number(r.total_paid_minor || 0),
      total_outstanding_minor: Number(r.total_outstanding_minor || 0),
    }
  },

  /**
   * Find purchase by ID (including items and payments).
   */
  async findById(
    client: PoolClient,
    businessId: string,
    purchaseId: string
  ): Promise<PurchaseDto | null> {
    const sql = `
      SELECT
        ${PURCHASE_COLUMNS},
        s.name AS supplier_name,
        b.name AS branch_name
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN branches b ON b.id = p.branch_id
      WHERE p.id = $1
        AND p.business_id = $2
        AND p.deleted_at IS NULL
    `
    const result = await client.query(sql, [purchaseId, businessId])
    if (result.rows.length === 0) return null

    const po = mapRowToPurchaseDto(result.rows[0])
    po.items = await this.getItems(client, purchaseId)
    po.payments = await this.getPayments(client, businessId, purchaseId)

    return po
  },

  /**
   * Find purchase by ID with FOR UPDATE lock inside transaction.
   */
  async findByIdForUpdate(
    client: PoolClient,
    businessId: string,
    purchaseId: string
  ): Promise<PurchaseDto | null> {
    const sql = `
      SELECT
        ${PURCHASE_COLUMNS},
        s.name AS supplier_name,
        b.name AS branch_name
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN branches b ON b.id = p.branch_id
      WHERE p.id = $1
        AND p.business_id = $2
        AND p.deleted_at IS NULL
      FOR UPDATE OF p
    `
    const result = await client.query(sql, [purchaseId, businessId])
    if (result.rows.length === 0) return null

    const po = mapRowToPurchaseDto(result.rows[0])
    po.items = await this.getItems(client, purchaseId)
    po.payments = await this.getPayments(client, businessId, purchaseId)

    return po
  },

  /**
   * Find purchase by code within a tenant.
   */
  async findByCode(
    client: PoolClient,
    businessId: string,
    code: string
  ): Promise<PurchaseDto | null> {
    const sql = `
      SELECT ${PURCHASE_COLUMNS}
      FROM purchases p
      WHERE p.business_id = $1
        AND p.code = $2
        AND p.deleted_at IS NULL
    `
    const result = await client.query(sql, [businessId, code])
    if (result.rows.length === 0) return null
    return mapRowToPurchaseDto(result.rows[0])
  },

  /**
   * Insert a new purchase record.
   */
  async insertPurchase(
    client: PoolClient,
    data: {
      id: string
      business_id: string
      branch_id: string
      supplier_id: string
      code: string
      date: string
      due_date: string
      supplier_term: SupplierTerm
      status: PurchaseStatus
      total_minor: number
      paid_minor: number
      outstanding_minor: number
      received_minor: number
      note: string | null
    }
  ): Promise<PurchaseDto> {
    const sql = `
      INSERT INTO purchases (
        id, business_id, branch_id, supplier_id, code,
        date, due_date, supplier_term, status, total_minor,
        paid_minor, outstanding_minor, received_minor, note,
        server_version, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 1, now(), now())
      RETURNING ${PURCHASE_RETURNING_COLUMNS}
    `
    const result = await client.query(sql, [
      data.id,
      data.business_id,
      data.branch_id,
      data.supplier_id,
      data.code,
      data.date,
      data.due_date,
      data.supplier_term,
      data.status,
      data.total_minor,
      data.paid_minor,
      data.outstanding_minor,
      data.received_minor,
      data.note,
    ])
    return mapRowToPurchaseDto(result.rows[0])
  },

  /**
   * Insert purchase items in batch.
   */
  async insertPurchaseItems(
    client: PoolClient,
    items: {
      id: string
      purchase_id: string
      product_id: string | null
      product_name: string
      ordered_qty: number
      received_qty: number
      unit_cost_minor: number
      subtotal_minor: number
    }[]
  ): Promise<PurchaseItemDto[]> {
    if (items.length === 0) return []

    const inserted: PurchaseItemDto[] = []
    for (const it of items) {
      const sql = `
        INSERT INTO purchase_items (
          id, purchase_id, product_id, product_name,
          ordered_qty, received_qty, unit_cost_minor, subtotal_minor
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING ${PURCHASE_ITEM_COLUMNS}
      `
      const res = await client.query(sql, [
        it.id,
        it.purchase_id,
        it.product_id,
        it.product_name,
        it.ordered_qty,
        it.received_qty,
        it.unit_cost_minor,
        it.subtotal_minor,
      ])
      inserted.push(mapRowToPurchaseItemDto(res.rows[0]))
    }
    return inserted
  },

  /**
   * Get items for a purchase order.
   */
  async getItems(client: PoolClient, purchaseId: string): Promise<PurchaseItemDto[]> {
    const sql = `
      SELECT ${PURCHASE_ITEM_COLUMNS}
      FROM purchase_items
      WHERE purchase_id = $1
      ORDER BY id ASC
    `
    const result = await client.query(sql, [purchaseId])
    return result.rows.map(mapRowToPurchaseItemDto)
  },

  /**
   * Get payments for a purchase order.
   */
  async getPayments(
    client: PoolClient,
    businessId: string,
    purchaseId: string
  ): Promise<PurchasePaymentDto[]> {
    const sql = `
      SELECT ${PURCHASE_PAYMENT_COLUMNS}
      FROM purchase_payments
      WHERE business_id = $1
        AND purchase_id = $2
      ORDER BY created_at ASC
    `
    const result = await client.query(sql, [businessId, purchaseId])
    return result.rows.map(mapRowToPurchasePaymentDto)
  },

  /**
   * Insert a payment record for a purchase order.
   */
  async insertPayment(
    client: PoolClient,
    data: {
      id: string
      business_id: string
      purchase_id: string
      amount_minor: number
      method: PaymentMethod
      reference: string | null
      idempotency_key: string
    }
  ): Promise<PurchasePaymentDto> {
    const sql = `
      INSERT INTO purchase_payments (
        id, business_id, purchase_id, amount_minor, method, reference, idempotency_key, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      RETURNING ${PURCHASE_PAYMENT_COLUMNS}
    `
    const result = await client.query(sql, [
      data.id,
      data.business_id,
      data.purchase_id,
      data.amount_minor,
      data.method,
      data.reference,
      data.idempotency_key,
    ])
    return mapRowToPurchasePaymentDto(result.rows[0])
  },

  /**
   * Delete purchase items for draft update.
   */
  async deleteItems(client: PoolClient, purchaseId: string): Promise<void> {
    await client.query('DELETE FROM purchase_items WHERE purchase_id = $1', [purchaseId])
  },

  /**
   * Update draft purchase order fields and bump server_version.
   */
  async updateDraft(
    client: PoolClient,
    businessId: string,
    purchaseId: string,
    expectedServerVersion: number,
    patch: {
      branch_id?: string
      supplier_id?: string
      supplier_term?: SupplierTerm
      date?: string
      due_date?: string
      total_minor?: number
      outstanding_minor?: number
      note?: string | null
    }
  ): Promise<PurchaseDto | null> {
    const setClauses: string[] = []
    const values: unknown[] = [purchaseId, businessId, expectedServerVersion]
    let paramIndex = 4

    if (patch.branch_id !== undefined) {
      setClauses.push(`branch_id = $${paramIndex++}`)
      values.push(patch.branch_id)
    }

    if (patch.supplier_id !== undefined) {
      setClauses.push(`supplier_id = $${paramIndex++}`)
      values.push(patch.supplier_id)
    }

    if (patch.supplier_term !== undefined) {
      setClauses.push(`supplier_term = $${paramIndex++}`)
      values.push(patch.supplier_term)
    }

    if (patch.date !== undefined) {
      setClauses.push(`date = $${paramIndex++}`)
      values.push(patch.date)
    }

    if (patch.due_date !== undefined) {
      setClauses.push(`due_date = $${paramIndex++}`)
      values.push(patch.due_date)
    }

    if (patch.total_minor !== undefined) {
      setClauses.push(`total_minor = $${paramIndex++}`)
      values.push(patch.total_minor)
    }

    if (patch.outstanding_minor !== undefined) {
      setClauses.push(`outstanding_minor = $${paramIndex++}`)
      values.push(patch.outstanding_minor)
    }

    if ('note' in patch) {
      setClauses.push(`note = $${paramIndex++}`)
      values.push(patch.note ?? null)
    }

    setClauses.push('updated_at = now()')
    setClauses.push('server_version = server_version + 1')

    const sql = `
      UPDATE purchases
      SET ${setClauses.join(', ')}
      WHERE id = $1
        AND business_id = $2
        AND server_version = $3
        AND status = 'draft'
        AND deleted_at IS NULL
      RETURNING ${PURCHASE_RETURNING_COLUMNS}
    `
    const result = await client.query(sql, values)
    if (result.rows.length === 0) return null
    return mapRowToPurchaseDto(result.rows[0])
  },

  /**
   * Update purchase order status (e.g. draft -> sent, or cancel).
   */
  async updateStatus(
    client: PoolClient,
    businessId: string,
    purchaseId: string,
    expectedServerVersion: number,
    newStatus: PurchaseStatus
  ): Promise<PurchaseDto | null> {
    const sql = `
      UPDATE purchases
      SET status = $1, updated_at = now(), server_version = server_version + 1
      WHERE id = $2
        AND business_id = $3
        AND server_version = $4
        AND deleted_at IS NULL
      RETURNING ${PURCHASE_RETURNING_COLUMNS}
    `
    const result = await client.query(sql, [
      newStatus,
      purchaseId,
      businessId,
      expectedServerVersion,
    ])
    if (result.rows.length === 0) return null
    return mapRowToPurchaseDto(result.rows[0])
  },

  /**
   * Update item received quantity.
   */
  async updateItemReceivedQty(
    client: PoolClient,
    itemId: string,
    purchaseId: string,
    addQty: number
  ): Promise<PurchaseItemDto | null> {
    const sql = `
      UPDATE purchase_items
      SET received_qty = received_qty + $1
      WHERE id = $2
        AND purchase_id = $3
      RETURNING ${PURCHASE_ITEM_COLUMNS}
    `
    const result = await client.query(sql, [addQty, itemId, purchaseId])
    if (result.rows.length === 0) return null
    return mapRowToPurchaseItemDto(result.rows[0])
  },

  /**
   * Update purchase after receiving goods.
   */
  async updateReceiveProgress(
    client: PoolClient,
    businessId: string,
    purchaseId: string,
    expectedServerVersion: number,
    data: {
      status: PurchaseStatus
      received_minor: number
      paid_minor: number
      outstanding_minor: number
    }
  ): Promise<PurchaseDto | null> {
    const sql = `
      UPDATE purchases
      SET status = $1,
          received_minor = $2,
          paid_minor = $3,
          outstanding_minor = $4,
          updated_at = now(),
          server_version = server_version + 1
      WHERE id = $5
        AND business_id = $6
        AND server_version = $7
        AND deleted_at IS NULL
      RETURNING ${PURCHASE_RETURNING_COLUMNS}
    `
    const result = await client.query(sql, [
      data.status,
      data.received_minor,
      data.paid_minor,
      data.outstanding_minor,
      purchaseId,
      businessId,
      expectedServerVersion,
    ])
    if (result.rows.length === 0) return null
    return mapRowToPurchaseDto(result.rows[0])
  },

  /**
   * Update purchase after manual payment.
   */
  async updatePaymentProgress(
    client: PoolClient,
    businessId: string,
    purchaseId: string,
    expectedServerVersion: number,
    data: {
      paid_minor: number
      outstanding_minor: number
    }
  ): Promise<PurchaseDto | null> {
    const sql = `
      UPDATE purchases
      SET paid_minor = $1,
          outstanding_minor = $2,
          updated_at = now(),
          server_version = server_version + 1
      WHERE id = $3
        AND business_id = $4
        AND server_version = $5
        AND deleted_at IS NULL
      RETURNING ${PURCHASE_RETURNING_COLUMNS}
    `
    const result = await client.query(sql, [
      data.paid_minor,
      data.outstanding_minor,
      purchaseId,
      businessId,
      expectedServerVersion,
    ])
    if (result.rows.length === 0) return null
    return mapRowToPurchaseDto(result.rows[0])
  },

  /**
   * Soft-delete a draft purchase order.
   */
  async softDeleteDraft(
    client: PoolClient,
    businessId: string,
    purchaseId: string
  ): Promise<PurchaseDto | null> {
    const sql = `
      UPDATE purchases
      SET deleted_at = now(), updated_at = now(), server_version = server_version + 1
      WHERE id = $1
        AND business_id = $2
        AND status = 'draft'
        AND deleted_at IS NULL
      RETURNING ${PURCHASE_RETURNING_COLUMNS}
    `
    const result = await client.query(sql, [purchaseId, businessId])
    if (result.rows.length === 0) return null
    return mapRowToPurchaseDto(result.rows[0])
  },

  /**
   * Sync query: find purchases with server_version > afterVersion.
   */
  async findByBusinessAfter(
    client: PoolClient,
    businessId: string,
    afterVersion: number,
    limit: number
  ): Promise<PurchaseDto[]> {
    const sql = `
      SELECT
        ${PURCHASE_COLUMNS},
        s.name AS supplier_name,
        b.name AS branch_name
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN branches b ON b.id = p.branch_id
      WHERE p.business_id = $1
        AND p.server_version > $2
      ORDER BY p.server_version ASC, p.id ASC
      LIMIT $3
    `
    const result = await client.query(sql, [businessId, afterVersion, limit])
    const rows = result.rows.map(mapRowToPurchaseDto)

    for (const po of rows) {
      po.items = await this.getItems(client, po.id)
      po.payments = await this.getPayments(client, businessId, po.id)
    }

    return rows
  },
}
