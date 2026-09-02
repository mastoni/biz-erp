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
import { createAuditService } from '../src/services/audit_service'

describe('Phase SA-2.8: Platform Audit & Observability Foundation', () => {
  let pool: Pool
  let app: Express
  let jwtService: ReturnType<typeof createJwtService>
  let auditService: ReturnType<typeof createAuditService>

  const SUPER_USER_ID = randomUUID()
  const TENANT_USER_ID = randomUUID()
  const BUSINESS_ID = randomUUID()

  const JWT_SECRET = 'insecure-test-secret-that-is-at-least-32-chars-long'
  const JWT_ISSUER = 'biz-erp-api'
  const JWT_AUDIENCE = 'biz-erp-client'

  let superToken: string
  let tenantToken: string
  let auditLog1Id: string

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
    auditService = createAuditService(pool)

    // Seed Superadmin user
    const hashed = await hashPassword('password123')
    await pool.query(
      'INSERT INTO users (id, email, password_hash, status, platform_role) VALUES ($1, $2, $3, $4, $5)',
      [SUPER_USER_ID, 'superadmin@observability.com', hashed, 'ACTIVE', 'SUPER_ADMIN']
    )

    // Seed Tenant user & business
    await pool.query('INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)', [TENANT_USER_ID, 'tenant@observability.com', hashed, 'ACTIVE'])
    await pool.query("INSERT INTO businesses (id, name, status) VALUES ($1, 'Obs Business', 'ACTIVE')", [BUSINESS_ID])
    await pool.query("INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE')", [TENANT_USER_ID, BUSINESS_ID])

    // Ensure Canonical Services exist
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

    superToken = jwtService.signAccessToken({
      sub: SUPER_USER_ID,
      scope: 'platform',
      role: 'SUPER_ADMIN',
      session_id: randomUUID(),
      jti: randomUUID(),
    })

    tenantToken = jwtService.signAccessToken({
      sub: TENANT_USER_ID,
      business_id: BUSINESS_ID,
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID(),
    })

    // Ensure clean audit log fixture isolation
    await pool.query('DELETE FROM platform_audit_logs')

    // Seed test audit log entries
    const log1 = await auditService.recordAudit({
      actor_id: SUPER_USER_ID,
      actor_email: 'superadmin@observability.com',
      actor_scope: 'platform',
      actor_role: 'SUPER_ADMIN',
      action: 'SERVICE_UPDATE',
      service_code: 'ISP_MANAGEMENT',
      target_type: 'service',
      target_id: 'ISP_MANAGEMENT',
      before_state: { lifecycle_status: 'DRAFT' },
      after_state: { lifecycle_status: 'ACTIVE' },
      diff: { lifecycle_status: { from: 'DRAFT', to: 'ACTIVE' } },
      request_id: 'req-test-1234',
      status: 'SUCCESS',
      metadata: { reason: 'Commercial release' },
    })
    auditLog1Id = log1.id

    await auditService.recordAudit({
      actor_id: SUPER_USER_ID,
      actor_email: 'superadmin@observability.com',
      actor_scope: 'platform',
      actor_role: 'SUPER_ADMIN',
      action: 'BUSINESS_APPROVE',
      service_code: 'ERP',
      target_type: 'business',
      target_id: BUSINESS_ID,
      before_state: { status: 'PENDING_REVIEW' },
      after_state: { status: 'ACTIVE' },
      request_id: 'req-test-5678',
      status: 'SUCCESS',
    })
  })

  afterAll(async () => {
    await pool.query('DELETE FROM platform_audit_logs')
    await pool.query('DELETE FROM user_businesses WHERE user_id = $1', [TENANT_USER_ID])
    await pool.query('DELETE FROM businesses WHERE id = $1', [BUSINESS_ID])
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [SUPER_USER_ID, TENANT_USER_ID])
    await pool.end()
  })

  // ---------------------------------------------------------------------------
  // 1. Superadmin List Audit Logs
  // ---------------------------------------------------------------------------
  it('AUDIT-001: Superadmin lists platform audit logs with pagination and filters', async () => {
    const res = await request(app)
      .get('/v1/platform/audit-logs?action=SERVICE_UPDATE')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200)

    expect(res.body.items).toBeDefined()
    expect(res.body.items.length).toBe(1)
    expect(res.body.items[0].action).toBe('SERVICE_UPDATE')
    expect(res.body.items[0].service_code).toBe('ISP_MANAGEMENT')
    expect(res.body.total).toBe(1)
  })

  // ---------------------------------------------------------------------------
  // 2. Audit Log Records State & Correlation
  // ---------------------------------------------------------------------------
  it('AUDIT-002: Audit log records actor, scope, before/after state, and correlation request_id', async () => {
    const res = await request(app)
      .get(`/v1/platform/audit-logs/${auditLog1Id}`)
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200)

    expect(res.body.id).toBe(auditLog1Id)
    expect(res.body.actor_email).toBe('superadmin@observability.com')
    expect(res.body.actor_scope).toBe('platform')
    expect(res.body.before_state).toEqual({ lifecycle_status: 'DRAFT' })
    expect(res.body.after_state).toEqual({ lifecycle_status: 'ACTIVE' })
    expect(res.body.diff).toEqual({ lifecycle_status: { from: 'DRAFT', to: 'ACTIVE' } })
    expect(res.body.request_id).toBe('req-test-1234')
    expect(res.body.status).toBe('SUCCESS')
  })

  // ---------------------------------------------------------------------------
  // 3. Security - Scope Guard (Tenant Token Rejected on Platform Audit Routes)
  // ---------------------------------------------------------------------------
  it('AUDIT-003: Tenant token rejected on platform audit endpoints with 403 WRONG_SCOPE', async () => {
    const res = await request(app)
      .get('/v1/platform/audit-logs')
      .set('Authorization', `Bearer ${tenantToken}`)
      .expect(403)

    expect(res.body.error.code).toBe('WRONG_SCOPE')
  })

  // ---------------------------------------------------------------------------
  // 4. Ecosystem Health Endpoint
  // ---------------------------------------------------------------------------
  it('AUDIT-004: GET /v1/platform/observability/health returns ecosystem health & database status', async () => {
    const res = await request(app)
      .get('/v1/platform/observability/health')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200)

    expect(res.body.status).toBe('healthy')
    expect(res.body.version).toBe('0.1.0')
    expect(res.body.uptime_seconds).toBeGreaterThanOrEqual(0)
    expect(res.body.database).toBeDefined()
    expect(res.body.database.status).toBe('connected')
    expect(res.body.database.latency_ms).toBeGreaterThanOrEqual(0)
    expect(res.body.memory).toBeDefined()
    expect(res.body.memory.heap_used_mb).toBeGreaterThan(0)
  })

  // ---------------------------------------------------------------------------
  // 5. Ecosystem Metrics Endpoint
  // ---------------------------------------------------------------------------
  it('AUDIT-005: GET /v1/platform/observability/metrics returns service, tenant, and provisioning metrics', async () => {
    const res = await request(app)
      .get('/v1/platform/observability/metrics')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200)

    expect(res.body.timestamp).toBeDefined()
    expect(res.body.services).toBeDefined()
    expect(res.body.services.total).toBeGreaterThanOrEqual(5)
    expect(res.body.services.by_status.ACTIVE).toBeGreaterThanOrEqual(3)
    expect(res.body.tenants).toBeDefined()
    expect(res.body.tenants.total).toBeGreaterThanOrEqual(1)
    expect(res.body.provisioning).toBeDefined()
    expect(res.body.provisioning.total_jobs).toBeGreaterThanOrEqual(0)
  })

  // ---------------------------------------------------------------------------
  // 6. Filter by Service Code
  // ---------------------------------------------------------------------------
  it('AUDIT-006: Filter audit logs by service_code (ERP vs ISP_MANAGEMENT)', async () => {
    const resERP = await request(app)
      .get('/v1/platform/audit-logs?service_code=ERP')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200)

    expect(resERP.body.items.length).toBe(1)
    expect(resERP.body.items[0].service_code).toBe('ERP')
    expect(resERP.body.items[0].action).toBe('BUSINESS_APPROVE')

    const resISP = await request(app)
      .get('/v1/platform/audit-logs?service_code=ISP_MANAGEMENT')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200)

    expect(resISP.body.items.length).toBe(1)
    expect(resISP.body.items[0].service_code).toBe('ISP_MANAGEMENT')
    expect(resISP.body.items[0].action).toBe('SERVICE_UPDATE')
  })

  // ---------------------------------------------------------------------------
  // 7. Unauthenticated Access Rejected
  // ---------------------------------------------------------------------------
  it('AUDIT-007: Unauthenticated request to audit endpoints returns 401', async () => {
    await request(app)
      .get('/v1/platform/audit-logs')
      .expect(401)

    await request(app)
      .get('/v1/platform/observability/health')
      .expect(401)
  })
})
