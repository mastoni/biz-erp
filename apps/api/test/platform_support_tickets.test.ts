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

describe('Phase: Superadmin Support Ticket Control API', () => {
  let pool: Pool
  let app: Express
  let jwtService: ReturnType<typeof createJwtService>
  let platformToken: string
  let tenantTokenA: string
  let superAdminId: string

  const TENANT_A_ID = randomUUID()
  const USER_A_ID = randomUUID()
  const TENANT_B_ID = randomUUID()
  const USER_B_ID = randomUUID()

  let ticketAId: string
  let ticketBId: string
  let convAId: string

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
    const superAdminEmail = `superadmin_tickets_${Date.now()}@skmnetwork.com`
    await pool.query(
      `INSERT INTO users (id, email, password_hash, status, platform_role)
       VALUES ($1, $2, $3, 'ACTIVE', 'SUPER_ADMIN')`,
      [superAdminId, superAdminEmail, hash]
    )

    const loginRes = await request(app)
      .post('/v1/auth/login')
      .set('x-auth-context', 'platform')
      .send({ email: superAdminEmail, password: 'password123' })

    expect(loginRes.status).toBe(200)
    platformToken = loginRes.body.access_token

    // 2. Seed Tenant A & User A
    await pool.query('INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING', [USER_A_ID, `usera_${Date.now()}@aics.com`, hash, 'ACTIVE'])
    await pool.query("INSERT INTO businesses (id, name, status) VALUES ($1, 'Tenant A Toko', 'ACTIVE') ON CONFLICT (id) DO NOTHING", [TENANT_A_ID])
    await pool.query("INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE') ON CONFLICT DO NOTHING", [USER_A_ID, TENANT_A_ID])

    tenantTokenA = jwtService.signAccessToken({
      sub: USER_A_ID,
      business_id: TENANT_A_ID,
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID(),
    })

    // 3. Seed Tenant B & User B
    await pool.query('INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING', [USER_B_ID, `userb_${Date.now()}@aics.com`, hash, 'ACTIVE'])
    await pool.query("INSERT INTO businesses (id, name, status) VALUES ($1, 'Tenant B ISP', 'ACTIVE') ON CONFLICT (id) DO NOTHING", [TENANT_B_ID])
    await pool.query("INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE') ON CONFLICT DO NOTHING", [USER_B_ID, TENANT_B_ID])

    // 4. Seed AI Conversation for Tenant A
    convAId = randomUUID()
    await pool.query(
      `INSERT INTO ai_conversations (id, business_id, user_id, service_code, status)
       VALUES ($1, $2, $3, 'ERP', 'ESCALATED')`,
      [convAId, TENANT_A_ID, USER_A_ID]
    )

    await pool.query(
      `INSERT INTO ai_conversation_messages (conversation_id, sender, intent, content)
       VALUES 
        ($1, 'USER', NULL, 'Saya butuh bantuan staff manusia'),
        ($1, 'ASSISTANT', 'HUMAN_ESCALATION', 'Permintaan bantuan Anda telah diteruskan ke tim support.')`,
      [convAId]
    )

    // 5. Seed Support Tickets for Tenant A and Tenant B
    ticketAId = randomUUID()
    await pool.query(
      `INSERT INTO support_tickets (id, business_id, conversation_id, service_code, subject, description, priority, status)
       VALUES ($1, $2, $3, 'ERP', 'Kendala Sinkronisasi Kasir POS', 'Kasir tidak bisa posting struk', 'HIGH', 'OPEN')`,
      [ticketAId, TENANT_A_ID, convAId]
    )

    ticketBId = randomUUID()
    await pool.query(
      `INSERT INTO support_tickets (id, business_id, service_code, subject, description, priority, status)
       VALUES ($1, $2, 'ISP_MANAGEMENT', 'LOS Merah Router ONT', 'Lampu LOS berkedip merah', 'URGENT', 'IN_PROGRESS')`,
      [ticketBId, TENANT_B_ID]
    )
  })

  afterAll(async () => {
    await pool.end()
  })

  describe('1. Platform Access Control & Boundary Enforcement', () => {
    it('allows SUPER_ADMIN to list tickets across all tenants with summary KPIs', async () => {
      const res = await request(app)
        .get('/v1/platform/tickets?limit=20&offset=0')
        .set('Authorization', `Bearer ${platformToken}`)

      expect(res.status).toBe(200)
      expect(res.body.total).toBeGreaterThanOrEqual(2)
      expect(Array.isArray(res.body.items)).toBe(true)

      const ticketIds = res.body.items.map((t: any) => t.id)
      expect(ticketIds).toContain(ticketAId)
      expect(ticketIds).toContain(ticketBId)

      expect(res.body.summary).toMatchObject({
        total: expect.any(Number),
        open_count: expect.any(Number),
        in_progress_count: expect.any(Number),
      })
    })

    it('rejects tenant token with 403 WRONG_SCOPE', async () => {
      const res = await request(app)
        .get('/v1/platform/tickets')
        .set('Authorization', `Bearer ${tenantTokenA}`)

      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('WRONG_SCOPE')
    })

    it('rejects unauthenticated/invalid token with 401 INVALID_TOKEN', async () => {
      const res = await request(app)
        .get('/v1/platform/tickets')
        .set('Authorization', 'Bearer invalid-token')

      expect(res.status).toBe(401)
    })
  })

  describe('2. Ticket Filtering & Search', () => {
    it('filters tickets by status', async () => {
      const res = await request(app)
        .get('/v1/platform/tickets?status=OPEN')
        .set('Authorization', `Bearer ${platformToken}`)

      expect(res.status).toBe(200)
      res.body.items.forEach((t: any) => {
        expect(t.status).toBe('OPEN')
      })
    })

    it('filters tickets by priority', async () => {
      const res = await request(app)
        .get('/v1/platform/tickets?priority=URGENT')
        .set('Authorization', `Bearer ${platformToken}`)

      expect(res.status).toBe(200)
      res.body.items.forEach((t: any) => {
        expect(t.priority).toBe('URGENT')
      })
    })

    it('searches tickets by keyword', async () => {
      const res = await request(app)
        .get('/v1/platform/tickets?search=Sinkronisasi')
        .set('Authorization', `Bearer ${platformToken}`)

      expect(res.status).toBe(200)
      expect(res.body.items.length).toBeGreaterThanOrEqual(1)
      expect(res.body.items[0].id).toBe(ticketAId)
    })

    it('rejects invalid status filter with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get('/v1/platform/tickets?status=INVALID_STATUS')
        .set('Authorization', `Bearer ${platformToken}`)

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('3. Ticket Detail & Conversation Relationship', () => {
    it('retrieves ticket detail with linked conversation messages for authorized platform admin', async () => {
      const res = await request(app)
        .get(`/v1/platform/tickets/${ticketAId}`)
        .set('Authorization', `Bearer ${platformToken}`)

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(ticketAId)
      expect(res.body.business_name).toBe('Tenant A Toko')
      expect(res.body.conversation_id).toBe(convAId)
      expect(Array.isArray(res.body.conversation_messages)).toBe(true)
      expect(res.body.conversation_messages.length).toBe(2)
      expect(res.body.conversation_messages[0].content).toBe('Saya butuh bantuan staff manusia')
    })

    it('returns 404 for non-existent ticket ID', async () => {
      const fakeId = randomUUID()
      const res = await request(app)
        .get(`/v1/platform/tickets/${fakeId}`)
        .set('Authorization', `Bearer ${platformToken}`)

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })

    it('returns 400 for malformed UUID', async () => {
      const res = await request(app)
        .get('/v1/platform/tickets/not-a-uuid')
        .set('Authorization', `Bearer ${platformToken}`)

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('4. Status Transitions & Assignment Workflow', () => {
    it('rejects invalid status values with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .patch(`/v1/platform/tickets/${ticketAId}/status`)
        .set('Authorization', `Bearer ${platformToken}`)
        .send({ status: 'INVALID_STATUS' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('successfully transitions ticket status and assigns to active platform user', async () => {
      const res = await request(app)
        .patch(`/v1/platform/tickets/${ticketAId}/status`)
        .set('Authorization', `Bearer ${platformToken}`)
        .send({
          status: 'IN_PROGRESS',
          assigned_to: superAdminId,
        })

      expect(res.status).toBe(200)
      expect(res.body.ticket.status).toBe('IN_PROGRESS')
      expect(res.body.ticket.assigned_to).toBe(superAdminId)

      // Verify audit log entry was generated
      const auditRes = await pool.query(
        `SELECT * FROM platform_audit_logs 
         WHERE action = 'TICKET_STATUS_UPDATED' AND target_id = $1 
         ORDER BY created_at DESC LIMIT 1`,
        [ticketAId]
      )
      expect(auditRes.rows.length).toBe(1)
      expect(auditRes.rows[0].actor_id).toBe(superAdminId)
      expect(auditRes.rows[0].actor_scope).toBe('platform')
    })

    it('allows resolving and closing ticket', async () => {
      const resolveRes = await request(app)
        .patch(`/v1/platform/tickets/${ticketAId}/status`)
        .set('Authorization', `Bearer ${platformToken}`)
        .send({ status: 'RESOLVED' })

      expect(resolveRes.status).toBe(200)
      expect(resolveRes.body.ticket.status).toBe('RESOLVED')

      const closeRes = await request(app)
        .patch(`/v1/platform/tickets/${ticketAId}/status`)
        .set('Authorization', `Bearer ${platformToken}`)
        .send({ status: 'CLOSED' })

      expect(closeRes.status).toBe(200)
      expect(closeRes.body.ticket.status).toBe('CLOSED')
    })
  })
})
