import path from 'path'
import { randomUUID } from 'crypto'
import { Pool, PoolClient } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { createRefreshTokenService } from '../src/services/refresh_token_service'
import { ApiError } from '../src/errors/api_error'

// Phase 4.1.41B-4b: Refresh Session Repository / Service implementation.
// Exercises the repository + service layer only (no HTTP / login issuance).
// Covers: nullable business_id platform sessions, scope preservation on rotation,
// NULL-safe revocation, and role re-derivation at refresh time.

const BUSINESS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

let pool!: Pool
let refreshTokenService!: ReturnType<typeof createRefreshTokenService>

async function resetDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE
      user_businesses,
      refresh_tokens,
      users,
      businesses
    RESTART IDENTITY CASCADE
  `)
  await pool.query(
    `INSERT INTO businesses (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
    [BUSINESS, 'Business A']
  )
}

beforeAll(async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set for integration tests')
  }
  pool = createPool(databaseUrl)
  await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
  refreshTokenService = createRefreshTokenService(pool)
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await resetDatabase()
})

async function seedPlatformUser(platformRole: 'PLATFORM_ADMIN' | 'SUPER_ADMIN' | null): Promise<string> {
  const id = randomUUID()
  await pool.query(
    'INSERT INTO users (id, email, password_hash, status, platform_role) VALUES ($1, $2, $3, $4, $5)',
    [id, `${id}@test.com`, 'hash', 'ACTIVE', platformRole]
  )
  return id
}

async function seedTenantUser(role: 'OWNER' | 'CASHIER'): Promise<string> {
  const id = randomUUID()
  await pool.query(
    'INSERT INTO users (id, email, password_hash, status, platform_role) VALUES ($1, $2, $3, $4, $5)',
    [id, `${id}@test.com`, 'hash', 'ACTIVE', null]
  )
  await pool.query(
    `INSERT INTO user_businesses (user_id, business_id, role, status)
     VALUES ($1, $2, $3, 'ACTIVE')`,
    [id, BUSINESS, role]
  )
  return id
}

describe('Phase 4.1.41B-4b Refresh Session Repository/Service', () => {
  it('RSVC-001 createRefreshSession platform stores NULL business_id + scope=platform', async () => {
    const userId = await seedPlatformUser('PLATFORM_ADMIN')
    const { session } = await refreshTokenService.createRefreshSession(userId, null, 'platform', 'dev-1')

    expect(session.scope).toBe('platform')
    expect(session.business_id).toBeNull()

    const r = await pool.query('SELECT business_id, scope FROM refresh_tokens WHERE id = $1', [session.id])
    expect(r.rows[0].business_id).toBeNull()
    expect(r.rows[0].scope).toBe('platform')
  })

  it('RSVC-002 createRefreshSession tenant default keeps business_id + scope=tenant', async () => {
    const userId = await seedTenantUser('OWNER')
    const { session } = await refreshTokenService.createRefreshSession(userId, BUSINESS, 'tenant', 'dev-2')

    expect(session.scope).toBe('tenant')
    expect(session.business_id).toBe(BUSINESS)

    const r = await pool.query('SELECT business_id, scope FROM refresh_tokens WHERE id = $1', [session.id])
    expect(r.rows[0].business_id).toBe(BUSINESS)
    expect(r.rows[0].scope).toBe('tenant')
  })

  it('RSVC-003 rotateRefreshToken preserves platform scope + NULL business_id (never flips)', async () => {
    const userId = await seedPlatformUser('SUPER_ADMIN')
    const { refreshToken: oldToken, session: oldSession } = await refreshTokenService.createRefreshSession(
      userId,
      null,
      'platform',
      'dev-3'
    )

    const { refreshToken: newToken, session: newSession } = await refreshTokenService.rotateRefreshToken(oldToken)

    expect(newSession.scope).toBe('platform')
    expect(newSession.business_id).toBeNull()
    expect(newToken).not.toBe(oldToken)

    // Old session revoked.
    const old = await pool.query('SELECT revoked_at FROM refresh_tokens WHERE id = $1', [oldSession.id])
    expect(old.rows[0].revoked_at).not.toBeNull()
  })

  it('RSVC-004 rotateRefreshToken preserves tenant scope + business_id', async () => {
    const userId = await seedTenantUser('OWNER')
    const { refreshToken: oldToken } = await refreshTokenService.createRefreshSession(userId, BUSINESS, 'tenant')

    const { session: newSession } = await refreshTokenService.rotateRefreshToken(oldToken)

    expect(newSession.scope).toBe('tenant')
    expect(newSession.business_id).toBe(BUSINESS)
  })

  it('RSVC-005 validateRefreshToken tolerates NULL business_id for platform session', async () => {
    const userId = await seedPlatformUser('PLATFORM_ADMIN')
    const { refreshToken } = await refreshTokenService.createRefreshSession(userId, null, 'platform')

    const client: PoolClient = await pool.connect()
    try {
      const session = await refreshTokenService.validateRefreshToken(client, refreshToken)
      expect(session.scope).toBe('platform')
      expect(session.business_id).toBeNull()
    } finally {
      client.release()
    }
  })

  it('RSVC-006 resolveSessionRole re-derives platform role from users.platform_role', async () => {
    const userId = await seedPlatformUser('SUPER_ADMIN')
    const { session } = await refreshTokenService.createRefreshSession(userId, null, 'platform')

    const client: PoolClient = await pool.connect()
    try {
      const role = await refreshTokenService.resolveSessionRole(client, session)
      expect(role).toBe('SUPER_ADMIN')
    } finally {
      client.release()
    }
  })

  it('RSVC-007 resolveSessionRole throws PLATFORM_ACCESS_DENIED when platform_role removed', async () => {
    const userId = await seedPlatformUser('PLATFORM_ADMIN')
    const { session } = await refreshTokenService.createRefreshSession(userId, null, 'platform')

    // Demote / remove platform identity after session creation.
    await pool.query('UPDATE users SET platform_role = NULL WHERE id = $1', [userId])

    const client: PoolClient = await pool.connect()
    try {
      await expect(refreshTokenService.resolveSessionRole(client, session)).rejects.toThrowError(
        new ApiError(403, 'PLATFORM_ACCESS_DENIED', 'Platform role no longer valid')
      )
    } finally {
      client.release()
    }
  })

  it('RSVC-008 resolveSessionRole re-derives tenant role from active membership', async () => {
    const userId = await seedTenantUser('CASHIER')
    const { session } = await refreshTokenService.createRefreshSession(userId, BUSINESS, 'tenant')

    const client: PoolClient = await pool.connect()
    try {
      const role = await refreshTokenService.resolveSessionRole(client, session)
      expect(role).toBe('CASHIER')
    } finally {
      client.release()
    }
  })

  it('RSVC-009 resolveSessionRole throws BUSINESS_ACCESS_DENIED when membership revoked', async () => {
    const userId = await seedTenantUser('OWNER')
    const { session } = await refreshTokenService.createRefreshSession(userId, BUSINESS, 'tenant')

    await pool.query("UPDATE user_businesses SET status = 'REVOKED' WHERE user_id = $1 AND business_id = $2", [
      userId,
      BUSINESS
    ])

    const client: PoolClient = await pool.connect()
    try {
      await expect(refreshTokenService.resolveSessionRole(client, session)).rejects.toThrowError(
        new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Access denied to this business')
      )
    } finally {
      client.release()
    }
  })

  it('RSVC-010 revokeSession NULL-safe revokes platform (NULL business_id) session', async () => {
    const userId = await seedPlatformUser('PLATFORM_ADMIN')
    const { session } = await refreshTokenService.createRefreshSession(userId, null, 'platform')

    await refreshTokenService.revokeSession(session.id, userId, null)

    const r = await pool.query('SELECT revoked_at FROM refresh_tokens WHERE id = $1', [session.id])
    expect(r.rows[0].revoked_at).not.toBeNull()
  })

  it('RSVC-011 revokeSession keeps tenant session untouched by platform revoke call', async () => {
    const platformUserId = await seedPlatformUser('PLATFORM_ADMIN')
    const tenantUserId = await seedTenantUser('OWNER')
    const { session: platformSession } = await refreshTokenService.createRefreshSession(platformUserId, null, 'platform')
    const { session: tenantSession } = await refreshTokenService.createRefreshSession(tenantUserId, BUSINESS, 'tenant')

    // Platform-scoped revoke must NOT revoke the tenant session.
    await refreshTokenService.revokeSession(platformSession.id, platformUserId, null)

    const tenant = await pool.query('SELECT revoked_at FROM refresh_tokens WHERE id = $1', [tenantSession.id])
    expect(tenant.rows[0].revoked_at).toBeNull()
  })
})
