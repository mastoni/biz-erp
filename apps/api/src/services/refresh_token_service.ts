import crypto from 'crypto'
import { Pool, PoolClient } from 'pg'
import { withTransaction } from '../db/transaction'
import { refreshSessionRepository, RefreshSession } from '../repositories/refresh_session_repository'
import { createUserBusinessRepository, UserBusinessRepository } from '../repositories/user_business_repository'
import { ApiError } from '../errors/api_error'
import { TokenRole } from './jwt_service'

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

  const userBusinessRepo: UserBusinessRepository = createUserBusinessRepository(pool)

  return {
    generateToken,
    hashToken,

    async createRefreshSession(
      userId: string,
      businessId: string | null,
      scope: 'tenant' | 'platform' = 'tenant',
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
          scope,
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

    async validateRefreshToken(client: PoolClient, token: string, businessId?: string | null): Promise<RefreshSession> {
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

      // Tenant/business binding check. Platform sessions have a NULL business_id,
      // so no binding is enforced (businessId is undefined for platform refresh).
      if (businessId && session.business_id !== businessId) {
        throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token')
      }

      return session
    },

    async rotateRefreshToken(oldToken: string, businessId?: string | null): Promise<RefreshTokenResult> {
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

        // Create new session preserving the SAME scope and business context exactly.
        // A tenant session stays tenant; a platform session stays platform with NULL business_id.
        const newSession = await refreshSessionRepository.create(client, {
          userId: session.user_id,
          businessId: session.business_id,
          scope: session.scope,
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

    async revokeSession(sessionId: string, userId: string, businessId: string | null): Promise<void> {
      await withTransaction(pool, async (client) => {
        // NULL-safe: platform sessions (business_id IS NULL) are revoked correctly.
        await refreshSessionRepository.revokeByOwnership(client, sessionId, userId, businessId)
      })
    },

    // Re-read the canonical role for a session at refresh time so that revoked/removed
    // platform roles or tenant memberships are reflected immediately. Throws if the
    // identity no longer holds the required role for the session scope.
    async resolveSessionRole(client: PoolClient, session: RefreshSession): Promise<TokenRole> {
      if (session.scope === 'platform') {
        // Re-read the canonical platform role directly. The role must be read from
        // users.platform_role (snake_case column) so demotion/revocation is reflected
        // immediately on the next refresh.
        const result = await client.query('SELECT platform_role FROM users WHERE id = $1', [session.user_id])
        const platformRole = result.rows[0]?.platform_role
        if (!platformRole) {
          throw new ApiError(403, 'PLATFORM_ACCESS_DENIED', 'Platform role no longer valid')
        }
        return platformRole as TokenRole
      }

      const membership = await userBusinessRepo.findActiveMembership(session.user_id, session.business_id as string)
      if (!membership) {
        throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Access denied to this business')
      }
      return membership.role as TokenRole
    }
  }
}
