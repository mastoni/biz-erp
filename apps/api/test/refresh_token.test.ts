import path from 'path'
import { randomUUID } from 'crypto'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { createRefreshTokenService } from '../src/services/refresh_token_service'
import { ApiError } from '../src/errors/api_error'

const BUSINESS_A = '11111111-1111-4111-8111-111111111111'
const BUSINESS_B = '22222222-2222-4222-8222-222222222222'

let pool!: Pool
let refreshTokenService!: ReturnType<typeof createRefreshTokenService>

async function resetDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE
      user_businesses,
      refresh_tokens,
      users,
      sale_items,
      sales,
      idempotency_keys,
      products,
      businesses
    RESTART IDENTITY CASCADE
  `)

  await pool.query(
    `
      INSERT INTO businesses (id, name)
      VALUES ($1, $2), ($3, $4)
      ON CONFLICT (id) DO NOTHING
    `,
    [BUSINESS_A, 'Business A', BUSINESS_B, 'Business B']
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

describe('Phase 4.0.4 Refresh Token Service', () => {
  let userId: string

  beforeEach(async () => {
    userId = randomUUID()
    await pool.query(
      'INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)',
      [userId, 'test@test.com', 'dummyhash', 'ACTIVE']
    )
  })

  it('AUTH-R001 create refresh session', async () => {
    const { refreshToken, session } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A, 'device-123')
    
    expect(refreshToken).toBeDefined()
    expect(session).toBeDefined()
    expect(session.user_id).toBe(userId)
    expect(session.business_id).toBe(BUSINESS_A)
    expect(session.device_id).toBe('device-123')
    expect(session.revoked_at).toBeNull()
  })

  it('AUTH-R002 stored database value is hash, not raw token', async () => {
    const { refreshToken, session } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)
    
    const dbResult = await pool.query('SELECT token_hash FROM refresh_tokens WHERE id = $1', [session.id])
    const storedHash = dbResult.rows[0].token_hash
    
    expect(storedHash).not.toBe(refreshToken)
    expect(storedHash).toBe(refreshTokenService.hashToken(refreshToken))
  })

  it('AUTH-R003 valid refresh token validates', async () => {
    const { refreshToken } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)
    
    const client = await pool.connect()
    try {
      const session = await refreshTokenService.validateRefreshToken(client, refreshToken, BUSINESS_A)
      expect(session).toBeDefined()
    } finally {
      client.release()
    }
  })

  it('AUTH-R004 expired refresh token rejected', async () => {
    const { refreshToken, session } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)
    
    // Manually expire it in DB
    await pool.query('UPDATE refresh_tokens SET expires_at = now() - interval \'1 day\' WHERE id = $1', [session.id])
    
    const client = await pool.connect()
    try {
      await expect(refreshTokenService.validateRefreshToken(client, refreshToken, BUSINESS_A)).rejects.toThrowError(
        new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token')
      )
    } finally {
      client.release()
    }
  })

  it('AUTH-R005 revoked refresh token rejected', async () => {
    const { refreshToken } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)
    
    await refreshTokenService.revokeRefreshToken(refreshToken)
    
    const client = await pool.connect()
    try {
      await expect(refreshTokenService.validateRefreshToken(client, refreshToken, BUSINESS_A)).rejects.toThrowError(
        new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token')
      )
    } finally {
      client.release()
    }
  })

  it('AUTH-R006 successful rotation creates new token', async () => {
    const { refreshToken: oldToken } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)
    
    const { refreshToken: newToken, session } = await refreshTokenService.rotateRefreshToken(oldToken, BUSINESS_A)
    
    expect(newToken).toBeDefined()
    expect(newToken).not.toBe(oldToken)
    expect(session).toBeDefined()
  })

  it('AUTH-R007 old refresh token becomes invalid after rotation', async () => {
    const { refreshToken: oldToken } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)
    
    await refreshTokenService.rotateRefreshToken(oldToken, BUSINESS_A)
    
    const client = await pool.connect()
    try {
      await expect(refreshTokenService.validateRefreshToken(client, oldToken, BUSINESS_A)).rejects.toThrowError(
        new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token')
      )
    } finally {
      client.release()
    }
  })

  it('AUTH-R008 new refresh token validates', async () => {
    const { refreshToken: oldToken } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)
    const { refreshToken: newToken } = await refreshTokenService.rotateRefreshToken(oldToken, BUSINESS_A)
    
    const client = await pool.connect()
    try {
      const session = await refreshTokenService.validateRefreshToken(client, newToken, BUSINESS_A)
      expect(session).toBeDefined()
    } finally {
      client.release()
    }
  })

  it('AUTH-R009 same old token reuse returns INVALID_REFRESH_TOKEN', async () => {
    const { refreshToken: oldToken } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)
    await refreshTokenService.rotateRefreshToken(oldToken, BUSINESS_A)
    
    await expect(refreshTokenService.rotateRefreshToken(oldToken, BUSINESS_A)).rejects.toThrowError(
      new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token')
    )
  })

  it('AUTH-R010 business binding preserved', async () => {
    const { refreshToken } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)
    
    const client = await pool.connect()
    try {
      await expect(refreshTokenService.validateRefreshToken(client, refreshToken, BUSINESS_B)).rejects.toThrowError(
        new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token')
      )
    } finally {
      client.release()
    }
  })

  it('AUTH-R011 unknown token rejected', async () => {
    const client = await pool.connect()
    try {
      await expect(refreshTokenService.validateRefreshToken(client, 'unknown-token', BUSINESS_A)).rejects.toThrowError(
        new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token')
      )
    } finally {
      client.release()
    }
  })

  it('AUTH-R012 rotation is atomic', async () => {
    const { refreshToken: oldToken } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)
    
    // Attempt concurrent rotation
    const results = await Promise.allSettled([
      refreshTokenService.rotateRefreshToken(oldToken, BUSINESS_A),
      refreshTokenService.rotateRefreshToken(oldToken, BUSINESS_A)
    ])
    
    // One should fulfill, one should reject
    const fulfilled = results.filter(r => r.status === 'fulfilled')
    const rejected = results.filter(r => r.status === 'rejected')
    
    expect(fulfilled.length).toBe(1)
    expect(rejected.length).toBe(1)
    
    if (rejected[0].status === 'rejected') {
      expect(rejected[0].reason.message).toContain('Invalid refresh token')
    }
  })

  it('AUTH-R013 no raw token appears in logs', async () => {
    // Overwrite console log to spy
    let logged = false
    const originalLog = console.log
    console.log = (msg: string) => {
      logged = true
    }
    
    const { refreshToken } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A)
    await refreshTokenService.rotateRefreshToken(refreshToken, BUSINESS_A)
    
    console.log = originalLog
    expect(logged).toBe(false)
  })

  it('AUTH-R014 device_id/session_id preserved', async () => {
    const { refreshToken: oldToken, session: oldSession } = await refreshTokenService.createRefreshSession(userId, BUSINESS_A, 'my-device')
    const { session: newSession } = await refreshTokenService.rotateRefreshToken(oldToken, BUSINESS_A)
    
    expect(newSession.device_id).toBe('my-device')
    expect(newSession.user_id).toBe(oldSession.user_id)
  })
})
