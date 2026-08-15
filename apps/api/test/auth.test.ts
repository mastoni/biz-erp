import path from 'path'
import { randomUUID } from 'crypto'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { hashPassword, verifyPassword } from '../src/services/password_service'
import { createUserRepository } from '../src/repositories/user_repository'
import { createUserBusinessRepository } from '../src/repositories/user_business_repository'
import { createAuthService } from '../src/services/auth_service'
import { ApiError } from '../src/errors/api_error'

const BUSINESS_A = '11111111-1111-4111-8111-111111111111'
const BUSINESS_B = '22222222-2222-4222-8222-222222222222'

let pool!: Pool

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
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await resetDatabase()
})

describe('Phase 4.0.2 Auth Service Foundation', () => {
  it('AUTH-S001 hash password and verify correct password', async () => {
    const password = 'mySecretPassword123'
    const hash = await hashPassword(password)
    const isValid = await verifyPassword(password, hash)
    
    expect(hash).not.toBe(password)
    expect(isValid).toBe(true)
  })

  it('AUTH-S002 wrong password fails', async () => {
    const password = 'mySecretPassword123'
    const hash = await hashPassword(password)
    const isValid = await verifyPassword('wrongpassword', hash)
    
    expect(isValid).toBe(false)
  })

  it('AUTH-S003 same plaintext produces valid bcrypt hash', async () => {
    const password = 'mySecretPassword123'
    const hash1 = await hashPassword(password)
    const hash2 = await hashPassword(password)
    
    expect(hash1).not.toBe(hash2)
    const isValid1 = await verifyPassword(password, hash1)
    const isValid2 = await verifyPassword(password, hash2)
    
    expect(isValid1).toBe(true)
    expect(isValid2).toBe(true)
  })

  describe('AuthService Integration', () => {
    let authService: ReturnType<typeof createAuthService>
    let userRepo: ReturnType<typeof createUserRepository>
    let ubRepo: ReturnType<typeof createUserBusinessRepository>

    beforeEach(() => {
      userRepo = createUserRepository(pool)
      ubRepo = createUserBusinessRepository(pool)
      authService = createAuthService(userRepo, ubRepo)
    })

    async function seedUser(email: string, passwordHash: string, status: string = 'ACTIVE'): Promise<string> {
      const id = randomUUID()
      await pool.query(
        'INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)',
        [id, email, passwordHash, status]
      )
      return id
    }

    async function seedMembership(userId: string, businessId: string, role: string = 'OWNER', status: string = 'ACTIVE'): Promise<void> {
      await pool.query(
        'INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, $3, $4)',
        [userId, businessId, role, status]
      )
    }

    it('AUTH-S004 unknown user returns INVALID_CREDENTIALS', async () => {
      await expect(authService.authenticateCredentials('unknown@test.com', 'pass123')).rejects.toThrowError(
        new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
      )
    })

    it('AUTH-S005 suspended user cannot authenticate', async () => {
      const hash = await hashPassword('pass123')
      await seedUser('suspended@test.com', hash, 'SUSPENDED')

      await expect(authService.authenticateCredentials('suspended@test.com', 'pass123')).rejects.toThrowError(
        new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
      )
    })

    it('AUTH-S006 active user with active business membership succeeds', async () => {
      const hash = await hashPassword('pass123')
      const userId = await seedUser('active@test.com', hash, 'ACTIVE')
      await seedMembership(userId, BUSINESS_A, 'OWNER', 'ACTIVE')

      const result = await authService.authenticateCredentials('active@test.com', 'pass123', BUSINESS_A)
      
      expect(result.user.id).toBe(userId)
      expect(result.user.email).toBe('active@test.com')
      expect((result.user as any).password_hash).toBeUndefined()
      
      expect(result.membership).toBeDefined()
      expect(result.membership?.business_id).toBe(BUSINESS_A)
    })

    it('AUTH-S007 user without business membership gets BUSINESS_ACCESS_DENIED', async () => {
      const hash = await hashPassword('pass123')
      await seedUser('nobusiness@test.com', hash, 'ACTIVE')

      await expect(authService.authenticateCredentials('nobusiness@test.com', 'pass123', BUSINESS_A)).rejects.toThrowError(
        new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Access denied to this business')
      )
    })

    it('AUTH-S008 revoked membership gets BUSINESS_ACCESS_DENIED', async () => {
      const hash = await hashPassword('pass123')
      const userId = await seedUser('revoked@test.com', hash, 'ACTIVE')
      await seedMembership(userId, BUSINESS_A, 'CASHIER', 'REVOKED')

      await expect(authService.authenticateCredentials('revoked@test.com', 'pass123', BUSINESS_A)).rejects.toThrowError(
        new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Access denied to this business')
      )
    })

    it('AUTH-S009 password hash is never exposed by public user model/DTO', async () => {
      const hash = await hashPassword('pass123')
      const userId = await seedUser('dto@test.com', hash, 'ACTIVE')

      const result = await authService.authenticateCredentials('dto@test.com', 'pass123')
      
      expect(result.user).toBeDefined()
      expect(result.user.id).toBe(userId)
      expect(result.user.email).toBe('dto@test.com')
      
      // Explicitly verify password_hash is not present
      expect((result.user as any).password_hash).toBeUndefined()
    })
  })
})
