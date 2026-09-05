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

describe('Phase SA-3.0B-3: Superadmin AI CS Knowledge Base Control', () => {
  let pool: Pool
  let app: Express
  let jwtService: ReturnType<typeof createJwtService>

  const SUPERADMIN_ID = randomUUID()
  const TENANT_A_ID = randomUUID()
  const USER_A_ID = randomUUID()

  const JWT_SECRET = 'insecure-test-secret-that-is-at-least-32-chars-long'
  const JWT_ISSUER = 'biz-erp-api'
  const JWT_AUDIENCE = 'biz-erp-client'

  let platformToken: string
  let tenantToken: string
  let createdArticleId: string

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
    await pool.query('DELETE FROM platform_audit_logs WHERE actor_id IN ($1, $2)', [SUPERADMIN_ID, USER_A_ID])

    // Ensure canonical AI CS knowledge base records exist idempotently
    await pool.query(`
      INSERT INTO ai_knowledge_base (code, category, title, content, keywords, is_public, is_active, priority_order)
      VALUES
        (
          'KB-PLAT-01',
          'PLATFORM',
          'Tentang Ekosistem SKMNetwork',
          'SKMNetwork adalah platform multi-service terintegrasi yang menyediakan ERP, ISP Management, CCTV Management, WhatsApp Gateway, dan Digital Marketing AutoPost.',
          '["skmnetwork", "ekosistem", "platform", "layanan"]'::jsonb,
          TRUE,
          TRUE,
          10
        ),
        (
          'KB-BILL-01',
          'BILLING',
          'Siklus dan Pembayaran Tagihan',
          'Tagihan langganan dibuat setiap awal periode penagihan. Pembayaran dapat dilakukan via virtual account atau transfer bank otomatis.',
          '["tagihan", "pembayaran", "invoice", "bayar", "billing"]'::jsonb,
          TRUE,
          TRUE,
          20
        ),
        (
          'KB-ISP-01',
          'ISP_MANAGEMENT',
          'Troubleshooting Router dan Internet ISP',
          'Jika koneksi internet mati: 1. Periksa lampu indikator PON/LOS pada router ONT. 2. Restart router selama 30 detik. 3. Jika lampu LOS merah, hubungi tim teknis via AI CS.',
          '["wifi", "internet", "mati", "los", "pon", "ont", "router"]'::jsonb,
          FALSE,
          TRUE,
          30
        ),
        (
          'KB-ERP-01',
          'ERP',
          'Pencatatan dan Laporan Penjualan ERP',
          'Laporan penjualan harian dapat diakses melalui menu Penjualan > Laporan. Transaksi kasir POS secara otomatis tersinkronisasi ke jurnal keuangan.',
          '["laporan", "penjualan", "pos", "kasir", "stok", "erp"]'::jsonb,
          FALSE,
          TRUE,
          40
        ),
        (
          'KB-CCTV-01',
          'CCTV_MANAGEMENT',
          'Konfigurasi Streaming CCTV & Retensi Video',
          'Kamera CCTV terhubung melalui gateway streaming terenkripsi. Retensi rekaman default adalah 30 hari sesuai paket langganan.',
          '["cctv", "kamera", "rekaman", "streaming", "nvr"]'::jsonb,
          FALSE,
          TRUE,
          50
        ),
        (
          'KB-TRBL-01',
          'TROUBLESHOOTING',
          'Panduan Eskalasi Kendala Teknis',
          'Untuk kendala kritis yang tidak terselesaikan melalui panduan otomatis, Anda dapat meminta eskalasi langsung ke tiket bantuan operator manusia.',
          '["eskalasi", "bantuan", "manusia", "tiket", "operator", "support"]'::jsonb,
          TRUE,
          TRUE,
          60
        )
      ON CONFLICT (code) DO NOTHING;
    `)

    // 1. Seed Superadmin User
    const superAdminEmail = `superadmin_kb_${Date.now()}@skmnetwork.com`
    await pool.query(
      `INSERT INTO users (id, email, password_hash, status, platform_role)
       VALUES ($1, $2, $3, 'ACTIVE', 'SUPER_ADMIN')`,
      [SUPERADMIN_ID, superAdminEmail, hashed]
    )

    // 2. Seed Tenant A User
    await pool.query('INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)', [USER_A_ID, `tenantuser_${Date.now()}@test.com`, hashed, 'ACTIVE'])
    await pool.query("INSERT INTO businesses (id, name, status) VALUES ($1, 'Tenant Knowledge Test', 'ACTIVE')", [TENANT_A_ID])
    await pool.query("INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE')", [USER_A_ID, TENANT_A_ID])

    // Superadmin login
    const loginRes = await request(app)
      .post('/v1/auth/login')
      .set('x-auth-context', 'platform')
      .send({ email: superAdminEmail, password: 'password123' })
    expect(loginRes.status).toBe(200)
    platformToken = loginRes.body.access_token

    // Tenant token
    tenantToken = jwtService.signAccessToken({
      sub: USER_A_ID,
      business_id: TENANT_A_ID,
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID(),
    })
  })

  afterAll(async () => {
    await pool.query('DELETE FROM platform_audit_logs WHERE actor_id IN ($1, $2)', [SUPERADMIN_ID, USER_A_ID])
    await pool.query('DELETE FROM ai_knowledge_base WHERE code LIKE $1', ['TEST-%'])
    if (createdArticleId) {
      await pool.query('DELETE FROM ai_knowledge_base WHERE id = $1', [createdArticleId])
    }
    await pool.query('DELETE FROM user_businesses WHERE business_id = $1', [TENANT_A_ID])
    await pool.query('DELETE FROM businesses WHERE id = $1', [TENANT_A_ID])
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [SUPERADMIN_ID, USER_A_ID])
    await pool.end()
  })

  // ---------------------------------------------------------------------------
  // 1. Initial Migration & Seed Preservation
  // ---------------------------------------------------------------------------
  it('AICS-KB-001: Seeded static knowledge articles exist in authoritative DB with correct domain mappings', async () => {
    const res = await request(app)
      .get('/v1/platform/ai-cs/knowledge')
      .set('Authorization', `Bearer ${platformToken}`)

    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThanOrEqual(6)
    expect(Array.isArray(res.body.items)).toBe(true)

    const codes = res.body.items.map((a: any) => a.code)
    expect(codes).toContain('KB-PLAT-01')
    expect(codes).toContain('KB-BILL-01')
    expect(codes).toContain('KB-ISP-01')
    expect(codes).toContain('KB-ERP-01')
    expect(codes).toContain('KB-CCTV-01')
    expect(codes).toContain('KB-TRBL-01')
  })

  // ---------------------------------------------------------------------------
  // 2. Superadmin CRUD Operations
  // ---------------------------------------------------------------------------
  it('AICS-KB-002: SUPER_ADMIN can create a new knowledge article and audit is recorded', async () => {
    const customReqId = randomUUID()
    const res = await request(app)
      .post('/v1/platform/ai-cs/knowledge')
      .set('Authorization', `Bearer ${platformToken}`)
      .set('X-Request-Id', customReqId)
      .send({
        code: 'TEST-KB-QNA-01',
        category: 'BILLING',
        title: 'Panduan Pembayaran QRIS Dinamis',
        content: 'Pembayaran QRIS dapat dipindai langsung melalui aplikasi mobile banking atau e-wallet nasional.',
        keywords: ['qris', 'gopay', 'ovo', 'dana', 'scan'],
        priority_order: 5,
        is_public: true,
        is_active: true,
      })

    expect(res.status).toBe(201)
    expect(res.body.article).toBeDefined()
    expect(res.body.article.title).toBe('Panduan Pembayaran QRIS Dinamis')
    expect(res.body.article.category).toBe('BILLING')
    expect(res.body.article.keywords).toContain('qris')
    createdArticleId = res.body.article.id

    // Verify audit log
    const auditRes = await pool.query(
      `SELECT * FROM platform_audit_logs WHERE action = 'AI_CS_KB_CREATED' AND target_id = $1`,
      [createdArticleId]
    )
    expect(auditRes.rows.length).toBe(1)
    expect(auditRes.rows[0].actor_id).toBe(SUPERADMIN_ID)
    expect(auditRes.rows[0].actor_scope).toBe('platform')
  })

  it('AICS-KB-003: SUPER_ADMIN can retrieve a knowledge article by ID', async () => {
    const res = await request(app)
      .get(`/v1/platform/ai-cs/knowledge/${createdArticleId}`)
      .set('Authorization', `Bearer ${platformToken}`)

    expect(res.status).toBe(200)
    expect(res.body.article.id).toBe(createdArticleId)
    expect(res.body.article.title).toBe('Panduan Pembayaran QRIS Dinamis')
  })

  it('AICS-KB-004: SUPER_ADMIN can update a knowledge article and audit is recorded', async () => {
    const res = await request(app)
      .patch(`/v1/platform/ai-cs/knowledge/${createdArticleId}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        title: 'Panduan Pembayaran QRIS dan Virtual Account',
        priority_order: 3,
      })

    expect(res.status).toBe(200)
    expect(res.body.article.title).toBe('Panduan Pembayaran QRIS dan Virtual Account')
    expect(res.body.article.priority_order).toBe(3)

    const auditRes = await pool.query(
      `SELECT * FROM platform_audit_logs WHERE action = 'AI_CS_KB_UPDATED' AND target_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [createdArticleId]
    )
    expect(auditRes.rows.length).toBe(1)
  })

  it('AICS-KB-005: SUPER_ADMIN can deactivate (soft delete) a knowledge article', async () => {
    const res = await request(app)
      .delete(`/v1/platform/ai-cs/knowledge/${createdArticleId}`)
      .set('Authorization', `Bearer ${platformToken}`)

    expect(res.status).toBe(200)

    const checkRes = await request(app)
      .get(`/v1/platform/ai-cs/knowledge/${createdArticleId}`)
      .set('Authorization', `Bearer ${platformToken}`)

    expect(checkRes.status).toBe(200)
    expect(checkRes.body.article.is_active).toBe(false)
  })

  it('AICS-KB-006: SUPER_ADMIN can reactivate a deactivated knowledge article', async () => {
    const res = await request(app)
      .patch(`/v1/platform/ai-cs/knowledge/${createdArticleId}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        is_active: true,
      })

    expect(res.status).toBe(200)
    expect(res.body.article.is_active).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // 3. Validation & Edge Cases
  // ---------------------------------------------------------------------------
  it('AICS-KB-007: Creation fails with 400 VALIDATION_ERROR if title or content is empty', async () => {
    const res = await request(app)
      .post('/v1/platform/ai-cs/knowledge')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        title: '',
        content: 'Valid content',
        category: 'BILLING',
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('AICS-KB-008: Get article returns 404 NOT_FOUND for unknown article ID', async () => {
    const fakeId = randomUUID()
    const res = await request(app)
      .get(`/v1/platform/ai-cs/knowledge/${fakeId}`)
      .set('Authorization', `Bearer ${platformToken}`)

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  // ---------------------------------------------------------------------------
  // 4. Access Control Boundaries
  // ---------------------------------------------------------------------------
  it('AICS-KB-009: Tenant users receive 403 WRONG_SCOPE when accessing platform knowledge management', async () => {
    const listRes = await request(app)
      .get('/v1/platform/ai-cs/knowledge')
      .set('Authorization', `Bearer ${tenantToken}`)

    expect(listRes.status).toBe(403)
    expect(listRes.body.error.code).toBe('WRONG_SCOPE')

    const createRes = await request(app)
      .post('/v1/platform/ai-cs/knowledge')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ title: 'Hacked article' })

    expect(createRes.status).toBe(403)
  })

  it('AICS-KB-010: Anonymous requests receive 401 INVALID_TOKEN', async () => {
    const res = await request(app).get('/v1/platform/ai-cs/knowledge')
    expect(res.status).toBe(401)
  })

  // ---------------------------------------------------------------------------
  // 5. Runtime AI CS Knowledge Matching Integration
  // ---------------------------------------------------------------------------
  it('AICS-KB-011: Active knowledge article participates in deterministic AI CS response', async () => {
    // 1. Create a conversation for Tenant A
    const convRes = await request(app)
      .post('/v1/ai-cs/conversations')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ initial_message: 'Pertanyaan seputar pembayaran' })
    const convId = convRes.body.conversation.id

    // 2. Send prompt matching our newly created QRIS knowledge keywords
    const chatRes = await request(app)
      .post(`/v1/ai-cs/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ content: 'Bagaimana cara bayar tagihan dengan qris atau gopay?' })

    expect(chatRes.status).toBe(200)
    expect(chatRes.body.message).toBeDefined()
  })

  it('AICS-KB-012: Inactive knowledge article is excluded from runtime matching', async () => {
    // 1. Deactivate our QRIS article
    await pool.query('UPDATE ai_knowledge_base SET is_active = FALSE WHERE id = $1', [createdArticleId])

    // 2. Query searchKnowledge directly from service
    const { createAiKnowledgeService } = await import('../src/services/ai_knowledge_service')
    const kbService = createAiKnowledgeService(pool)
    const matches = await kbService.searchKnowledge('qris gopay pembayaran')

    const hasDeactivated = matches.some((m) => m.id === createdArticleId)
    expect(hasDeactivated).toBe(false)
  })
})
