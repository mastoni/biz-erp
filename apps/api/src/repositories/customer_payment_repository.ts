import { PoolClient } from 'pg'

export type PaymentMethod = 'cash' | 'bank_transfer' | 'debit' | 'credit'

export interface CustomerPaymentDto {
  id: string
  business_id: string
  receivable_id: string
  customer_id: string
  branch_id: string | null
  amount_minor: number
  method: PaymentMethod
  reference: string | null
  idempotency_key: string
  created_at: string
}

// SELECT column list (with alias prefix)
const CUSTOMER_PAYMENT_COLUMNS = `
  cp.id,
  cp.business_id,
  cp.receivable_id,
  cp.customer_id,
  cp.branch_id,
  cp.amount_minor,
  cp.method,
  cp.reference,
  cp.idempotency_key,
  cp.created_at
`

// RETURNING column list (no alias prefix)
const CUSTOMER_PAYMENT_RETURNING = `
  id,
  business_id,
  receivable_id,
  customer_id,
  branch_id,
  amount_minor,
  method,
  reference,
  idempotency_key,
  created_at
`

function mapRowToDto(row: any): CustomerPaymentDto {
  return {
    id: row.id,
    business_id: row.business_id,
    receivable_id: row.receivable_id,
    customer_id: row.customer_id,
    branch_id: row.branch_id ?? null,
    amount_minor: Number(row.amount_minor),
    method: row.method as PaymentMethod,
    reference: row.reference ?? null,
    idempotency_key: row.idempotency_key,
    created_at:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

export const customerPaymentRepository = {
  /**
   * Insert a new customer payment record.
   * business_id and customer_id are supplied by the caller (the service layer),
   * which has already validated them against the receivable.
   * The repository never derives or overrides business_id.
   */
  async create(
    client: PoolClient,
    data: {
      id: string
      business_id: string
      receivable_id: string
      customer_id: string
      branch_id: string | null
      amount_minor: number
      method: PaymentMethod
      reference: string | null
      idempotency_key: string
    }
  ): Promise<CustomerPaymentDto> {
    const sql = `
      INSERT INTO customer_payments (
        id, business_id, receivable_id, customer_id, branch_id,
        amount_minor, method, reference, idempotency_key
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING ${CUSTOMER_PAYMENT_RETURNING}
    `
    const result = await client.query(sql, [
      data.id,
      data.business_id,
      data.receivable_id,
      data.customer_id,
      data.branch_id,
      data.amount_minor,
      data.method,
      data.reference,
      data.idempotency_key,
    ])
    return mapRowToDto(result.rows[0])
  },

  async findById(
    client: PoolClient,
    businessId: string,
    paymentId: string
  ): Promise<CustomerPaymentDto | null> {
    const sql = `
      SELECT ${CUSTOMER_PAYMENT_COLUMNS}
      FROM customer_payments cp
      WHERE cp.id = $1
        AND cp.business_id = $2
    `
    const result = await client.query(sql, [paymentId, businessId])
    if (result.rows.length === 0) return null
    return mapRowToDto(result.rows[0])
  },

  async findByIdempotencyKey(
    client: PoolClient,
    businessId: string,
    idempotencyKey: string
  ): Promise<CustomerPaymentDto | null> {
    const sql = `
      SELECT ${CUSTOMER_PAYMENT_COLUMNS}
      FROM customer_payments cp
      WHERE cp.business_id = $1
        AND cp.idempotency_key = $2
    `
    const result = await client.query(sql, [businessId, idempotencyKey])
    if (result.rows.length === 0) return null
    return mapRowToDto(result.rows[0])
  },

  async listByReceivable(
    client: PoolClient,
    businessId: string,
    receivableId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ rows: CustomerPaymentDto[]; total: number }> {
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM customer_payments cp
      WHERE cp.business_id = $1
        AND cp.receivable_id = $2
    `
    const countResult = await client.query(countSql, [businessId, receivableId])
    const total = countResult.rows[0].total as number

    const rowSql = `
      SELECT ${CUSTOMER_PAYMENT_COLUMNS}
      FROM customer_payments cp
      WHERE cp.business_id = $1
        AND cp.receivable_id = $2
      ORDER BY cp.created_at DESC, cp.id DESC
      LIMIT $3
      OFFSET $4
    `
    const rowResult = await client.query(rowSql, [businessId, receivableId, limit, offset])
    return { rows: rowResult.rows.map(mapRowToDto), total }
  },
}
