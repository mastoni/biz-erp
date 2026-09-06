import path from 'path'
import { randomUUID } from 'crypto'
import { Pool } from 'pg'
import express from 'express'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { hashPassword, verifyPassword } from '../src/services/password_service'
import { createAuthRouter } from '../src/routes/auth_routes'
import { createJwtService } from '../src/services/jwt_service'
import { createRefreshTokenService } from '../src/services/refresh_token_service'
import { MockEmailService } from '../src/services/email_service'
import { createPasswordResetService } from '../src/services/password_reset_service'
import { createUserRepository } from '../src/repositories/user_repository'

const TEST_BUSINESS_ID = '11111111-1111-4111-8111-111111111111'
const JWT_SECRET = 'insecure-test-secret-that-is-at-least-32-chars-long'
const JWT_ISSUER = 'biz-erp-api'
const JWT_AUDIENCE = 'biz-erp-client'

let pool: Pool
let app: express.Express

async function resetDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE
      platform_audit_logs,
      password_reset_tokens,
      user_businesses,
      refresh_tokens,
      users,
      businesses
    RESTART IDENTITY CASCADE
  `)

  await pool.query(
    `
      INSERT INTO businesses (id, name, status)
      VALUES ($1, $2, 'ACTIVE')
      ON CONFLICT (id) DO NOTHING
    `,
    [TEST_BUSINESS_ID, 'Test Business']
  )
}

beforeAll(async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
  }

  pool = createPool(databaseUrl)
  await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))

  app = express()
  app.use(express.json())
  app.use('/v1/auth', createAuthRouter(pool))
})

afterAll(async () => {
  await pool.end()
})

beforeEach(async () => {
  await resetDatabase()
})

describe('AUTH-RECOVERY-3: Tenant Password Management', () => {
  const jwtService = createJwtService(JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE)
  const refreshService = createRefreshTokenService(pool)
  const userRepo = createUserRepository(pool)

  async function createTestUser(email: string, passwordPlain: string, role: 'OWNER' | 'CASHIER' = 'OWNER') {
    const userId = randomUUID()
    const passwordHash = await hashPassword(passwordPlain)

    await pool.query(
      `INSERT INTO users (id, email, password_hash, status)
       VALUES ($1, $2, $3, 'ACTIVE')`,
      [userId, email, passwordHash]
    )

    await pool.query(
      `INSERT INTO user_businesses (user_id, business_id, role, status)
       VALUES ($1, $2, $3, 'ACTIVE')`,
      [userId, TEST_BUSINESS_ID, role]
    )

    const sessionResult = await refreshService.createRefreshSession(userId, TEST_BUSINESS_ID, 'tenant')
    const accessToken = jwtService.signAccessToken({
      sub: userId,
      scope: 'tenant',
      business_id: TEST_BUSINESS_ID,
      role,
      session_id: sessionResult.session.id,
      jti: randomUUID()
    })

    return {
      userId,
      email,
      accessToken,
      session: sessionResult.session,
      refreshToken: sessionResult.refreshToken
    }
  }

  describe('A. Change Password (POST /v1/auth/change-password)', () => {
    it('successfully changes password and updates bcrypt hash', async () => {
      const user = await createTestUser('owner@test.com', 'OldPassword123!')

      // Create a second session to verify it gets revoked
      const session2 = await refreshService.createRefreshSession(user.userId, TEST_BUSINESS_ID, 'tenant')

      const res = await request(app)
        .post('/v1/auth/change-password')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          current_password: 'OldPassword123!',
          new_password: 'NewSecurePassword456!',
          confirmation: 'NewSecurePassword456!'
        })

      expect(res.status).toBe(200)
      expect(res.body.message).toContain('berhasil')

      // Verify new password can be verified with hash in DB
      const updatedUser = await userRepo.findByIdWithPassword(pool, user.userId)
      expect(await verifyPassword('NewSecurePassword456!', updatedUser!.password_hash)).toBe(true)
      expect(await verifyPassword('OldPassword123!', updatedUser!.password_hash)).toBe(false)

      // Verify current session is preserved, but session2 is revoked
      const checkRes1 = await pool.query('SELECT revoked_at FROM refresh_tokens WHERE id = $1', [user.session.id])
      expect(checkRes1.rows[0].revoked_at).toBeNull()

      const checkRes2 = await pool.query('SELECT revoked_at FROM refresh_tokens WHERE id = $1', [session2.session.id])
      expect(checkRes2.rows[0].revoked_at).not.toBeNull()

      // Verify audit log
      const auditRes = await pool.query("SELECT * FROM platform_audit_logs WHERE action = 'USER_PASSWORD_CHANGED'")
      expect(auditRes.rows.length).toBe(1)
      expect(auditRes.rows[0].actor_id).toBe(user.userId)
    })

    it('rejects if current password is wrong', async () => {
      const user = await createTestUser('owner@test.com', 'CorrectOld123!')

      const res = await request(app)
        .post('/v1/auth/change-password')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          current_password: 'WrongPassword!',
          new_password: 'NewSecurePassword456!',
          confirmation: 'NewSecurePassword456!'
        })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('INVALID_CURRENT_PASSWORD')
    })

    it('rejects if confirmation does not match', async () => {
      const user = await createTestUser('owner@test.com', 'OldPassword123!')

      const res = await request(app)
        .post('/v1/auth/change-password')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          current_password: 'OldPassword123!',
          new_password: 'NewSecurePassword456!',
          confirmation: 'DifferentPassword456!'
        })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('PASSWORD_MISMATCH')
    })

    it('rejects if new password is too short (< 8 chars)', async () => {
      const user = await createTestUser('owner@test.com', 'OldPassword123!')

      const res = await request(app)
        .post('/v1/auth/change-password')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          current_password: 'OldPassword123!',
          new_password: 'short',
          confirmation: 'short'
        })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('WEAK_PASSWORD')
    })

    it('rejects unauthenticated requests', async () => {
      const res = await request(app)
        .post('/v1/auth/change-password')
        .send({
          current_password: 'OldPassword123!',
          new_password: 'NewSecurePassword456!',
          confirmation: 'NewSecurePassword456!'
        })

      expect(res.status).toBe(401)
    })
  })

  describe('B. Forgot Password (POST /v1/auth/forgot-password)', () => {
    it('returns generic message for non-existent email (anti-enumeration)', async () => {
      const res = await request(app)
        .post('/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })

      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Jika email terdaftar, instruksi pemulihan kata sandi telah dikirim.')

      // Check no tokens created
      const countRes = await pool.query('SELECT COUNT(*) FROM password_reset_tokens')
      expect(parseInt(countRes.rows[0].count, 10)).toBe(0)
    })

    it('creates reset token and dispatches email for valid user', async () => {
      const user = await createTestUser('tenant@skmnetwork.com', 'Password123!')

      const res = await request(app)
        .post('/v1/auth/forgot-password')
        .send({ email: 'tenant@skmnetwork.com' })

      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Jika email terdaftar, instruksi pemulihan kata sandi telah dikirim.')

      const tokenRows = await pool.query('SELECT * FROM password_reset_tokens WHERE user_id = $1', [user.userId])
      expect(tokenRows.rows.length).toBe(1)
      const tokenRecord = tokenRows.rows[0]
      expect(tokenRecord.token_hash).toBeDefined()
      expect(tokenRecord.token_hash.length).toBe(64) // SHA-256 hex
      expect(tokenRecord.used_at).toBeNull()

      // Expiry is ~15 minutes in future
      const expiresAt = new Date(tokenRecord.expires_at)
      const diffMinutes = (expiresAt.getTime() - Date.now()) / (1000 * 60)
      expect(diffMinutes).toBeGreaterThan(13)
      expect(diffMinutes).toBeLessThanOrEqual(15)

      // Verify audit log
      const auditRes = await pool.query("SELECT * FROM platform_audit_logs WHERE action = 'PASSWORD_RESET_REQUESTED'")
      expect(auditRes.rows.length).toBe(1)
    })

    it('invalidates previous pending tokens when requesting a new one', async () => {
      const user = await createTestUser('tenant2@skmnetwork.com', 'Password123!')

      // First request
      await request(app).post('/v1/auth/forgot-password').send({ email: 'tenant2@skmnetwork.com' })
      // Second request
      await request(app).post('/v1/auth/forgot-password').send({ email: 'tenant2@skmnetwork.com' })

      const tokens = await pool.query('SELECT * FROM password_reset_tokens WHERE user_id = $1 ORDER BY created_at ASC', [user.userId])
      expect(tokens.rows.length).toBe(2)
      // First token marked as used/invalidated
      expect(tokens.rows[0].used_at).not.toBeNull()
      // Second token is active
      expect(tokens.rows[1].used_at).toBeNull()
    })
  })

  describe('C. Reset Password (POST /v1/auth/reset-password)', () => {
    it('resets password with valid token and revokes all active sessions', async () => {
      const user = await createTestUser('reset_user@skmnetwork.com', 'OldPassword123!')
      const session2 = await refreshService.createRefreshSession(user.userId, TEST_BUSINESS_ID, 'tenant')

      const emailService = new MockEmailService()
      const resetService = createPasswordResetService(pool, userRepo, emailService)

      await resetService.requestPasswordReset({ email: 'reset_user@skmnetwork.com' })
      expect(emailService.sentEmails.length).toBe(1)
      const rawToken = emailService.sentEmails[0].resetToken

      const res = await request(app)
        .post('/v1/auth/reset-password')
        .send({
          token: rawToken,
          new_password: 'BrandNewPassword789!',
          confirmation: 'BrandNewPassword789!'
        })

      expect(res.status).toBe(200)
      expect(res.body.message).toContain('berhasil')

      // Verify new password in DB
      const updatedUser = await userRepo.findByIdWithPassword(pool, user.userId)
      expect(await verifyPassword('BrandNewPassword789!', updatedUser!.password_hash)).toBe(true)
      expect(await verifyPassword('OldPassword123!', updatedUser!.password_hash)).toBe(false)

      // Verify token marked used
      const tokenRes = await pool.query('SELECT * FROM password_reset_tokens WHERE user_id = $1', [user.userId])
      expect(tokenRes.rows[0].used_at).not.toBeNull()

      // Verify all old refresh sessions revoked
      const sessions = await pool.query('SELECT * FROM refresh_tokens WHERE user_id = $1', [user.userId])
      for (const s of sessions.rows) {
        expect(s.revoked_at).not.toBeNull()
      }

      // Verify audit log
      const auditRes = await pool.query("SELECT * FROM platform_audit_logs WHERE action = 'PASSWORD_RESET_COMPLETED'")
      expect(auditRes.rows.length).toBe(1)
    })

    it('rejects when token is already used', async () => {
      const user = await createTestUser('used_token@skmnetwork.com', 'OldPassword123!')
      const emailService = new MockEmailService()
      const resetService = createPasswordResetService(pool, userRepo, emailService)

      await resetService.requestPasswordReset({ email: 'used_token@skmnetwork.com' })
      const rawToken = emailService.sentEmails[0].resetToken

      // First use: success
      await request(app)
        .post('/v1/auth/reset-password')
        .send({
          token: rawToken,
          new_password: 'BrandNewPassword789!',
          confirmation: 'BrandNewPassword789!'
        })

      // Second use: reject
      const res = await request(app)
        .post('/v1/auth/reset-password')
        .send({
          token: rawToken,
          new_password: 'AnotherPassword999!',
          confirmation: 'AnotherPassword999!'
        })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('TOKEN_ALREADY_USED')
    })

    it('rejects when token is expired', async () => {
      const user = await createTestUser('expired_token@skmnetwork.com', 'OldPassword123!')
      const emailService = new MockEmailService()
      const resetService = createPasswordResetService(pool, userRepo, emailService)

      await resetService.requestPasswordReset({ email: 'expired_token@skmnetwork.com' })
      const rawToken = emailService.sentEmails[0].resetToken

      // Manually set expires_at in past
      await pool.query("UPDATE password_reset_tokens SET expires_at = now() - interval '1 minute' WHERE user_id = $1", [user.userId])

      const res = await request(app)
        .post('/v1/auth/reset-password')
        .send({
          token: rawToken,
          new_password: 'BrandNewPassword789!',
          confirmation: 'BrandNewPassword789!'
        })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('TOKEN_EXPIRED')
    })

    it('rejects invalid or tampered token', async () => {
      const res = await request(app)
        .post('/v1/auth/reset-password')
        .send({
          token: 'completely-invalid-random-token',
          new_password: 'BrandNewPassword789!',
          confirmation: 'BrandNewPassword789!'
        })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('INVALID_TOKEN')
    })

    it('rejects if new password confirmation mismatches or is weak', async () => {
      const res1 = await request(app)
        .post('/v1/auth/reset-password')
        .send({
          token: 'sometoken',
          new_password: 'password123',
          confirmation: 'mismatch123'
        })
      expect(res1.status).toBe(400)
      expect(res1.body.code).toBe('PASSWORD_MISMATCH')

      const res2 = await request(app)
        .post('/v1/auth/reset-password')
        .send({
          token: 'sometoken',
          new_password: 'short',
          confirmation: 'short'
        })
      expect(res2.status).toBe(400)
      expect(res2.body.code).toBe('WEAK_PASSWORD')
    })
  })
})
