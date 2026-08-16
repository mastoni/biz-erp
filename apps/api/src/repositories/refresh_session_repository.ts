import { PoolClient } from 'pg'
import { newUuid } from '../utils/uuid'

export interface RefreshSession {
  id: string
  user_id: string
  business_id: string
  token_hash: string
  device_id: string | null
  expires_at: Date
  revoked_at: Date | null
  created_at: Date
  last_used_at: Date | null
}

export const refreshSessionRepository = {
  async create(
    client: PoolClient,
    params: {
      userId: string
      businessId: string
      tokenHash: string
      expiresAt: Date
      deviceId?: string
    }
  ): Promise<RefreshSession> {
    const id = newUuid()
    const result = await client.query(
      `
      INSERT INTO refresh_tokens (
        id,
        user_id,
        business_id,
        token_hash,
        device_id,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [id, params.userId, params.businessId, params.tokenHash, params.deviceId || null, params.expiresAt]
    )
    return result.rows[0]
  },

  async findByHash(client: PoolClient, tokenHash: string): Promise<RefreshSession | null> {
    const result = await client.query(
      `
      SELECT *
      FROM refresh_tokens
      WHERE token_hash = $1
      FOR UPDATE
      `,
      [tokenHash]
    )
    return result.rows[0] || null
  },

  async revoke(client: PoolClient, id: string): Promise<void> {
    await client.query(
      `
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE id = $1
      `,
      [id]
    )
  },

  async revokeByOwnership(client: PoolClient, id: string, userId: string, businessId: string): Promise<void> {
    await client.query(
      `
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE id = $1 AND user_id = $2 AND business_id = $3 AND revoked_at IS NULL
      `,
      [id, userId, businessId]
    )
  },

  async updateLastUsed(client: PoolClient, id: string): Promise<void> {
    await client.query(
      `
      UPDATE refresh_tokens
      SET last_used_at = now()
      WHERE id = $1
      `,
      [id]
    )
  }
}
