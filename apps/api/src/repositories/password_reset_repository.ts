import { PoolClient } from 'pg'
import { newUuid } from '../utils/uuid'

export interface PasswordResetToken {
  id: string
  user_id: string
  token_hash: string
  expires_at: Date
  used_at: Date | null
  created_at: Date
  ip_address: string | null
  user_agent: string | null
}

export interface CreatePasswordResetTokenParams {
  userId: string
  tokenHash: string
  expiresAt: Date
  ipAddress?: string
  userAgent?: string
}

export const passwordResetRepository = {
  async create(client: PoolClient, params: CreatePasswordResetTokenParams): Promise<PasswordResetToken> {
    const id = newUuid()
    const result = await client.query(
      `
      INSERT INTO password_reset_tokens (
        id,
        user_id,
        token_hash,
        expires_at,
        ip_address,
        user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        id,
        params.userId,
        params.tokenHash,
        params.expiresAt,
        params.ipAddress || null,
        params.userAgent || null
      ]
    )
    return result.rows[0]
  },

  async findByTokenHashForUpdate(client: PoolClient, tokenHash: string): Promise<PasswordResetToken | null> {
    const result = await client.query(
      `
      SELECT *
      FROM password_reset_tokens
      WHERE token_hash = $1
      FOR UPDATE
      `,
      [tokenHash]
    )
    return result.rows[0] || null
  },

  async markUsed(client: PoolClient, id: string): Promise<void> {
    await client.query(
      `
      UPDATE password_reset_tokens
      SET used_at = now()
      WHERE id = $1
      `,
      [id]
    )
  },

  async invalidateAllPendingForUser(client: PoolClient, userId: string): Promise<void> {
    await client.query(
      `
      UPDATE password_reset_tokens
      SET used_at = now()
      WHERE user_id = $1
        AND used_at IS NULL
      `,
      [userId]
    )
  }
}
