import { PoolClient } from 'pg'
import {
  CustomerSubscriptionDto,
  CustomerSubscriptionBillingCycle,
  CustomerSubscriptionStatus,
  CustomerSubscriptionQuery
} from '../dto/customer_subscription_dto'

const SUBSCRIPTION_COLUMNS = `
  s.id,
  s.business_id,
  s.customer_id,
  s.plan_code,
  s.product_id,
  s.name,
  s.unit_price_minor,
  s.discount_minor,
  s.tax_minor,
  s.total_minor,
  s.currency,
  s.billing_cycle,
  s.status,
  s.starts_at::text,
  s.ends_at::text,
  s.next_billing_date::text,
  s.anchor_day,
  s.notes,
  s.metadata,
  s.created_at::text,
  s.updated_at::text
`

function mapRowToSubscriptionDto(row: any): CustomerSubscriptionDto {
  return {
    id: row.id,
    business_id: row.business_id,
    customer_id: row.customer_id,
    customer_name: row.customer_name ?? undefined,
    plan_code: row.plan_code ?? null,
    product_id: row.product_id ?? null,
    name: row.name,
    unit_price_minor: Number(row.unit_price_minor),
    discount_minor: Number(row.discount_minor),
    tax_minor: Number(row.tax_minor),
    total_minor: Number(row.total_minor),
    currency: row.currency,
    billing_cycle: row.billing_cycle as CustomerSubscriptionBillingCycle,
    status: row.status as CustomerSubscriptionStatus,
    starts_at: row.starts_at,
    ends_at: row.ends_at ?? null,
    next_billing_date: row.next_billing_date,
    anchor_day: Number(row.anchor_day),
    notes: row.notes ?? null,
    metadata: row.metadata ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

export interface CreateSubscriptionData {
  id?: string
  business_id: string
  customer_id: string
  plan_code?: string | null
  product_id?: string | null
  name: string
  unit_price_minor: number
  discount_minor: number
  tax_minor: number
  total_minor: number
  currency: string
  billing_cycle: CustomerSubscriptionBillingCycle
  status?: CustomerSubscriptionStatus
  starts_at?: string
  ends_at?: string | null
  next_billing_date: string
  anchor_day: number
  notes?: string | null
  metadata?: Record<string, unknown>
}

export const customerSubscriptionRepository = {
  async create(
    client: PoolClient,
    data: CreateSubscriptionData
  ): Promise<CustomerSubscriptionDto> {
    const sql = `
      INSERT INTO customer_subscriptions (
        id, business_id, customer_id, plan_code, product_id,
        name, unit_price_minor, discount_minor, tax_minor, total_minor,
        currency, billing_cycle, status, starts_at, ends_at,
        next_billing_date, anchor_day, notes, metadata, created_at, updated_at
      ) VALUES (
        COALESCE($1, gen_random_uuid()), $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, COALESCE($14, now()), $15,
        $16, $17, $18, $19, now(), now()
      )
      RETURNING
        id, business_id, customer_id, plan_code, product_id,
        name, unit_price_minor, discount_minor, tax_minor, total_minor,
        currency, billing_cycle, status, starts_at::text, ends_at::text,
        next_billing_date::text, anchor_day, notes, metadata,
        created_at::text, updated_at::text;
    `
    const res = await client.query(sql, [
      data.id ?? null,
      data.business_id,
      data.customer_id,
      data.plan_code ?? null,
      data.product_id ?? null,
      data.name,
      data.unit_price_minor,
      data.discount_minor,
      data.tax_minor,
      data.total_minor,
      data.currency,
      data.billing_cycle,
      data.status ?? 'ACTIVE',
      data.starts_at ?? null,
      data.ends_at ?? null,
      data.next_billing_date,
      data.anchor_day,
      data.notes ?? null,
      JSON.stringify(data.metadata ?? {})
    ])
    return mapRowToSubscriptionDto(res.rows[0])
  },

  async findById(
    client: PoolClient,
    businessId: string,
    id: string
  ): Promise<CustomerSubscriptionDto | null> {
    const sql = `
      SELECT ${SUBSCRIPTION_COLUMNS}, c.name AS customer_name
      FROM customer_subscriptions s
      LEFT JOIN customers c ON c.id = s.customer_id AND c.business_id = s.business_id
      WHERE s.id = $1 AND s.business_id = $2;
    `
    const res = await client.query(sql, [id, businessId])
    if (res.rows.length === 0) return null
    return mapRowToSubscriptionDto(res.rows[0])
  },

  async lockById(
    client: PoolClient,
    businessId: string,
    id: string
  ): Promise<CustomerSubscriptionDto | null> {
    const sql = `
      SELECT ${SUBSCRIPTION_COLUMNS}, c.name AS customer_name
      FROM customer_subscriptions s
      LEFT JOIN customers c ON c.id = s.customer_id AND c.business_id = s.business_id
      WHERE s.id = $1 AND s.business_id = $2
      FOR UPDATE OF s;
    `
    const res = await client.query(sql, [id, businessId])
    if (res.rows.length === 0) return null
    return mapRowToSubscriptionDto(res.rows[0])
  },

  async list(
    client: PoolClient,
    businessId: string,
    filters: CustomerSubscriptionQuery = {}
  ): Promise<{ items: CustomerSubscriptionDto[]; total: number }> {
    const limit = filters.limit ?? 50
    const offset = filters.offset ?? 0

    const conditions: string[] = ['s.business_id = $1']
    const params: unknown[] = [businessId]
    let paramIndex = 2

    if (filters.customer_id) {
      conditions.push(`s.customer_id = $${paramIndex++}`)
      params.push(filters.customer_id)
    }
    if (filters.status) {
      conditions.push(`s.status = $${paramIndex++}`)
      params.push(filters.status)
    }
    if (filters.billing_cycle) {
      conditions.push(`s.billing_cycle = $${paramIndex++}`)
      params.push(filters.billing_cycle)
    }
    if (filters.search) {
      conditions.push(`(s.name ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex})`)
      params.push(`%${filters.search}%`)
      paramIndex++
    }

    const whereClause = conditions.join(' AND ')

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM customer_subscriptions s
      LEFT JOIN customers c ON c.id = s.customer_id AND c.business_id = s.business_id
      WHERE ${whereClause};
    `
    const countRes = await client.query(countSql, params)
    const total = countRes.rows[0]?.total ?? 0

    const listSql = `
      SELECT ${SUBSCRIPTION_COLUMNS}, c.name AS customer_name
      FROM customer_subscriptions s
      LEFT JOIN customers c ON c.id = s.customer_id AND c.business_id = s.business_id
      WHERE ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `
    const listRes = await client.query(listSql, [...params, limit, offset])
    return {
      items: listRes.rows.map(mapRowToSubscriptionDto),
      total
    }
  },

  async update(
    client: PoolClient,
    businessId: string,
    id: string,
    data: {
      name?: string
      notes?: string | null
      metadata?: Record<string, unknown>
      ends_at?: string | null
      unit_price_minor?: number
      discount_minor?: number
      tax_minor?: number
      total_minor?: number
      billing_cycle?: CustomerSubscriptionBillingCycle
    }
  ): Promise<CustomerSubscriptionDto | null> {
    const setClauses: string[] = []
    const params: unknown[] = [id, businessId]
    let paramIndex = 3

    if (data.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`)
      params.push(data.name)
    }
    if (data.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`)
      params.push(data.notes)
    }
    if (data.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex++}`)
      params.push(JSON.stringify(data.metadata))
    }
    if (data.ends_at !== undefined) {
      setClauses.push(`ends_at = $${paramIndex++}`)
      params.push(data.ends_at)
    }
    if (data.unit_price_minor !== undefined) {
      setClauses.push(`unit_price_minor = $${paramIndex++}`)
      params.push(data.unit_price_minor)
    }
    if (data.discount_minor !== undefined) {
      setClauses.push(`discount_minor = $${paramIndex++}`)
      params.push(data.discount_minor)
    }
    if (data.tax_minor !== undefined) {
      setClauses.push(`tax_minor = $${paramIndex++}`)
      params.push(data.tax_minor)
    }
    if (data.total_minor !== undefined) {
      setClauses.push(`total_minor = $${paramIndex++}`)
      params.push(data.total_minor)
    }
    if (data.billing_cycle !== undefined) {
      setClauses.push(`billing_cycle = $${paramIndex++}`)
      params.push(data.billing_cycle)
    }

    if (setClauses.length === 0) {
      return this.findById(client, businessId, id)
    }

    setClauses.push('updated_at = now()')

    const sql = `
      UPDATE customer_subscriptions
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND business_id = $2
      RETURNING
        id, business_id, customer_id, plan_code, product_id,
        name, unit_price_minor, discount_minor, tax_minor, total_minor,
        currency, billing_cycle, status, starts_at::text, ends_at::text,
        next_billing_date::text, anchor_day, notes, metadata,
        created_at::text, updated_at::text;
    `
    const res = await client.query(sql, params)
    if (res.rows.length === 0) return null
    return mapRowToSubscriptionDto(res.rows[0])
  },

  async updateStatus(
    client: PoolClient,
    businessId: string,
    id: string,
    status: CustomerSubscriptionStatus,
    endsAt?: string | null
  ): Promise<CustomerSubscriptionDto | null> {
    const setClauses = ['status = $3', 'updated_at = now()']
    const params: unknown[] = [id, businessId, status]

    if (endsAt !== undefined) {
      setClauses.push('ends_at = $4')
      params.push(endsAt)
    }

    const sql = `
      UPDATE customer_subscriptions
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND business_id = $2
      RETURNING
        id, business_id, customer_id, plan_code, product_id,
        name, unit_price_minor, discount_minor, tax_minor, total_minor,
        currency, billing_cycle, status, starts_at::text, ends_at::text,
        next_billing_date::text, anchor_day, notes, metadata,
        created_at::text, updated_at::text;
    `
    const res = await client.query(sql, params)
    if (res.rows.length === 0) return null
    return mapRowToSubscriptionDto(res.rows[0])
  },

  async advanceBillingDate(
    client: PoolClient,
    businessId: string,
    id: string,
    nextBillingDate: string
  ): Promise<void> {
    const sql = `
      UPDATE customer_subscriptions
      SET next_billing_date = $3, updated_at = now()
      WHERE id = $1 AND business_id = $2;
    `
    await client.query(sql, [id, businessId, nextBillingDate])
  }
}
