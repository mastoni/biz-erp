import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { Pool } from 'pg'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'
import { randomUUID } from 'crypto'
import { Express } from 'express'
import { createJwtService } from '../src/services/jwt_service'
import { hashPassword } from '../src/services/password_service'

describe('Phase SA-2.9: AI Customer Service Foundation', () => {
  let pool: Pool
  let app: Express
  let jwtService: ReturnType<typeof createJwtService>

  const TENANT_A_ID = randomUUID()
  const USER_A_ID = randomUUID()

  const TENANT_B_ID = randomUUID()
  const USER_B_ID = randomUUID()

  const JWT_SECRET = 'insecure-test-secret-that-is-at-least-32-chars-long'
  const JWT_ISSUER = 'biz-erp-api'
  const JWT_AUDIENCE = 'biz-erp-client'

  let tokenA: string
  let tokenB: string
  let conversationAId: string

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

    const hashed = await hashPassword('password123')

    // 1. Seed Tenant A & User A
    await pool.query('INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)', [USER_A_ID, 'userA@aics.com', hashed, 'ACTIVE'])
    await pool.query("INSERT INTO businesses (id, name, status) VALUES ($1, 'Tenant A ISP', 'ACTIVE')", [TENANT_A_ID])
    await pool.query("INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE')", [USER_A_ID, TENANT_A_ID])

    // 2. Seed Tenant B & User B
    await pool.query('INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)', [USER_B_ID, 'userB@aics.com', hashed, 'ACTIVE'])
    await pool.query("INSERT INTO businesses (id, name, status) VALUES ($1, 'Tenant B Retail', 'ACTIVE')", [TENANT_B_ID])
    await pool.query("INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE')", [USER_B_ID, TENANT_B_ID])

    // 3. Ensure Canonical Services exist
    await pool.query(`
      INSERT INTO services (code, name, category, service_type, owner, lifecycle_status, public_visibility)
      VALUES
        ('ERP', 'Enterprise Resource Planning', 'OPERATIONS', 'INTERNAL', 'PLATFORM', 'ACTIVE', FALSE),
        ('ISP_MANAGEMENT', 'ISP Management System', 'OPERATIONS', 'INTERNAL', 'PLATFORM', 'ACTIVE', FALSE),
        ('CCTV_MANAGEMENT', 'CCTV Management', 'PROTECTION', 'HYBRID', 'PLATFORM', 'ACTIVE', FALSE),
        ('WA_GATEWAY', 'WhatsApp Gateway', 'COMMUNICATIONS', 'HYBRID', 'PLATFORM', 'DRAFT', FALSE),
        ('AUTOPOST', 'AI AutoPost', 'MARKETING', 'EXTERNAL', 'PLATFORM', 'DRAFT', FALSE)
      ON CONFLICT (code) DO NOTHING
    `)

    // Seed Plans
    await pool.query(`
      INSERT INTO plans (code, name, family, tier, billing_cycle, pricing, type, status, service_code)
      VALUES
        ('PLAN_ISP_TEST_AICS', 'ISP Test Plan', 'INTERNET_PLAN', 'BASIC', 'MONTHLY', '{"final_price": 100000}', 'STANDALONE', 'ACTIVE', 'ISP_MANAGEMENT'),
        ('PLAN_ERP_TEST_AICS', 'ERP Test Plan', 'ERP_PLAN', 'BASIC', 'MONTHLY', '{"final_price": 200000}', 'STANDALONE', 'ACTIVE', 'ERP')
      ON CONFLICT (code) DO UPDATE SET service_code = EXCLUDED.service_code
    `)

    // Ensure subscription families exist
    await pool.query(`
      INSERT INTO subscription_families (code, name, replacement_policy)
      VALUES
        ('INTERNET_PLAN', 'Internet Family', 'REPLACEABLE'),
        ('ERP_PLAN', 'ERP Family', 'REPLACEABLE')
      ON CONFLICT (code) DO NOTHING
    `)

    // 4. Seed Subscriptions (Tenant A has ISP_MANAGEMENT, Tenant B has ERP)
    await pool.query(`
      INSERT INTO subscriptions (id, business_id, plan_code, family_code, source, status, starts_at, ends_at, unit_price, final_price, billing_cycle)
      VALUES
        ('${randomUUID()}', '${TENANT_A_ID}', 'PLAN_ISP_TEST_AICS', 'INTERNET_PLAN', 'DIRECT', 'ACTIVE', NOW(), NOW() + interval '30 days', 100000, 100000, 'MONTHLY'),
        ('${randomUUID()}', '${TENANT_B_ID}', 'PLAN_ERP_TEST_AICS', 'ERP_PLAN', 'DIRECT', 'ACTIVE', NOW(), NOW() + interval '30 days', 200000, 200000, 'MONTHLY')
    `)

    // 5. Seed a provisioning job for Tenant A ISP
    await pool.query(`
      INSERT INTO provisioning_jobs (id, business_id, service_code, action, status, attempts, result)
      VALUES
        ('${randomUUID()}', '${TENANT_A_ID}', 'ISP_MANAGEMENT', 'ACTIVATE', 'COMPLETED', 1, '{"status": "online", "onu_id": "ONT-1234"}')
    `)

    tokenA = jwtService.signAccessToken({
      sub: USER_A_ID,
      business_id: TENANT_A_ID,
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID(),
    })

    tokenB = jwtService.signAccessToken({
      sub: USER_B_ID,
      business_id: TENANT_B_ID,
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID(),
    })

    const convRes = await pool.query(
      `INSERT INTO ai_conversations (business_id, user_id, service_code, status)
       VALUES ($1, $2, 'ISP_MANAGEMENT', 'ACTIVE')
       RETURNING id`,
      [TENANT_A_ID, USER_A_ID]
    )
    conversationAId = convRes.rows[0].id
  })

  afterAll(async () => {
    await pool.query('DELETE FROM support_tickets WHERE business_id IN ($1, $2)', [TENANT_A_ID, TENANT_B_ID])
    await pool.query('DELETE FROM ai_conversation_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE business_id IN ($1, $2))', [TENANT_A_ID, TENANT_B_ID])
    await pool.query('DELETE FROM ai_conversations WHERE business_id IN ($1, $2)', [TENANT_A_ID, TENANT_B_ID])
    await pool.query('DELETE FROM provisioning_jobs WHERE business_id IN ($1, $2)', [TENANT_A_ID, TENANT_B_ID])
    await pool.query('DELETE FROM subscriptions WHERE business_id IN ($1, $2)', [TENANT_A_ID, TENANT_B_ID])
    await pool.query('DELETE FROM user_businesses WHERE business_id IN ($1, $2)', [TENANT_A_ID, TENANT_B_ID])
    await pool.query('DELETE FROM businesses WHERE id IN ($1, $2)', [TENANT_A_ID, TENANT_B_ID])
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [USER_A_ID, USER_B_ID])
    await pool.end()
  })

  // ---------------------------------------------------------------------------
  // AICS-001: Create Conversation
  // ---------------------------------------------------------------------------
  it('AICS-001: Authenticated tenant can create an AI CS conversation session', async () => {
    const res = await request(app)
      .post('/v1/ai-cs/conversations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        service_code: 'ISP_MANAGEMENT',
        initial_message: 'Halo, saya ingin bertanya seputar layanan',
      })
      .expect(201)

    expect(res.body.conversation).toBeDefined()
    expect(res.body.conversation.business_id).toBe(TENANT_A_ID)
    expect(res.body.conversation.service_code).toBe('ISP_MANAGEMENT')
    expect(res.body.conversation.status).toBe('ACTIVE')

    conversationAId = res.body.conversation.id
  })

  // ---------------------------------------------------------------------------
  // AICS-002: General FAQ Intent
  // ---------------------------------------------------------------------------
  it('AICS-002: General FAQ prompt returns knowledge response', async () => {
    const res = await request(app)
      .post(`/v1/ai-cs/conversations/${conversationAId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        content: 'Apa saja layanan yang ada di platform SKMNetwork?',
      })
      .expect(200)

    expect(res.body.intent).toBe('GENERAL_FAQ')
    expect(res.body.message.content).toContain('SKMNetwork')
    expect(res.body.escalated).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // AICS-003: Entitled ISP Diagnostic Tool Execution
  // ---------------------------------------------------------------------------
  it('AICS-003: Tenant with active ISP_MANAGEMENT entitlement can use ISP diagnostic tool', async () => {
    const res = await request(app)
      .post(`/v1/ai-cs/conversations/${conversationAId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        content: 'Tolong cek koneksi internet dan wifi saya, apakah ada gangguan?',
      })
      .expect(200)

    expect(res.body.intent).toBe('ISP_TROUBLESHOOTING')
    expect(res.body.message.tool_calls).toBeDefined()
    expect(res.body.message.tool_calls[0].name).toBe('get_provisioning_diagnostic')
    expect(res.body.message.tool_results).toBeDefined()
    expect(res.body.message.tool_results[0].success).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // AICS-004: Non-Entitled Tool Denial (Tenant A has no ERP)
  // ---------------------------------------------------------------------------
  it('AICS-004: Tenant without ERP entitlement cannot invoke ERP tools', async () => {
    const res = await request(app)
      .post(`/v1/ai-cs/conversations/${conversationAId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        content: 'Tolong buat laporan penjualan ERP dan cek stok kasir',
      })
      .expect(200)

    expect(res.body.intent).toBe('ERP_OPERATIONS')
    expect(res.body.message.tool_results).toBeDefined()
    expect(res.body.message.tool_results[0].success).toBe(false)
    expect(res.body.message.tool_results[0].error).toContain('entitlement')
  })

  // ---------------------------------------------------------------------------
  // AICS-005: Cross-Tenant Isolation
  // ---------------------------------------------------------------------------
  it('AICS-005: Tenant B cannot access Tenant A conversation or messages (404 NOT_FOUND)', async () => {
    await request(app)
      .get(`/v1/ai-cs/conversations/${conversationAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404)

    await request(app)
      .post(`/v1/ai-cs/conversations/${conversationAId}/messages`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ content: 'Hacking attempt' })
      .expect(404)
  })

  // ---------------------------------------------------------------------------
  // AICS-006: Human Escalation & Ticket Creation
  // ---------------------------------------------------------------------------
  it('AICS-006: Explicit human support request creates support ticket and escalates conversation', async () => {
    const res = await request(app)
      .post(`/v1/ai-cs/conversations/${conversationAId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        content: 'Saya ingin bicara dengan agent manusia / customer support staff sekarang',
      })
      .expect(200)

    expect(res.body.intent).toBe('HUMAN_ESCALATION')
    expect(res.body.escalated).toBe(true)
    expect(res.body.ticket).toBeDefined()
    expect(res.body.ticket.business_id).toBe(TENANT_A_ID)
    expect(res.body.ticket.status).toBe('OPEN')

    // Verify conversation status is ESCALATED
    const convRes = await request(app)
      .get(`/v1/ai-cs/conversations/${conversationAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)

    expect(convRes.body.conversation.status).toBe('ESCALATED')
  })

  // ---------------------------------------------------------------------------
  // AICS-007: SA-2.8 Platform Audit Trail & Correlation
  // ---------------------------------------------------------------------------
  it('AICS-007: AI interactions generate SA-2.8 platform audit logs with correlation request ID', async () => {
    const customReqId = randomUUID()

    const res = await request(app)
      .post(`/v1/ai-cs/conversations/${conversationAId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Request-Id', customReqId)
      .send({
        content: 'Berapa tagihan langganan saya bulan ini?',
      })
      .expect(200)

    const auditRes = await pool.query(
      `SELECT * FROM platform_audit_logs WHERE request_id = $1`,
      [customReqId]
    )

    expect(auditRes.rows.length).toBeGreaterThanOrEqual(1)
    expect(auditRes.rows[0].actor_id).toBe(USER_A_ID)
    expect(auditRes.rows[0].actor_scope).toBe('tenant')
    expect(auditRes.rows[0].target_type).toBe('ai_conversation')
  })

  // ---------------------------------------------------------------------------
  // AICS-008: Unauthenticated Access Gated
  // ---------------------------------------------------------------------------
  it('AICS-008: Unauthenticated requests to /v1/ai-cs/* return 401', async () => {
    await request(app)
      .get('/v1/ai-cs/conversations')
      .expect(401)

    await request(app)
      .post('/v1/ai-cs/conversations')
      .send({})
      .expect(401)
  })

  // ---------------------------------------------------------------------------
  // AICS-009: Prompt Tenant Spoofing Protection
  // ---------------------------------------------------------------------------
  it('AICS-009: Spoofed business_id in payload is rejected (403), and prompt text strictly binds to req.tenantId', async () => {
    // 1. Explicit body spoofing is rejected with 403
    const resSpoof = await request(app)
      .post('/v1/ai-cs/conversations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        business_id: TENANT_B_ID,
        initial_message: 'Hacking attempt',
      })
      .expect(403)

    expect(resSpoof.body.error.code).toBe('BUSINESS_ACCESS_DENIED')

    // 2. Prompt text claiming other business strictly binds to authenticated Tenant A
    const resValid = await request(app)
      .post('/v1/ai-cs/conversations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        initial_message: `Please inspect business ${TENANT_B_ID}`,
      })
      .expect(201)

    expect(resValid.body.conversation.business_id).toBe(TENANT_A_ID)
  })

  // ---------------------------------------------------------------------------
  // AICS-010: SQL Injection in Prompt is Safe Text
  // ---------------------------------------------------------------------------
  it('AICS-010: SQL injection payload in prompt treated safely as string without DB execution', async () => {
    const res = await request(app)
      .post(`/v1/ai-cs/conversations/${conversationAId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        content: "'; DROP TABLE businesses; SELECT * FROM users; --",
      })
      .expect(200)

    expect(res.body.intent).toBeDefined()

    // Verify businesses table is intact
    const bRes = await pool.query('SELECT COUNT(*) FROM businesses WHERE id = $1', [TENANT_A_ID])
    expect(parseInt(bRes.rows[0].count, 10)).toBe(1)
  })
})
