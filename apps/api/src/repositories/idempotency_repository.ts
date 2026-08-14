import { PoolClient } from 'pg'

export interface IdempotencyRecord {
  business_id: string
  idempotency_key: string
  request_hash: string
  response_status: number
  response_body: unknown
  created_at: Date
  expires_at: Date
}

export const idempotencyRepository = {
  async findActive(client: PoolClient, businessId: string, idempotencyKey: string): Promise<IdempotencyRecord | null> {
    const sql = `
      SELECT
        business_id,
        idempotency_key,
        request_hash,
        response_status,
        response_body,
        created_at,
        expires_at
      FROM idempotency_keys
      WHERE business_id = $1
        AND idempotency_key = $2
        AND expires_at > now()
    `

    const result = await client.query(sql, [businessId, idempotencyKey])
    return (result.rows[0] as IdempotencyRecord | undefined) ?? null
  },

  async deleteExpiredForKey(client: PoolClient, businessId: string, idempotencyKey: string): Promise<void> {
    await client.query(
      `
        DELETE FROM idempotency_keys
        WHERE business_id = $1
          AND idempotency_key = $2
          AND expires_at <= now()
      `,
      [businessId, idempotencyKey]
    )
  },

  async insert(client: PoolClient, businessId: string, idempotencyKey: string, requestHash: string, responseStatus: number, responseBody: unknown): Promise<boolean> {
    const sql = `
      INSERT INTO idempotency_keys (
        business_id,
        idempotency_key,
        request_hash,
        response_status,
        response_body,
        created_at,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, now(), now() + interval '90 days')
      ON CONFLICT (business_id, idempotency_key) DO NOTHING
    `

    const result = await client.query(sql, [businessId, idempotencyKey, requestHash, responseStatus, JSON.stringify(responseBody)])

    return (result.rowCount ?? 0) > 0
  }
}
