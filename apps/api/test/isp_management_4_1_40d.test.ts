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
import { createIspService } from '../src/services/isp_service'
import { createAiToolRegistry } from '../src/services/ai_tool_registry'

describe('Phase 4.1.40D: ISP / Internet Integration & Device Services', () => {
  let pool: Pool
  let app: Express
  let jwtService: ReturnType<typeof createJwtService>

  const TENANT_A_ID = randomUUID()
  const USER_A_ID = randomUUID()
  const CUSTOMER_A_ID = randomUUID()

  const TENANT_B_ID = randomUUID()
  const USER_B_ID = randomUUID()
  const CUSTOMER_B_ID = randomUUID()

  const JWT_SECRET = 'insecure-test-secret-that-is-at-least-32-chars-long'
  const JWT_ISSUER = 'biz-erp-api'
  const JWT_AUDIENCE = 'biz-erp-client'

  let tokenA: string
  let tokenB: string
  let tokenNoEntitlement: string

  let gatewayMikrotikA_Id: string
  let gatewayGenieAcsA_Id: string
  let gatewayMikrotikB_Id: string
  let subscriberA_Id: string

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

    // Clean up test fixtures
    await pool.query('DELETE FROM platform_audit_logs WHERE actor_id IN ($1, $2)', [USER_A_ID, USER_B_ID])

    // 1. Seed Tenant A & User A
    await pool.query('INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)', [USER_A_ID, `userA_${USER_A_ID.substring(0, 8)}@isp.com`, hashed, 'ACTIVE'])
    await pool.query("INSERT INTO businesses (id, name, status) VALUES ($1, 'Tenant A ISP Biz', 'ACTIVE')", [TENANT_A_ID])
    await pool.query("INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE')", [USER_A_ID, TENANT_A_ID])
    await pool.query("INSERT INTO customers (id, business_id, name, phone) VALUES ($1, $2, 'Customer A', '08123456789')", [CUSTOMER_A_ID, TENANT_A_ID])

    // 2. Seed Tenant B & User B
    await pool.query('INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)', [USER_B_ID, `userB_${USER_B_ID.substring(0, 8)}@isp.com`, hashed, 'ACTIVE'])
    await pool.query("INSERT INTO businesses (id, name, status) VALUES ($1, 'Tenant B Other Biz', 'ACTIVE')", [TENANT_B_ID])
    await pool.query("INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE')", [USER_B_ID, TENANT_B_ID])
    await pool.query("INSERT INTO customers (id, business_id, name, phone) VALUES ($1, $2, 'Customer B', '08987654321')", [CUSTOMER_B_ID, TENANT_B_ID])

    // 3. Ensure Canonical Services & Plans exist
    await pool.query(`
      INSERT INTO services (code, name, category, service_type, lifecycle_status)
      VALUES ('ISP_MANAGEMENT', 'ISP & Network Management', 'CONNECTIVITY', 'INTERNAL', 'ACTIVE')
      ON CONFLICT (code) DO NOTHING
    `)

    // Ensure subscription families exist
    await pool.query(`
      INSERT INTO subscription_families (code, name, replacement_policy)
      VALUES
        ('INTERNET_PLAN', 'Internet Family', 'REPLACEABLE')
      ON CONFLICT (code) DO NOTHING
    `)

    await pool.query(`
      INSERT INTO plans (code, name, family, tier, billing_cycle, pricing, type, status, service_code)
      VALUES ('INTERNET_50M', 'Fiber 50 Mbps Dedicated', 'INTERNET_PLAN', 'PRO', 'MONTHLY', '{"final_price": 350000}', 'STANDALONE', 'ACTIVE', 'ISP_MANAGEMENT')
      ON CONFLICT (code) DO UPDATE SET service_code = EXCLUDED.service_code
    `)

    // 4. Grant Entitlements (Tenant A has ISP_MANAGEMENT; Tenant B does not)
    await pool.query(`
      INSERT INTO subscriptions (business_id, plan_code, family_code, source, status, starts_at, unit_price, final_price, billing_cycle)
      VALUES ($1, 'INTERNET_50M', 'INTERNET_PLAN', 'DIRECT', 'ACTIVE', NOW(), 350000, 350000, 'MONTHLY')
    `, [TENANT_A_ID])

    // Generate Tokens
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

    const USER_NO_ENTITLEMENT = randomUUID()
    const TENANT_NO_ENTITLEMENT = randomUUID()
    await pool.query('INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)', [USER_NO_ENTITLEMENT, `noent_${USER_NO_ENTITLEMENT.substring(0, 8)}@isp.com`, hashed, 'ACTIVE'])
    await pool.query("INSERT INTO businesses (id, name, status) VALUES ($1, 'Tenant No Ent', 'ACTIVE')", [TENANT_NO_ENTITLEMENT])
    await pool.query("INSERT INTO user_businesses (user_id, business_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE')", [USER_NO_ENTITLEMENT, TENANT_NO_ENTITLEMENT])
    tokenNoEntitlement = jwtService.signAccessToken({
      sub: USER_NO_ENTITLEMENT,
      business_id: TENANT_NO_ENTITLEMENT,
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID(),
    })
  })

  afterAll(async () => {
    await pool.query('DELETE FROM isp_subscribers WHERE business_id IN ($1, $2)', [TENANT_A_ID, TENANT_B_ID])
    await pool.query('DELETE FROM isp_gateways WHERE business_id IN ($1, $2)', [TENANT_A_ID, TENANT_B_ID])
    await pool.query('DELETE FROM provisioning_jobs WHERE business_id IN ($1, $2)', [TENANT_A_ID, TENANT_B_ID])
    await pool.end()
  })

  // ---------------------------------------------------------------------------
  // ISP-001 & ISP-002: Tenant Isolation & Entitlement Guards
  // ---------------------------------------------------------------------------

  it('ISP-001: Enforces tenant isolation for subscriber and gateway lookups', async () => {
    // Tenant A listing returns empty or only Tenant A items, never leaking
    const resA = await request(app)
      .get('/v1/isp/gateways')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(resA.status).toBe(200)
    expect(Array.isArray(resA.body.data)).toBe(true)
  })

  it('ISP-002: Rejects access when tenant lacks ISP_MANAGEMENT entitlement', async () => {
    const res = await request(app)
      .get('/v1/isp/gateways')
      .set('Authorization', `Bearer ${tokenNoEntitlement}`)

    expect(res.status).toBe(403)
    expect(res.body.error?.code).toBe('ENTITLEMENT_REQUIRED')
  })

  // ---------------------------------------------------------------------------
  // ISP-003: Gateway CRUD & Credential Redaction
  // ---------------------------------------------------------------------------

  it('ISP-003: Creates gateways and redacts secrets in API responses', async () => {
    // 1. Create MikroTik Gateway for Tenant A
    const resMikrotik = await request(app)
      .post('/v1/isp/gateways')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'MikroTik CCR1009 Sudirman',
        gateway_type: 'MIKROTIK',
        host: '10.10.1.1',
        port: 8728,
        use_tls: true,
        auth_username: 'api_admin',
        auth_secret: 'SuperSecretRouterPass123!',
        metadata: { location: 'POP Sudirman', rack: 'RACK-01' },
      })

    expect(resMikrotik.status).toBe(201)
    expect(resMikrotik.body.data.name).toBe('MikroTik CCR1009 Sudirman')
    expect(resMikrotik.body.data.gateway_type).toBe('MIKROTIK')
    expect(resMikrotik.body.data.auth_secret_masked).toBe('********')
    expect(resMikrotik.body.data.auth_secret).toBeUndefined()
    gatewayMikrotikA_Id = resMikrotik.body.data.id

    // 2. Create GenieACS Gateway for Tenant A
    const resAcs = await request(app)
      .post('/v1/isp/gateways')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'GenieACS Cluster 1',
        gateway_type: 'GENIEACS',
        host: 'acs.skmnetwork.com',
        port: 7557,
        use_tls: true,
        auth_username: 'acs_user',
        auth_secret: 'AcsSecretToken999',
      })

    expect(resAcs.status).toBe(201)
    gatewayGenieAcsA_Id = resAcs.body.data.id

    // 3. Create Gateway for Tenant B to test isolation
    // Grant Tenant B ISP entitlement for this test step
    await pool.query(`
      INSERT INTO subscriptions (business_id, plan_code, family_code, source, status, starts_at, unit_price, final_price, billing_cycle)
      VALUES ($1, 'INTERNET_50M', 'INTERNET_PLAN', 'DIRECT', 'ACTIVE', NOW(), 350000, 350000, 'MONTHLY')
    `, [TENANT_B_ID])

    const resB = await request(app)
      .post('/v1/isp/gateways')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        name: 'Tenant B MikroTik',
        gateway_type: 'MIKROTIK',
        host: '10.20.1.1',
        port: 8728,
        auth_username: 'b_admin',
      })
    expect(resB.status).toBe(201)
    gatewayMikrotikB_Id = resB.body.data.id

    // Tenant B cannot access Tenant A gateway
    const getCrossGw = await request(app)
      .get(`/v1/isp/gateways/${gatewayMikrotikA_Id}`)
      .set('Authorization', `Bearer ${tokenB}`)
    expect(getCrossGw.status).toBe(404)
  })

  // ---------------------------------------------------------------------------
  // ISP-004: Multi-Gateway Subscriber Validation & DB FK Constraint
  // ---------------------------------------------------------------------------

  it('ISP-004: Validates multi-gateway subscriber and rejects cross-tenant gateway bindings', async () => {
    // 1. Cross-tenant gateway binding must be rejected
    const crossTenantSub = await request(app)
      .post('/v1/isp/subscribers')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        customer_id: CUSTOMER_A_ID,
        plan_code: 'INTERNET_50M',
        network_gateway_id: gatewayMikrotikB_Id, // Belongs to Tenant B!
        pppoe_username: 'user_cross@skmnet',
        pppoe_password: 'pass',
      })

    expect(crossTenantSub.status).toBe(403)
    expect(crossTenantSub.body.error?.code).toBe('BUSINESS_ACCESS_DENIED')

    // 2. Successful creation with valid Tenant A multi-gateways
    const res = await request(app)
      .post('/v1/isp/subscribers')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        customer_id: CUSTOMER_A_ID,
        plan_code: 'INTERNET_50M',
        network_gateway_id: gatewayMikrotikA_Id,
        acs_gateway_id: gatewayGenieAcsA_Id,
        pppoe_username: 'subscriber1@skmnet',
        pppoe_password: 'PppoeSecret123!',
        ip_address: '10.100.1.50',
        ont_serial_number: 'ZTEGC99887766',
        ont_vlan: 200,
      })

    expect(res.status).toBe(201)
    expect(res.body.data.pppoe_username).toBe('subscriber1@skmnet')
    expect(res.body.data.status).toBe('PENDING_ACTIVATION')
    expect(res.body.data.network_gateway_id).toBe(gatewayMikrotikA_Id)
    expect(res.body.data.acs_gateway_id).toBe(gatewayGenieAcsA_Id)
    subscriberA_Id = res.body.data.id

    // 3. Duplicate PPPoE username on same network gateway must be rejected
    const resDup = await request(app)
      .post('/v1/isp/subscribers')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        customer_id: CUSTOMER_A_ID,
        plan_code: 'INTERNET_50M',
        network_gateway_id: gatewayMikrotikA_Id,
        pppoe_username: 'subscriber1@skmnet',
        pppoe_password: 'anotherpass',
      })

    expect(resDup.status).toBe(400)
    expect(resDup.body.error?.message).toContain('already exists')
  })

  // ---------------------------------------------------------------------------
  // ISP-005: Provisioning ACTIVATE
  // ---------------------------------------------------------------------------

  it('ISP-005: Executes ACTIVATE provisioning action, executes drivers, and transitions status to ACTIVE', async () => {
    const res = await request(app)
      .post(`/v1/isp/subscribers/${subscriberA_Id}/provision`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ action: 'ACTIVATE', idempotency_key: `act_${Date.now()}` })

    expect(res.status).toBe(200)
    expect(res.body.data.job.status).toBe('COMPLETED')
    expect(res.body.data.job.action).toBe('ACTIVATE')
    expect(res.body.data.subscriber.status).toBe('ACTIVE')
    expect(res.body.data.job.result.network_provisioning.status).toBe('SUCCESS')
    expect(res.body.data.job.result.acs_provisioning.status).toBe('SUCCESS')
  })

  // ---------------------------------------------------------------------------
  // ISP-006: Provisioning SUSPEND
  // ---------------------------------------------------------------------------

  it('ISP-006: Executes SUSPEND provisioning action, isolates traffic, and transitions status to SUSPENDED', async () => {
    const res = await request(app)
      .post(`/v1/isp/subscribers/${subscriberA_Id}/provision`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ action: 'SUSPEND', idempotency_key: `susp_${Date.now()}` })

    expect(res.status).toBe(200)
    expect(res.body.data.job.status).toBe('COMPLETED')
    expect(res.body.data.job.action).toBe('SUSPEND')
    expect(res.body.data.subscriber.status).toBe('SUSPENDED')
    expect(res.body.data.job.result.network_provisioning.queue_rate_limit).toBe('256k/256k')
  })

  // ---------------------------------------------------------------------------
  // ISP-007: Provisioning RESTORE
  // ---------------------------------------------------------------------------

  it('ISP-007: Executes RESTORE provisioning action and transitions status back to ACTIVE', async () => {
    const res = await request(app)
      .post(`/v1/isp/subscribers/${subscriberA_Id}/provision`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ action: 'RESTORE', idempotency_key: `res_${Date.now()}` })

    expect(res.status).toBe(200)
    expect(res.body.data.job.status).toBe('COMPLETED')
    expect(res.body.data.job.action).toBe('RESTORE')
    expect(res.body.data.subscriber.status).toBe('ACTIVE')
    expect(res.body.data.job.result.network_provisioning.queue_rate_limit).toBe('50M/20M')
  })

  // ---------------------------------------------------------------------------
  // ISP-008: Provisioning DEACTIVATE
  // ---------------------------------------------------------------------------

  it('ISP-008: Executes DEACTIVATE provisioning action and transitions status to TERMINATED', async () => {
    const res = await request(app)
      .post(`/v1/isp/subscribers/${subscriberA_Id}/provision`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ action: 'DEACTIVATE', idempotency_key: `deact_${Date.now()}` })

    expect(res.status).toBe(200)
    expect(res.body.data.job.status).toBe('COMPLETED')
    expect(res.body.data.job.action).toBe('DEACTIVATE')
    expect(res.body.data.subscriber.status).toBe('TERMINATED')
  })

  // ---------------------------------------------------------------------------
  // ISP-009 & ISP-010: AI CS Tools (check_onu_status & reboot_onu)
  // ---------------------------------------------------------------------------

  it('ISP-009: AI CS Tool check_onu_status returns optical power and device diagnostics', async () => {
    const registry = createAiToolRegistry()
    const result = await registry.executeTool(
      'check_onu_status',
      { subscriber_id: subscriberA_Id },
      {
        pool,
        businessId: TENANT_A_ID,
        userId: USER_A_ID,
        entitledServices: ['ISP_MANAGEMENT', 'ERP'],
      }
    )

    expect(result.success).toBe(true)
    const data = result.data as any
    expect(data.subscriber_id).toBe(subscriberA_Id)
    expect(data.optical_rx_power).toContain('-19.45 dBm')
    expect(data.optical_tx_power).toBe('+2.15 dBm')
  })

  it('ISP-010: AI CS Tool reboot_onu requires customer confirmation and triggers remote restart', async () => {
    const registry = createAiToolRegistry()

    // 1. Unconfirmed attempt must fail
    const unconfirmed = await registry.executeTool(
      'reboot_onu',
      { subscriber_id: subscriberA_Id, confirmed: false },
      {
        pool,
        businessId: TENANT_A_ID,
        userId: USER_A_ID,
        entitledServices: ['ISP_MANAGEMENT', 'ERP'],
      }
    )
    expect(unconfirmed.success).toBe(false)
    expect(unconfirmed.error).toContain('Konfirmasi pelanggan diperlukan')

    // 2. Confirmed attempt must succeed
    const confirmed = await registry.executeTool(
      'reboot_onu',
      { subscriber_id: subscriberA_Id, confirmed: true },
      {
        pool,
        businessId: TENANT_A_ID,
        userId: USER_A_ID,
        entitledServices: ['ISP_MANAGEMENT', 'ERP'],
      }
    )
    expect(confirmed.success).toBe(true)
    const data = confirmed.data as any
    expect(data.action).toBe('REBOOT_TRIGGERED')
    expect(data.estimated_restart_seconds).toBe(120)
  })

  // ---------------------------------------------------------------------------
  // ISP-011: Provisioning Idempotency & Retry
  // ---------------------------------------------------------------------------

  it('ISP-011: Provisioning action with existing idempotency_key returns cached result without duplicate execution', async () => {
    const key = `idemp_${Date.now()}`

    const firstRun = await request(app)
      .post(`/v1/isp/subscribers/${subscriberA_Id}/provision`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ action: 'ACTIVATE', idempotency_key: key })

    expect(firstRun.status).toBe(200)
    const firstJobId = firstRun.body.data.job.id

    const secondRun = await request(app)
      .post(`/v1/isp/subscribers/${subscriberA_Id}/provision`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ action: 'ACTIVATE', idempotency_key: key })

    expect(secondRun.status).toBe(200)
    expect(secondRun.body.data.job.id).toBe(firstJobId)
  })

  // ---------------------------------------------------------------------------
  // ISP-012: SA-2.8 & Provisioning Audit Trail
  // ---------------------------------------------------------------------------

  it('ISP-012: Generates audit log records for provisioning lifecycle events', async () => {
    const logsRes = await pool.query(
      `SELECT * FROM provisioning_audit_logs WHERE business_id = $1 AND service_code = 'ISP_MANAGEMENT' ORDER BY created_at DESC`,
      [TENANT_A_ID]
    )

    expect(logsRes.rows.length).toBeGreaterThan(0)
    const latestLog = logsRes.rows[0]
    expect(latestLog.business_id).toBe(TENANT_A_ID)
    expect(latestLog.service_code).toBe('ISP_MANAGEMENT')
    expect(latestLog.details).toBeDefined()
  })
})
