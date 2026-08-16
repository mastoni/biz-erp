import crypto from 'crypto'
import { Pool, PoolClient } from 'pg'
import { withTransaction } from '../db/transaction'
import { refreshSessionRepository, RefreshSession } from '../repositories/refresh_session_repository'
import { ApiError } from '../errors/api_error'

export interface RefreshTokenResult {
  refreshToken: string
  session: RefreshSession
}

export function createRefreshTokenService(pool: Pool) {
  // 64 random bytes, base64url encoded
  const generateToken = () => {
    return crypto.randomBytes(64).toString('base64url')
  }

  const hashToken = (token: string) => {
    return crypto.createHash('sha256').update(token).digest('hex')
  }

  return {
    generateToken,
    hashToken,

    async createRefreshSession(
      userId: string,
      businessId: string,
      deviceId?: string
    ): Promise<RefreshTokenResult> {
      const token = generateToken()
      const tokenHash = hashToken(token)
      // 30 days
      const expiresInDays = Number(process.env.REFRESH_TOKEN_EXPIRY_DAYS || 30)
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)

      const session = await withTransaction(pool, async (client) => {
        return await refreshSessionRepository.create(client, {
          userId,
          businessId,
          tokenHash,
          expiresAt,
          deviceId
        })
      })

      return {
        refreshToken: token,
        session
      }
    },

    async validateRefreshToken(client: PoolClient, token: string, businessId?: string): Promise<RefreshSession> {
      const tokenHash = hashToken(token)
      const session = await refreshSessionRepository.findByHash(client, tokenHash)

      if (!session) {
        throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token')
      }

      if (session.revoked_at) {
        throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token')
      }

      if (session.expires_at.getTime() < Date.now()) {
        throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token')
      }

      // Tenant/business binding check
      if (businessId && session.business_id !== businessId) {
        throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token')
      }

      return session
    },

    async rotateRefreshToken(oldToken: string, businessId?: string): Promise<RefreshTokenResult> {
      return await withTransaction(pool, async (client) => {
        const session = await this.validateRefreshToken(client, oldToken, businessId)
        
        // Revoke the old token
        await refreshSessionRepository.revoke(client, session.id)
        await refreshSessionRepository.updateLastUsed(client, session.id)

        // Generate a new token
        const newToken = generateToken()
        const newTokenHash = hashToken(newToken)
        const expiresInDays = Number(process.env.REFRESH_TOKEN_EXPIRY_DAYS || 30)
        const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)

        // Create new session for the same user, business, and device
        const newSession = await refreshSessionRepository.create(client, {
          userId: session.user_id,
          businessId: session.business_id,
          tokenHash: newTokenHash,
          expiresAt,
          deviceId: session.device_id || undefined
        })

        return {
          refreshToken: newToken,
          session: newSession
        }
      })
    },

    async revokeRefreshToken(token: string): Promise<void> {
      await withTransaction(pool, async (client) => {
        const tokenHash = hashToken(token)
        const session = await refreshSessionRepository.findByHash(client, tokenHash)
        if (session && !session.revoked_at) {
          await refreshSessionRepository.revoke(client, session.id)
          await refreshSessionRepository.updateLastUsed(client, session.id)
        }
      })
    },

    async revokeSession(sessionId: string, userId: string, businessId: string): Promise<void> {
      await withTransaction(pool, async (client) => {
        await refreshSessionRepository.revokeByOwnership(client, sessionId, userId, businessId)
      })
    }
  }
}
