import { PoolClient } from 'pg'
import {
  CustomerInvoiceDto,
  CustomerInvoiceDetailDto,
  CustomerInvoiceStatus,
  CustomerInvoiceQuery
} from '../dto/customer_invoice_dto'

const INVOICE_COLUMNS = `
  i.id,
  i.invoice_number,
  i.business_id,
  i.customer_subscription_id,
  i.customer_id,
  i.receivable_id,
  i.billing_period_start::text,
  i.billing_period_end::text,
  i.subtotal_minor,
  i.discount_minor,
  i.tax_minor,
  i.total_minor,
  i.currency,
  i.status,
  i.issue_date::text,
  i.due_date::text,
  i.paid_at::text,
  i.payment_reference,
  i.notes,
  i.metadata,
  i.created_at::text,
  i.updated_at::text
`

function mapRowToInvoiceDto(row: any): CustomerInvoiceDto {
  return {
    id: row.id,
    invoice_number: row.invoice_number,
    business_id: row.business_id,
    customer_subscription_id: row.customer_subscription_id,
    customer_id: row.customer_id,
    customer_name: row.customer_name ?? undefined,
    receivable_id: row.receivable_id,
    billing_period_start: row.billing_period_start,
    billing_period_end: row.billing_period_end,
    subtotal_minor: Number(row.subtotal_minor),
    discount_minor: Number(row.discount_minor),
    tax_minor: Number(row.tax_minor),
    total_minor: Number(row.total_minor),
    outstanding_minor: row.outstanding_minor !== undefined && row.outstanding_minor !== null ? Number(row.outstanding_minor) : undefined,
    paid_minor: row.paid_minor !== undefined && row.paid_minor !== null ? Number(row.paid_minor) : undefined,
    currency: row.currency,
    status: row.status as CustomerInvoiceStatus,
    issue_date: row.issue_date,
    due_date: row.due_date,
    paid_at: row.paid_at ?? null,
    payment_reference: row.payment_reference ?? null,
    notes: row.notes ?? null,
    metadata: row.metadata ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

function mapRowToInvoiceDetailDto(row: any): CustomerInvoiceDetailDto {
  const base = mapRowToInvoiceDto(row)
  return {
    ...base,
    customer_phone: row.customer_phone ?? null,
    customer_email: row.customer_email ?? null,
    subscription_name: row.subscription_name ?? undefined,
    receivable_status: row.receivable_status ?? undefined
  }
}

export interface CreateInvoiceData {
  id?: string
  invoice_number: string
  business_id: string
  customer_subscription_id: string
  customer_id: string
  receivable_id: string
  billing_period_start: string
  billing_period_end: string
  subtotal_minor: number
  discount_minor: number
  tax_minor: number
  total_minor: number
  currency?: string
  status?: CustomerInvoiceStatus
  issue_date?: string
  due_date: string
  notes?: string | null
  metadata?: Record<string, unknown>
}

export const customerInvoiceRepository = {
  async create(
    client: PoolClient,
    data: CreateInvoiceData
  ): Promise<CustomerInvoiceDto> {
    const sql = `
      INSERT INTO customer_invoices (
        id, invoice_number, business_id, customer_subscription_id, customer_id,
        receivable_id, billing_period_start, billing_period_end,
        subtotal_minor, discount_minor, tax_minor, total_minor,
        currency, status, issue_date, due_date, notes, metadata,
        created_at, updated_at
      ) VALUES (
        COALESCE($1, gen_random_uuid()), $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12,
        COALESCE($13, 'IDR'), COALESCE($14, 'ISSUED'), COALESCE($15, CURRENT_DATE), $16, $17, $18,
        now(), now()
      )
      RETURNING
        id, invoice_number, business_id, customer_subscription_id, customer_id,
        receivable_id, billing_period_start::text, billing_period_end::text,
        subtotal_minor, discount_minor, tax_minor, total_minor,
        currency, status, issue_date::text, due_date::text, paid_at::text,
        payment_reference, notes, metadata, created_at::text, updated_at::text;
    `
    const res = await client.query(sql, [
      data.id ?? null,
      data.invoice_number,
      data.business_id,
      data.customer_subscription_id,
      data.customer_id,
      data.receivable_id,
      data.billing_period_start,
      data.billing_period_end,
      data.subtotal_minor,
      data.discount_minor,
      data.tax_minor,
      data.total_minor,
      data.currency ?? 'IDR',
      data.status ?? 'ISSUED',
      data.issue_date ?? null,
      data.due_date,
      data.notes ?? null,
      JSON.stringify(data.metadata ?? {})
    ])
    return mapRowToInvoiceDto(res.rows[0])
  },

  async findById(
    client: PoolClient,
    businessId: string,
    id: string
  ): Promise<CustomerInvoiceDetailDto | null> {
    const sql = `
      SELECT
        ${INVOICE_COLUMNS},
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        s.name AS subscription_name,
        r.status AS receivable_status,
        r.outstanding_minor,
        r.paid_minor
      FROM customer_invoices i
      LEFT JOIN customers c ON c.id = i.customer_id AND c.business_id = i.business_id
      LEFT JOIN customer_subscriptions s ON s.id = i.customer_subscription_id AND s.business_id = i.business_id
      LEFT JOIN receivables r ON r.id = i.receivable_id AND r.business_id = i.business_id
      WHERE i.id = $1 AND i.business_id = $2;
    `
    const res = await client.query(sql, [id, businessId])
    if (res.rows.length === 0) return null
    return mapRowToInvoiceDetailDto(res.rows[0])
  },

  async lockById(
    client: PoolClient,
    businessId: string,
    id: string
  ): Promise<CustomerInvoiceDetailDto | null> {
    const sql = `
      SELECT
        ${INVOICE_COLUMNS},
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        s.name AS subscription_name,
        r.status AS receivable_status,
        r.outstanding_minor,
        r.paid_minor
      FROM customer_invoices i
      LEFT JOIN customers c ON c.id = i.customer_id AND c.business_id = i.business_id
      LEFT JOIN customer_subscriptions s ON s.id = i.customer_subscription_id AND s.business_id = i.business_id
      LEFT JOIN receivables r ON r.id = i.receivable_id AND r.business_id = i.business_id
      WHERE i.id = $1 AND i.business_id = $2
      FOR UPDATE OF i;
    `
    const res = await client.query(sql, [id, businessId])
    if (res.rows.length === 0) return null
    return mapRowToInvoiceDetailDto(res.rows[0])
  },

  async findByReceivable(
    client: PoolClient,
    businessId: string,
    receivableId: string
  ): Promise<CustomerInvoiceDto | null> {
    const sql = `
      SELECT ${INVOICE_COLUMNS}, c.name AS customer_name
      FROM customer_invoices i
      LEFT JOIN customers c ON c.id = i.customer_id AND c.business_id = i.business_id
      WHERE i.receivable_id = $1 AND i.business_id = $2;
    `
    const res = await client.query(sql, [receivableId, businessId])
    if (res.rows.length === 0) return null
    return mapRowToInvoiceDto(res.rows[0])
  },

  async findBySubscriptionAndPeriod(
    client: PoolClient,
    businessId: string,
    subscriptionId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<CustomerInvoiceDto | null> {
    const sql = `
      SELECT ${INVOICE_COLUMNS}, c.name AS customer_name
      FROM customer_invoices i
      LEFT JOIN customers c ON c.id = i.customer_id AND c.business_id = i.business_id
      WHERE i.customer_subscription_id = $1
        AND i.billing_period_start = $2
        AND i.billing_period_end = $3
        AND i.business_id = $4;
    `
    const res = await client.query(sql, [subscriptionId, periodStart, periodEnd, businessId])
    if (res.rows.length === 0) return null
    return mapRowToInvoiceDto(res.rows[0])
  },

  async list(
    client: PoolClient,
    businessId: string,
    filters: CustomerInvoiceQuery = {}
  ): Promise<{ items: CustomerInvoiceDto[]; total: number }> {
    const limit = filters.limit ?? 50
    const offset = filters.offset ?? 0

    const conditions: string[] = ['i.business_id = $1']
    const params: unknown[] = [businessId]
    let paramIndex = 2

    if (filters.customer_id) {
      conditions.push(`i.customer_id = $${paramIndex++}`)
      params.push(filters.customer_id)
    }
    if (filters.customer_subscription_id) {
      conditions.push(`i.customer_subscription_id = $${paramIndex++}`)
      params.push(filters.customer_subscription_id)
    }
    if (filters.status) {
      conditions.push(`i.status = $${paramIndex++}`)
      params.push(filters.status)
    }
    if (filters.date_from) {
      conditions.push(`i.issue_date >= $${paramIndex++}`)
      params.push(filters.date_from)
    }
    if (filters.date_to) {
      conditions.push(`i.issue_date <= $${paramIndex++}`)
      params.push(filters.date_to)
    }
    if (filters.search) {
      conditions.push(`(i.invoice_number ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex})`)
      params.push(`%${filters.search}%`)
      paramIndex++
    }

    const whereClause = conditions.join(' AND ')

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM customer_invoices i
      LEFT JOIN customers c ON c.id = i.customer_id AND c.business_id = i.business_id
      WHERE ${whereClause};
    `
    const countRes = await client.query(countSql, params)
    const total = countRes.rows[0]?.total ?? 0

    const listSql = `
      SELECT
        ${INVOICE_COLUMNS},
        c.name AS customer_name,
        r.outstanding_minor,
        r.paid_minor
      FROM customer_invoices i
      LEFT JOIN customers c ON c.id = i.customer_id AND c.business_id = i.business_id
      LEFT JOIN receivables r ON r.id = i.receivable_id AND r.business_id = i.business_id
      WHERE ${whereClause}
      ORDER BY i.issue_date DESC, i.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `
    const listRes = await client.query(listSql, [...params, limit, offset])
    return {
      items: listRes.rows.map(mapRowToInvoiceDto),
      total
    }
  },

  async updateStatus(
    client: PoolClient,
    businessId: string,
    id: string,
    status: CustomerInvoiceStatus,
    paidAt?: string | null,
    paymentReference?: string | null
  ): Promise<CustomerInvoiceDto | null> {
    const setClauses = ['status = $3', 'updated_at = now()']
    const params: unknown[] = [id, businessId, status]
    let paramIndex = 4

    if (paidAt !== undefined) {
      setClauses.push(`paid_at = $${paramIndex++}`)
      params.push(paidAt)
    }
    if (paymentReference !== undefined) {
      setClauses.push(`payment_reference = $${paramIndex++}`)
      params.push(paymentReference)
    }

    const sql = `
      UPDATE customer_invoices
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND business_id = $2
      RETURNING
        id, invoice_number, business_id, customer_subscription_id, customer_id,
        receivable_id, billing_period_start::text, billing_period_end::text,
        subtotal_minor, discount_minor, tax_minor, total_minor,
        currency, status, issue_date::text, due_date::text, paid_at::text,
        payment_reference, notes, metadata, created_at::text, updated_at::text;
    `
    const res = await client.query(sql, params)
    if (res.rows.length === 0) return null
    return mapRowToInvoiceDto(res.rows[0])
  },

  async markOverdue(
    client: PoolClient,
    businessId: string,
    asOfDate: string = new Date().toISOString().slice(0, 10)
  ): Promise<number> {
    const sql = `
      UPDATE customer_invoices
      SET status = 'OVERDUE', updated_at = now()
      WHERE business_id = $1
        AND status = 'ISSUED'
        AND due_date < $2;
    `
    const res = await client.query(sql, [businessId, asOfDate])
    return res.rowCount ?? 0
  }
}
