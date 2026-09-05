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

describe('Phase SA-3.0B-2: AI CS Conversation / Ticket Operations Hardening', () => {
  let pool: Pool
  let app: Express
  let jwtService: ReturnType<typeof createJwtService>

  const TENANT_A_ID = randomUUID()
  const USER_A_ID = randomUUID()

  const TENANT_B_ID = randomUUID()
  const USER_B_ID = randomUUID()

  const SUPERADMIN_ID = randomUUID()

  const JWT_SECRET = 'insecure-test-secret-that-is-at-least-32-chars-long'
  const JWT_ISSUER = 'biz-erp-api'
  const JWT_AUDIENCE = 'biz-erp-client'

  let tokenA: string
  let tokenB: string
  let platformToken: string
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

    // Clean up any stale records
    await pool.query('DELETE FROM platform_audit_logs WHERE actor_id IN ($1, $2, $3)', [USER_A_ID, USER_B_ID, SUPERADMIN_ID])

    // 1. Seed Tenant A & User A
    await pool.query('INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)', [USER_A_ID, `usera_${Date.now()}@aics.com`, hashed, 'ACTIVE'])
    await pool.query("INSERT INTO businesses (id, name, status) VALUES ($1, 'Tenant A Operations', 'ACTIVE')", [TENANT_A_ID])
    await pool.query("INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE')", [USER_A_ID, TENANT_A_ID])

    // 2. Seed Tenant B & User B
    await pool.query('INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)', [USER_B_ID, `userb_${Date.now()}@aics.com`, hashed, 'ACTIVE'])
    await pool.query("INSERT INTO businesses (id, name, status) VALUES ($1, 'Tenant B Isolated', 'ACTIVE')", [TENANT_B_ID])
    await pool.query("INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE')", [USER_B_ID, TENANT_B_ID])

    // 3. Seed Superadmin User
    const superAdminEmail = `superadmin_aics_${Date.now()}@skmnetwork.com`
    await pool.query(
      `INSERT INTO users (id, email, password_hash, status, platform_role)
       VALUES ($1, $2, $3, 'ACTIVE', 'SUPER_ADMIN')`,
      [SUPERADMIN_ID, superAdminEmail, hashed]
    )

    // Ensure settings table has default enabled
    await pool.query(`
      INSERT INTO platform_ai_cs_settings (id, is_enabled, human_escalation_enabled)
      VALUES ('default', TRUE, TRUE)
      ON CONFLICT (id) DO UPDATE SET is_enabled = TRUE, human_escalation_enabled = TRUE
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

    const loginRes = await request(app)
      .post('/v1/auth/login')
      .set('x-auth-context', 'platform')
      .send({ email: superAdminEmail, password: 'password123' })
    expect(loginRes.status).toBe(200)
    platformToken = loginRes.body.access_token

    // Create a base conversation for Tenant A
    const convRes = await request(app)
      .post('/v1/ai-cs/conversations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        service_code: 'ERP',
        initial_message: 'Saya mengalami kendala cetak struk kasir POS',
      })
    expect(convRes.status).toBe(201)
    conversationAId = convRes.body.conversation.id
  })

  afterAll(async () => {
    await pool.query('DELETE FROM platform_audit_logs WHERE actor_id IN ($1, $2, $3)', [USER_A_ID, USER_B_ID, SUPERADMIN_ID])
    await pool.query('DELETE FROM support_tickets WHERE business_id IN ($1, $2)', [TENANT_A_ID, TENANT_B_ID])
    await pool.query('DELETE FROM ai_conversation_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE business_id IN ($1, $2))', [TENANT_A_ID, TENANT_B_ID])
    await pool.query('DELETE FROM ai_conversations WHERE business_id IN ($1, $2)', [TENANT_A_ID, TENANT_B_ID])
    await pool.query('DELETE FROM user_businesses WHERE business_id IN ($1, $2)', [TENANT_A_ID, TENANT_B_ID])
    await pool.query('DELETE FROM businesses WHERE id IN ($1, $2)', [TENANT_A_ID, TENANT_B_ID])
    await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [USER_A_ID, USER_B_ID, SUPERADMIN_ID])
    await pool.end()
  })

  // ---------------------------------------------------------------------------
  // 1. Single AI Escalation & Ticket Traceability
  // ---------------------------------------------------------------------------
  it('AICS-TKT-001: Escalation creates one support ticket with source = AI_CS and conversation linkage', async () => {
    const res = await request(app)
      .post(`/v1/ai-cs/conversations/${conversationAId}/escalate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        subject: 'Kendala Cetak Struk POS',
        description: 'Printer thermal kasir offline saat sinkronisasi',
        priority: 'HIGH',
      })

    expect(res.status).toBe(200)
    expect(res.body.ticket).toBeDefined()
    expect(res.body.ticket.business_id).toBe(TENANT_A_ID)
    expect(res.body.ticket.conversation_id).toBe(conversationAId)
    expect(res.body.ticket.source).toBe('AI_CS')
    expect(res.body.ticket.status).toBe('OPEN')
    expect(res.body.ticket.priority).toBe('HIGH')

    // Verify conversation status updated to ESCALATED
    const convRes = await request(app)
      .get(`/v1/ai-cs/conversations/${conversationAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(convRes.body.conversation.status).toBe('ESCALATED')
  })

  // ---------------------------------------------------------------------------
  // 2. Escalation Idempotency (Sequential repeated calls)
  // ---------------------------------------------------------------------------
  it('AICS-TKT-002: Repeated escalation of the same conversation returns the existing ticket without duplicate creation', async () => {
    // 1st fetch existing tickets count before
    const beforeCountRes = await pool.query(
      'SELECT COUNT(*)::int AS count FROM support_tickets WHERE conversation_id = $1',
      [conversationAId]
    )
    const initialCount = beforeCountRes.rows[0].count
    expect(initialCount).toBe(1)

    // 2nd escalation call
    const res2 = await request(app)
      .post(`/v1/ai-cs/conversations/${conversationAId}/escalate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        subject: 'Repeated Escalation Request',
      })

    expect(res2.status).toBe(200)
    expect(res2.body.ticket).toBeDefined()
    expect(res2.body.ticket.conversation_id).toBe(conversationAId)
    expect(res2.body.ticket.source).toBe('AI_CS')

    // 3rd escalation call
    const res3 = await request(app)
      .post(`/v1/ai-cs/conversations/${conversationAId}/escalate`)
      .set('Authorization', `Bearer ${tokenA}`)

    expect(res3.status).toBe(200)
    expect(res3.body.ticket.id).toBe(res2.body.ticket.id)

    // Verify count in database is still EXACTLY 1
    const afterCountRes = await pool.query(
      'SELECT COUNT(*)::int AS count FROM support_tickets WHERE conversation_id = $1',
      [conversationAId]
    )
    expect(afterCountRes.rows[0].count).toBe(1)
  })

  // ---------------------------------------------------------------------------
  // 3. Concurrent Escalation Protection
  // ---------------------------------------------------------------------------
  it('AICS-TKT-003: Concurrent escalation requests on a new conversation do not create duplicate tickets', async () => {
    // Create new conversation
    const newConvRes = await request(app)
      .post('/v1/ai-cs/conversations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ initial_message: 'Pertanyaan teknis baru' })
    const newConvId = newConvRes.body.conversation.id

    // Fire 5 concurrent escalation requests
    const promises = Array.from({ length: 5 }).map(() =>
      request(app)
        .post(`/v1/ai-cs/conversations/${newConvId}/escalate`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ subject: 'Concurrent Escalation' })
    )

    const results = await Promise.all(promises)
    results.forEach((r) => {
      expect(r.status).toBe(200)
      expect(r.body.ticket).toBeDefined()
    })

    // All results must return the identical ticket ID
    const ticketIds = new Set(results.map((r) => r.body.ticket.id))
    expect(ticketIds.size).toBe(1)

    // Check DB count
    const dbCount = await pool.query(
      'SELECT COUNT(*)::int AS count FROM support_tickets WHERE conversation_id = $1',
      [newConvId]
    )
    expect(dbCount.rows[0].count).toBe(1)
  })

  // ---------------------------------------------------------------------------
  // 4. Escalation via Tool Execution in AI Chat is Idempotent
  // ---------------------------------------------------------------------------
  it('AICS-TKT-004: Tool execution for create_support_ticket is idempotent on the conversation', async () => {
    const convRes = await request(app)
      .post('/v1/ai-cs/conversations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ initial_message: 'Halo' })
    const convId = convRes.body.conversation.id

    // Send human escalation prompt
    const chat1 = await request(app)
      .post(`/v1/ai-cs/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: 'Saya ingin bicara dengan staff manusia' })

    expect(chat1.status).toBe(200)
    expect(chat1.body.escalated).toBe(true)
    expect(chat1.body.ticket).toBeDefined()
    const firstTicketId = chat1.body.ticket.id

    // Send another message in the same escalated conversation
    const chat2 = await request(app)
      .post(`/v1/ai-cs/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: 'Tolong sambungkan ke staf manusia lagi' })

    expect(chat2.status).toBe(200)
    expect(chat2.body.escalated).toBe(true)
    if (chat2.body.ticket) {
      expect(chat2.body.ticket.id).toBe(firstTicketId)
    }

    const countRes = await pool.query(
      'SELECT COUNT(*)::int AS count FROM support_tickets WHERE conversation_id = $1',
      [convId]
    )
    expect(countRes.rows[0].count).toBe(1)
  })

  // ---------------------------------------------------------------------------
  // 5. Disabled Human Escalation Gating
  // ---------------------------------------------------------------------------
  it('AICS-TKT-005: When human escalation is disabled, escalation returns AI_ESCALATION_DISABLED (403)', async () => {
    // Disable human escalation
    await pool.query("UPDATE platform_ai_cs_settings SET human_escalation_enabled = FALSE WHERE id = 'default'")

    const newConv = await request(app)
      .post('/v1/ai-cs/conversations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ initial_message: 'Tes escalation disabled' })
    const convId = newConv.body.conversation.id

    const res = await request(app)
      .post(`/v1/ai-cs/conversations/${convId}/escalate`)
      .set('Authorization', `Bearer ${tokenA}`)

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('AI_ESCALATION_DISABLED')

    // Re-enable for subsequent tests
    await pool.query("UPDATE platform_ai_cs_settings SET human_escalation_enabled = TRUE WHERE id = 'default'")
  })

  // ---------------------------------------------------------------------------
  // 6. Tenant Isolation
  // ---------------------------------------------------------------------------
  it('AICS-TKT-006: Tenant B cannot escalate or view Tenant A conversation/ticket', async () => {
    // Tenant B cannot escalate Tenant A conversation
    const escalateRes = await request(app)
      .post(`/v1/ai-cs/conversations/${conversationAId}/escalate`)
      .set('Authorization', `Bearer ${tokenB}`)
    expect(escalateRes.status).toBe(404)

    // Tenant B cannot get Tenant A conversation
    const getConvRes = await request(app)
      .get(`/v1/ai-cs/conversations/${conversationAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
    expect(getConvRes.status).toBe(404)
  })

  // ---------------------------------------------------------------------------
  // 7. Superadmin Ticket Visibility & AI CS Traceability
  // ---------------------------------------------------------------------------
  it('AICS-TKT-007: Superadmin can identify AI CS ticket source and trace linked conversation', async () => {
    const listRes = await request(app)
      .get('/v1/platform/tickets')
      .set('Authorization', `Bearer ${platformToken}`)

    expect(listRes.status).toBe(200)
    const aiTickets = listRes.body.items.filter((t: any) => t.source === 'AI_CS')
    expect(aiTickets.length).toBeGreaterThanOrEqual(1)

    const targetTicket = aiTickets.find((t: any) => t.conversation_id === conversationAId)
    expect(targetTicket).toBeDefined()
    expect(targetTicket.source).toBe('AI_CS')
    expect(targetTicket.business_name).toBe('Tenant A Operations')

    // Detail endpoint check
    const detailRes = await request(app)
      .get(`/v1/platform/tickets/${targetTicket.id}`)
      .set('Authorization', `Bearer ${platformToken}`)

    expect(detailRes.status).toBe(200)
    expect(detailRes.body.source).toBe('AI_CS')
    expect(detailRes.body.conversation_id).toBe(conversationAId)
    expect(Array.isArray(detailRes.body.conversation_messages)).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // 8. Authoritative Ticket Lifecycle Transition
  // ---------------------------------------------------------------------------
  it('AICS-TKT-008: Existing support ticket lifecycle remains functional on AI-originated tickets', async () => {
    // Find Tenant A's ticket
    const ticketRes = await pool.query(
      'SELECT id FROM support_tickets WHERE conversation_id = $1 LIMIT 1',
      [conversationAId]
    )
    const ticketId = ticketRes.rows[0].id

    // Update to IN_PROGRESS
    const inProgRes = await request(app)
      .patch(`/v1/platform/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ status: 'IN_PROGRESS', assigned_to: SUPERADMIN_ID })
    expect(inProgRes.status).toBe(200)
    expect(inProgRes.body.ticket.status).toBe('IN_PROGRESS')

    // Update to RESOLVED
    const resolveRes = await request(app)
      .patch(`/v1/platform/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ status: 'RESOLVED' })
    expect(resolveRes.status).toBe(200)
    expect(resolveRes.body.ticket.status).toBe('RESOLVED')

    // Update to CLOSED
    const closeRes = await request(app)
      .patch(`/v1/platform/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ status: 'CLOSED' })
    expect(closeRes.status).toBe(200)
    expect(closeRes.body.ticket.status).toBe('CLOSED')
  })
})
