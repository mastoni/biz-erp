import { Pool, PoolClient } from 'pg'
import {
  TopUpIntentDto,
  TopUpIntentStatus,
  TopUpIntentQueryFilter
} from '../dto/wallet_dto'

function mapRowToTopUpIntentDto(row: Record<string, unknown>): TopUpIntentDto {
  return {
    id: row.id as string,
    intent_number: row.intent_number as string,
    wallet_id: row.wallet_id as string,
    account_customer_id: row.account_customer_id as string,
    amount: Number(row.amount),
    fee_amount: Number(row.fee_amount),
    total_payable: Number(row.total_payable),
    currency: row.currency as string,
    status: row.status as TopUpIntentStatus,
    payment_method: (row.payment_method as string) ?? null,
    payment_reference: (row.payment_reference as string) ?? null,
    gateway_transaction_id: (row.gateway_transaction_id as string) ?? null,
    expires_at: typeof row.expires_at === 'string' ? row.expires_at : (row.expires_at as Date).toISOString(),
    settled_at: row.settled_at
      ? typeof row.settled_at === 'string'
        ? row.settled_at
        : (row.settled_at as Date).toISOString()
      : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: typeof row.created_at === 'string' ? row.created_at : (row.created_at as Date).toISOString(),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : (row.updated_at as Date).toISOString()
  }
}

export function createTopUpIntentRepository(pool: Pool) {
  return {
    async createIntent(
      data: {
        intentNumber: string
        walletId: string
        accountCustomerId: string
        amount: number
        feeAmount: number
        totalPayable: number
        currency?: string
        paymentMethod?: string | null
        expiresAt: string
        metadata?: Record<string, unknown>
      },
      client?: PoolClient
    ): Promise<TopUpIntentDto> {
      const db = client ?? pool
      const query = `
        INSERT INTO top_up_intents (
          intent_number, wallet_id, account_customer_id, amount, fee_amount, total_payable,
          currency, payment_method, expires_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `
      const values = [
        data.intentNumber,
        data.walletId,
        data.accountCustomerId,
        data.amount.toString(),
        data.feeAmount.toString(),
        data.totalPayable.toString(),
        data.currency ?? 'IDR',
        data.paymentMethod ?? null,
        data.expiresAt,
        JSON.stringify(data.metadata ?? {})
      ]

      const res = await db.query(query, values)
      return mapRowToTopUpIntentDto(res.rows[0])
    },

    async getIntentById(id: string, client?: PoolClient): Promise<TopUpIntentDto | null> {
      const db = client ?? pool
      const query = `SELECT * FROM top_up_intents WHERE id = $1`
      const res = await db.query(query, [id])
      if (res.rows.length === 0) return null
      return mapRowToTopUpIntentDto(res.rows[0])
    },

    async getIntentByNumber(intentNumber: string, client?: PoolClient): Promise<TopUpIntentDto | null> {
      const db = client ?? pool
      const query = `SELECT * FROM top_up_intents WHERE intent_number = $1`
      const res = await db.query(query, [intentNumber])
      if (res.rows.length === 0) return null
      return mapRowToTopUpIntentDto(res.rows[0])
    },

    async listIntents(
      filter: TopUpIntentQueryFilter,
      client?: PoolClient
    ): Promise<{ items: TopUpIntentDto[]; total: number }> {
      const db = client ?? pool
      const conditions: string[] = []
      const values: unknown[] = []
      let idx = 1

      if (filter.wallet_id) {
        conditions.push(`wallet_id = $${idx++}`)
        values.push(filter.wallet_id)
      }
      if (filter.account_customer_id) {
        conditions.push(`account_customer_id = $${idx++}`)
        values.push(filter.account_customer_id)
      }
      if (filter.status) {
        conditions.push(`status = $${idx++}`)
        values.push(filter.status)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const countRes = await db.query(`SELECT COUNT(*) AS total FROM top_up_intents ${whereClause}`, values)
      const total = Number(countRes.rows[0].total)

      const limit = filter.limit ?? 50
      const offset = filter.offset ?? 0
      values.push(limit, offset)

      const query = `
        SELECT * FROM top_up_intents
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}
      `
      const res = await db.query(query, values)
      return {
        items: res.rows.map(mapRowToTopUpIntentDto),
        total
      }
    },

    async updateStatus(
      id: string,
      status: TopUpIntentStatus,
      updates?: {
        paymentReference?: string | null
        gatewayTransactionId?: string | null
        paymentMethod?: string | null
        settledAt?: string | null
      },
      client?: PoolClient
    ): Promise<TopUpIntentDto | null> {
      const db = client ?? pool
      const setClauses: string[] = ['status = $1', 'updated_at = now()']
      const values: unknown[] = [status, id]
      let idx = 3

      if (updates?.paymentReference !== undefined) {
        setClauses.push(`payment_reference = $${idx++}`)
        values.push(updates.paymentReference)
      }
      if (updates?.gatewayTransactionId !== undefined) {
        setClauses.push(`gateway_transaction_id = $${idx++}`)
        values.push(updates.gatewayTransactionId)
      }
      if (updates?.paymentMethod !== undefined) {
        setClauses.push(`payment_method = $${idx++}`)
        values.push(updates.paymentMethod)
      }
      if (updates?.settledAt !== undefined) {
        setClauses.push(`settled_at = $${idx++}`)
        values.push(updates.settledAt)
      }

      const query = `
        UPDATE top_up_intents
        SET ${setClauses.join(', ')}
        WHERE id = $2
        RETURNING *
      `
      const res = await db.query(query, values)
      if (res.rows.length === 0) return null
      return mapRowToTopUpIntentDto(res.rows[0])
    }
  }
}
