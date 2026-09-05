import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { Pool } from 'pg'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'
import { randomUUID } from 'crypto'
import { hashPassword } from '../src/services/password_service'
import { createJwtService } from '../src/services/jwt_service'
import { Express } from 'express'

const JWT_SECRET = 'insecure-test-secret-that-is-at-least-32-chars-long'
const JWT_ISSUER = 'biz-erp-api'
const JWT_AUDIENCE = 'biz-erp-client'

describe('Phase SA-3.0B-1: Superadmin AI CS Settings & Control API', () => {
  let pool: Pool
  let app: Express
  let jwtService: ReturnType<typeof createJwtService>
  let superAdminToken: string
  let platformAdminToken: string
  let tenantToken: string
  let superAdminId: string

  const TENANT_ID = randomUUID()
  const USER_ID = randomUUID()

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET
    process.env.JWT_ISSUER = JWT_ISSUER
    process.env.JWT_AUDIENCE = JWT_AUDIENCE

    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
    app = createApp(pool)

    jwtService = createJwtService(JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE)
    const hash = await hashPassword('password123')

    // 1. Seed Superadmin User
    superAdminId = randomUUID()
    const superAdminEmail = `superadmin_aics_${Date.now()}@skmnetwork.com`
    await pool.query(
      `INSERT INTO users (id, email, password_hash, status, platform_role)
       VALUES ($1, $2, $3, 'ACTIVE', 'SUPER_ADMIN')`,
      [superAdminId, superAdminEmail, hash]
    )

    const superLogin = await request(app)
      .post('/v1/auth/login')
      .set('x-auth-context', 'platform')
      .send({ email: superAdminEmail, password: 'password123' })

    superAdminToken = superLogin.body.access_token

    // 2. Seed Platform Admin User (non-SUPER_ADMIN)
    const platformAdminId = randomUUID()
    const platformAdminEmail = `admin_aics_${Date.now()}@skmnetwork.com`
    await pool.query(
      `INSERT INTO users (id, email, password_hash, status, platform_role)
       VALUES ($1, $2, $3, 'ACTIVE', 'PLATFORM_ADMIN')`,
      [platformAdminId, platformAdminEmail, hash]
    )

    const adminLogin = await request(app)
      .post('/v1/auth/login')
      .set('x-auth-context', 'platform')
      .send({ email: platformAdminEmail, password: 'password123' })

    platformAdminToken = adminLogin.body.access_token

    // 3. Seed Tenant & User
    const tenantEmail = `owner_aics_${Date.now()}@test.com`
    await pool.query(
      `INSERT INTO users (id, email, password_hash, status)
       VALUES ($1, $2, $3, 'ACTIVE')`,
      [USER_ID, tenantEmail, hash]
    )

    await pool.query(
      `INSERT INTO businesses (id, name, owner_user_id, status)
       VALUES ($1, 'Tenant AI Test', $2, 'ACTIVE')`,
      [TENANT_ID, USER_ID]
    )

    await pool.query(
      `INSERT INTO user_businesses (user_id, business_id, role, status)
       VALUES ($1, $2, 'OWNER', 'ACTIVE')`,
      [USER_ID, TENANT_ID]
    )

    const tenantLogin = await request(app)
      .post('/v1/auth/login')
      .send({ email: tenantEmail, password: 'password123' })

    tenantToken = tenantLogin.body.access_token

    // Reset settings to default before tests
    await pool.query(
      `UPDATE platform_ai_cs_settings
       SET is_enabled = TRUE, human_escalation_enabled = TRUE, updated_at = NOW()
       WHERE id = 'default'`
    )
  })

  afterAll(async () => {
    // Clean up
    await pool.query(
      `UPDATE platform_ai_cs_settings
       SET is_enabled = TRUE, human_escalation_enabled = TRUE, updated_at = NOW()
       WHERE id = 'default'`
    )
    await pool.end()
  })

  describe('1. GET /v1/platform/ai-cs/settings Authorization & Format', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/v1/platform/ai-cs/settings')
      expect(res.status).toBe(401)
    })

    it('rejects tenant users with 403 WRONG_SCOPE', async () => {
      const res = await request(app)
        .get('/v1/platform/ai-cs/settings')
        .set('Authorization', `Bearer ${tenantToken}`)

      expect(res.status).toBe(403)
      expect(res.body.error?.code).toBe('WRONG_SCOPE')
    })

    it('rejects PLATFORM_ADMIN (non-SUPER_ADMIN) with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/v1/platform/ai-cs/settings')
        .set('Authorization', `Bearer ${platformAdminToken}`)

      expect(res.status).toBe(403)
    })

    it('allows SUPER_ADMIN to retrieve authoritative settings and operational health', async () => {
      const res = await request(app)
        .get('/v1/platform/ai-cs/settings')
        .set('Authorization', `Bearer ${superAdminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.settings).toBeDefined()
      expect(res.body.settings.id).toBe('default')
      expect(res.body.settings.is_enabled).toBe(true)
      expect(res.body.settings.provider).toBe('DETERMINISTIC')
      expect(res.body.settings.model).toBe('rule-engine-v1')
      expect(res.body.settings.fallback_behavior).toBe('GENERAL_FAQ')
      expect(res.body.settings.human_escalation_enabled).toBe(true)
      expect(res.body.settings.operational_health).toBe('HEALTHY')
      // Ensure secrets are never exposed
      expect(res.body.settings.api_key).toBeUndefined()
      expect(res.body.settings.secret).toBeUndefined()
    })
  })

  describe('2. PATCH /v1/platform/ai-cs/settings Validation, Persistence & Audit', () => {
    it('rejects invalid payload types with 400 validation error', async () => {
      const res = await request(app)
        .patch('/v1/platform/ai-cs/settings')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ is_enabled: 'not-a-boolean' })

      expect(res.status).toBe(400)
      expect(res.body.error?.code).toBe('VALIDATION_ERROR')
    })

    it('rejects tenant users with 403', async () => {
      const res = await request(app)
        .patch('/v1/platform/ai-cs/settings')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ is_enabled: false })

      expect(res.status).toBe(403)
      expect(res.body.error?.code).toBe('WRONG_SCOPE')
    })

    it('allows SUPER_ADMIN to update settings and logs audit event', async () => {
      const reqId = randomUUID()
      const res = await request(app)
        .patch('/v1/platform/ai-cs/settings')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-request-id', reqId)
        .send({
          is_enabled: false,
          human_escalation_enabled: false,
        })

      expect(res.status).toBe(200)
      expect(res.body.settings.is_enabled).toBe(false)
      expect(res.body.settings.human_escalation_enabled).toBe(false)
      expect(res.body.settings.operational_health).toBe('DEGRADED')

      // Verify persistence in DB
      const dbRes = await pool.query(`SELECT * FROM platform_ai_cs_settings WHERE id = 'default'`)
      expect(dbRes.rows[0].is_enabled).toBe(false)
      expect(dbRes.rows[0].human_escalation_enabled).toBe(false)

      // Verify audit log
      const auditRes = await pool.query(
        `SELECT * FROM platform_audit_logs 
         WHERE action = 'AI_CS_SETTINGS_UPDATED' AND request_id = $1`,
        [reqId]
      )
      expect(auditRes.rows.length).toBe(1)
      const audit = auditRes.rows[0]
      expect(audit.actor_id).toBe(superAdminId)
      expect(audit.actor_scope).toBe('platform')
      expect(audit.actor_role).toBe('SUPER_ADMIN')
      expect(audit.status).toBe('SUCCESS')
      expect(audit.diff).toEqual({
        is_enabled: { before: true, after: false },
        human_escalation_enabled: { before: true, after: false },
      })
    })
  })

  describe('3. Authoritative Enforcement on AI CS Endpoints', () => {
    it('blocks conversation creation and returns AI_CS_DISABLED when is_enabled=false', async () => {
      // Ensure AI CS is disabled
      await pool.query(`UPDATE platform_ai_cs_settings SET is_enabled = FALSE WHERE id = 'default'`)

      const res = await request(app)
        .post('/v1/ai-cs/conversations')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ initial_message: 'Halo AI' })

      expect(res.status).toBe(403)
      expect(res.body.error?.code).toBe('AI_CS_DISABLED')
    })

    it('blocks message sending and returns AI_CS_DISABLED when is_enabled=false', async () => {
      // Temporarily enable to create a conversation
      await pool.query(`UPDATE platform_ai_cs_settings SET is_enabled = TRUE WHERE id = 'default'`)
      const convRes = await request(app)
        .post('/v1/ai-cs/conversations')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({})
      const convId = convRes.body.conversation.id

      // Now disable AI CS
      await pool.query(`UPDATE platform_ai_cs_settings SET is_enabled = FALSE WHERE id = 'default'`)

      const msgRes = await request(app)
        .post(`/v1/ai-cs/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ content: 'Pertanyaan saya' })

      expect(msgRes.status).toBe(403)
      expect(msgRes.body.error?.code).toBe('AI_CS_DISABLED')
    })

    it('blocks manual escalation and returns AI_ESCALATION_DISABLED when human_escalation_enabled=false', async () => {
      // Enable AI CS but disable human escalation
      await pool.query(
        `UPDATE platform_ai_cs_settings 
         SET is_enabled = TRUE, human_escalation_enabled = FALSE 
         WHERE id = 'default'`
      )

      const convRes = await request(app)
        .post('/v1/ai-cs/conversations')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({})
      const convId = convRes.body.conversation.id

      const escRes = await request(app)
        .post(`/v1/ai-cs/conversations/${convId}/escalate`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ subject: 'Tolong bantu' })

      expect(escRes.status).toBe(403)
      expect(escRes.body.error?.code).toBe('AI_ESCALATION_DISABLED')
    })

    it('restores normal operation when is_enabled=true and human_escalation_enabled=true', async () => {
      await pool.query(
        `UPDATE platform_ai_cs_settings 
         SET is_enabled = TRUE, human_escalation_enabled = TRUE 
         WHERE id = 'default'`
      )

      const convRes = await request(app)
        .post('/v1/ai-cs/conversations')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ initial_message: 'Halo kembali' })

      expect(convRes.status).toBe(201)
      const convId = convRes.body.conversation.id

      const msgRes = await request(app)
        .post(`/v1/ai-cs/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ content: 'Halo apa kabar' })

      if (msgRes.status !== 200) {
        console.error('msgRes error:', msgRes.body)
      }
      expect(msgRes.status).toBe(200)
      expect(msgRes.body.message).toBeDefined()
    })
  })
})
