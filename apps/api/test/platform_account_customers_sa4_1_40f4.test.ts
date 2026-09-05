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

describe('Phase 4.1.40F-4: Superadmin Account Customer Management', () => {
  let pool: Pool
  let app: Express
  let jwtService: ReturnType<typeof createJwtService>

  const SUPERADMIN_ID = randomUUID()
  const USER_A_ID = randomUUID()
  const USER_B_ID = randomUUID()

  const BUSINESS_1_ID = randomUUID()
  const BUSINESS_2_ID = randomUUID()

  const JWT_SECRET = 'insecure-test-secret-that-is-at-least-32-chars-long'
  const JWT_ISSUER = 'biz-erp-api'
  const JWT_AUDIENCE = 'biz-erp-client'

  let superadminToken: string
  let tenantToken: string
  let createdAcId: string
  let createdAcCode: string

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

    // Clean up
    await pool.query('DELETE FROM platform_audit_logs WHERE actor_id = $1', [SUPERADMIN_ID])
    await pool.query(`
      UPDATE businesses SET account_customer_id = NULL WHERE account_customer_id IS NOT NULL;
      UPDATE subscriptions SET account_customer_id = NULL WHERE account_customer_id IS NOT NULL;
      DELETE FROM account_customer_users;
      DELETE FROM account_customers;
      DELETE FROM subscriptions WHERE business_id IN ('${BUSINESS_1_ID}', '${BUSINESS_2_ID}');
      DELETE FROM customers WHERE business_id IN ('${BUSINESS_1_ID}', '${BUSINESS_2_ID}');
      DELETE FROM user_businesses WHERE business_id IN ('${BUSINESS_1_ID}', '${BUSINESS_2_ID}');
      DELETE FROM businesses WHERE id IN ('${BUSINESS_1_ID}', '${BUSINESS_2_ID}');
      DELETE FROM users WHERE id IN ('${SUPERADMIN_ID}', '${USER_A_ID}', '${USER_B_ID}');
    `)

    // 1. Seed Superadmin User
    const superAdminEmail = `superadmin_ac_${Date.now()}@skmnetwork.com`
    await pool.query(
      `INSERT INTO users (id, email, password_hash, status, platform_role)
       VALUES ($1, $2, $3, 'ACTIVE', 'SUPER_ADMIN')`,
      [SUPERADMIN_ID, superAdminEmail, hashed]
    )

    // 2. Seed Contact Users
    await pool.query('INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)', [USER_A_ID, `contact_a_${Date.now()}@test.com`, hashed, 'ACTIVE'])
    await pool.query('INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, $4)', [USER_B_ID, `contact_b_${Date.now()}@test.com`, hashed, 'ACTIVE'])

    // 3. Seed Businesses
    await pool.query("INSERT INTO businesses (id, name, status) VALUES ($1, 'Unit Bisnis Alpha', 'ACTIVE')", [BUSINESS_1_ID])
    await pool.query("INSERT INTO businesses (id, name, status) VALUES ($1, 'Unit Bisnis Beta', 'ACTIVE')", [BUSINESS_2_ID])

    // 4. Seed Plans & Families
    await pool.query(`
      INSERT INTO subscription_families (code, name, replacement_policy, description)
      VALUES ('ERP_PLAN', 'ERP Plan', 'REPLACEABLE', 'Core ERP plans')
      ON CONFLICT (code) DO NOTHING
    `)
    await pool.query(`
      INSERT INTO plans (code, name, family, tier, billing_cycle, pricing, type, status)
      VALUES ('PLAN_TEST_PRO', 'Test Plan Pro', 'ERP_PLAN', 'PRO', 'MONTHLY', '{"base_price": 100000}', 'STANDALONE', 'ACTIVE')
      ON CONFLICT (code) DO NOTHING
    `)

    // 5. Seed base Account Customer
    createdAcId = randomUUID()
    createdAcCode = 'ACC-202609-AAAA01'
    await pool.query(`
      INSERT INTO account_customers (id, code, name, account_type, billing_email, status)
      VALUES ($1, $2, 'PT Sinergi Abadi Perkasa', 'BUSINESS', 'billing@sinergiabadi.com', 'ACTIVE')
    `, [createdAcId, createdAcCode])

    // Superadmin login
    const loginRes = await request(app)
      .post('/v1/auth/login')
      .set('x-auth-context', 'platform')
      .send({ email: superAdminEmail, password: 'password123' })
    expect(loginRes.status).toBe(200)
    superadminToken = loginRes.body.access_token

    // Tenant token
    tenantToken = jwtService.signAccessToken({
      sub: USER_A_ID,
      business_id: BUSINESS_1_ID,
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID(),
    })
  }, 60000)

  afterAll(async () => {
    await pool.query('DELETE FROM platform_audit_logs WHERE actor_id = $1', [SUPERADMIN_ID])
    await pool.query(`
      UPDATE businesses SET account_customer_id = NULL WHERE account_customer_id IS NOT NULL;
      UPDATE subscriptions SET account_customer_id = NULL WHERE account_customer_id IS NOT NULL;
      DELETE FROM account_customer_users;
      DELETE FROM account_customers;
      DELETE FROM subscriptions WHERE business_id IN ('${BUSINESS_1_ID}', '${BUSINESS_2_ID}');
      DELETE FROM customers WHERE business_id IN ('${BUSINESS_1_ID}', '${BUSINESS_2_ID}');
      DELETE FROM user_businesses WHERE business_id IN ('${BUSINESS_1_ID}', '${BUSINESS_2_ID}');
      DELETE FROM businesses WHERE id IN ('${BUSINESS_1_ID}', '${BUSINESS_2_ID}');
      DELETE FROM users WHERE id IN ('${SUPERADMIN_ID}', '${USER_A_ID}', '${USER_B_ID}');
    `)
    await pool.end()
  })

  // -------------------------------------------------------------------------
  // 1. Authorization & Security
  // -------------------------------------------------------------------------
  it('AC-ADM-001: rejects unauthenticated and tenant-scoped requests with 401/403 WRONG_SCOPE', async () => {
    // Unauthenticated
    const noAuth = await request(app).get('/v1/platform/account-customers')
    expect(noAuth.status).toBe(401)

    // Tenant Token
    const tenantAuth = await request(app)
      .get('/v1/platform/account-customers')
      .set('Authorization', `Bearer ${tenantToken}`)
    expect(tenantAuth.status).toBe(403)
    expect(tenantAuth.body.error.code).toBe('WRONG_SCOPE')
  })

  // -------------------------------------------------------------------------
  // 2. Account Customer CRUD & Lifecycle
  // -------------------------------------------------------------------------
  it('AC-ADM-002: creates Account Customer and deterministic code', async () => {
    const res = await request(app)
      .post('/v1/platform/account-customers')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({
        name: 'CV Makmur Mandiri',
        account_type: 'BUSINESS',
        billing_email: 'billing@makmurmandiri.com',
        billing_phone: '081122334455',
        tax_id: '01.234.567.8-901.000',
        metadata: { segment: 'retail_chain' },
      })

    expect(res.status).toBe(201)
    expect(res.body.account_customer.id).toBeDefined()
    expect(res.body.account_customer.name).toBe('CV Makmur Mandiri')
    expect(res.body.account_customer.account_type).toBe('BUSINESS')
    expect(res.body.account_customer.billing_email).toBe('billing@makmurmandiri.com')
    expect(res.body.account_customer.status).toBe('ACTIVE')
    expect(res.body.account_customer.code).toMatch(/^ACC-\d{6}-[A-F0-9]{6}$/)

    const newId = res.body.account_customer.id

    // Check Audit Log
    const auditRes = await pool.query(
      "SELECT * FROM platform_audit_logs WHERE action = 'ACCOUNT_CUSTOMER_CREATED' AND target_id = $1",
      [newId]
    )
    expect(auditRes.rows.length).toBe(1)
    expect(auditRes.rows[0].actor_id).toBe(SUPERADMIN_ID)
  })

  it('AC-ADM-003: lists Account Customers with search, filter, and summary', async () => {
    const res = await request(app)
      .get('/v1/platform/account-customers?q=Sinergi&status=ACTIVE&account_type=BUSINESS')
      .set('Authorization', `Bearer ${superadminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.items.length).toBe(1)
    expect(res.body.items[0].id).toBe(createdAcId)
    expect(res.body.summary.total).toBe(2)
    expect(res.body.summary.active_count).toBe(2)
  })

  it('AC-ADM-004: gets Account Customer detail with child statistics', async () => {
    const res = await request(app)
      .get(`/v1/platform/account-customers/${createdAcId}`)
      .set('Authorization', `Bearer ${superadminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(createdAcId)
    expect(res.body.code).toBe(createdAcCode)
    expect(res.body.business_count).toBe(0)
    expect(res.body.active_subscription_count).toBe(0)
    expect(res.body.user_count).toBe(0)
  })

  it('AC-ADM-005: updates Account Customer profile and metadata', async () => {
    const res = await request(app)
      .patch(`/v1/platform/account-customers/${createdAcId}`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({
        name: 'PT Sinergi Abadi Perkasa Tbk',
        account_type: 'ENTERPRISE',
        metadata: { segment: 'enterprise_tier' },
      })

    expect(res.status).toBe(200)
    expect(res.body.account_customer.name).toBe('PT Sinergi Abadi Perkasa Tbk')
    expect(res.body.account_customer.account_type).toBe('ENTERPRISE')

    const auditRes = await pool.query(
      "SELECT * FROM platform_audit_logs WHERE action = 'ACCOUNT_CUSTOMER_UPDATED' AND target_id = $1",
      [createdAcId]
    )
    expect(auditRes.rows.length).toBe(1)
  })

  it('AC-ADM-006: transitions status (SUSPENDED -> ACTIVE)', async () => {
    // Suspend
    const suspRes = await request(app)
      .patch(`/v1/platform/account-customers/${createdAcId}/status`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ status: 'SUSPENDED', reason: 'Audit pending' })

    expect(suspRes.status).toBe(200)
    expect(suspRes.body.account_customer.status).toBe('SUSPENDED')

    // Reactivate
    const actRes = await request(app)
      .patch(`/v1/platform/account-customers/${createdAcId}/status`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ status: 'ACTIVE', reason: 'Audit cleared' })

    expect(actRes.status).toBe(200)
    expect(actRes.body.account_customer.status).toBe('ACTIVE')
  })

  // -------------------------------------------------------------------------
  // 3. User Relationship Management
  // -------------------------------------------------------------------------
  it('AC-ADM-007: manages account_customer_users (add, update role, remove)', async () => {
    // 1. Add User A as PRIMARY_CONTACT
    const addRes = await request(app)
      .post(`/v1/platform/account-customers/${createdAcId}/users`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ user_id: USER_A_ID, role: 'PRIMARY_CONTACT' })

    expect(addRes.status).toBe(201)
    expect(addRes.body.user.account_customer_id).toBe(createdAcId)
    expect(addRes.body.user.user_id).toBe(USER_A_ID)
    expect(addRes.body.user.role).toBe('PRIMARY_CONTACT')
    expect(addRes.body.user.status).toBe('ACTIVE')

    // 2. Add User B as BILLING_ADMIN
    const addBRes = await request(app)
      .post(`/v1/platform/account-customers/${createdAcId}/users`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ user_id: USER_B_ID, role: 'BILLING_ADMIN' })
    expect(addBRes.status).toBe(201)

    // 3. List Users
    const listRes = await request(app)
      .get(`/v1/platform/account-customers/${createdAcId}/users`)
      .set('Authorization', `Bearer ${superadminToken}`)
    expect(listRes.status).toBe(200)
    expect(listRes.body.users.length).toBe(2)

    // 4. Update User B role to AUTHORIZED_USER
    const updateRes = await request(app)
      .patch(`/v1/platform/account-customers/${createdAcId}/users/${USER_B_ID}`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ role: 'AUTHORIZED_USER', status: 'ACTIVE' })
    expect(updateRes.status).toBe(200)
    expect(updateRes.body.user.role).toBe('AUTHORIZED_USER')

    // 5. Remove User B
    const delRes = await request(app)
      .delete(`/v1/platform/account-customers/${createdAcId}/users/${USER_B_ID}`)
      .set('Authorization', `Bearer ${superadminToken}`)
    expect(delRes.status).toBe(200)

    const listAfterDel = await request(app)
      .get(`/v1/platform/account-customers/${createdAcId}/users`)
      .set('Authorization', `Bearer ${superadminToken}`)
    expect(listAfterDel.body.users.length).toBe(1)
    expect(listAfterDel.body.users[0].user_id).toBe(USER_A_ID)
  })

  // -------------------------------------------------------------------------
  // 4. Business Reconciliation, Invariants & Reassignment Protection
  // -------------------------------------------------------------------------
  it('AC-ADM-008: reconciles unlinked business and atomically syncs subscriptions', async () => {
    // Seed an existing subscription for Business 1 without account_customer_id
    const subRes = await pool.query(`
      INSERT INTO subscriptions (
        business_id, plan_code, family_code, source, status, unit_price, final_price, currency, billing_cycle
      ) VALUES ($1, 'PLAN_TEST_PRO', 'ERP_PLAN', 'DIRECT', 'ACTIVE', 100000, 100000, 'IDR', 'MONTHLY')
      RETURNING id
    `, [BUSINESS_1_ID])
    const subId = subRes.rows[0].id

    // Reconcile Business 1 to createdAcId
    const recRes = await request(app)
      .post(`/v1/platform/account-customers/${createdAcId}/businesses/reconcile`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ business_id: BUSINESS_1_ID })

    expect(recRes.status).toBe(200)
    expect(recRes.body.business_id).toBe(BUSINESS_1_ID)
    expect(recRes.body.account_customer_id).toBe(createdAcId)
    expect(recRes.body.subscriptions_synced_count).toBe(1)

    // Verify DB Business
    const bizCheck = await pool.query('SELECT account_customer_id FROM businesses WHERE id = $1', [BUSINESS_1_ID])
    expect(bizCheck.rows[0].account_customer_id).toBe(createdAcId)

    // Verify DB Subscription
    const subCheck = await pool.query('SELECT account_customer_id FROM subscriptions WHERE id = $1', [subId])
    expect(subCheck.rows[0].account_customer_id).toBe(createdAcId)
  })

  it('AC-ADM-009: idempotent reconciliation to the same Account Customer is a safe no-op', async () => {
    const res = await request(app)
      .post(`/v1/platform/account-customers/${createdAcId}/businesses/reconcile`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ business_id: BUSINESS_1_ID })

    expect(res.status).toBe(200)
    expect(res.body.subscriptions_synced_count).toBe(0)
    expect(res.body.message).toContain('already linked')
  })

  it('AC-ADM-010: reassigning business from another Account Customer is BLOCKED without confirmation', async () => {
    // Create second Account Customer (AC 2)
    const ac2Res = await request(app)
      .post('/v1/platform/account-customers')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ name: 'Account Customer Dua', account_type: 'BUSINESS' })
    const ac2Id = ac2Res.body.account_customer.id

    // Attempt to reassign Business 1 (currently owned by createdAcId) to ac2Id without confirmation
    const blockRes = await request(app)
      .post(`/v1/platform/account-customers/${ac2Id}/businesses/reconcile`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ business_id: BUSINESS_1_ID })

    expect(blockRes.status).toBe(409)
    expect(blockRes.body.error.code).toBe('OWNERSHIP_REASSIGNMENT_REQUIRES_CONFIRMATION')

    // Attempt with stale expected_current_account_customer_id
    const staleRes = await request(app)
      .post(`/v1/platform/account-customers/${ac2Id}/businesses/reconcile`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({
        business_id: BUSINESS_1_ID,
        expected_current_account_customer_id: randomUUID(), // wrong id
        confirm_reassignment: true,
      })
    expect(staleRes.status).toBe(409)
    expect(staleRes.body.error.code).toBe('OWNERSHIP_REASSIGNMENT_REQUIRES_CONFIRMATION')
  })

  it('AC-ADM-011: reassigning business SUCCEEDS with expected_current_account_customer_id and confirm_reassignment=true', async () => {
    // Create AC 2
    const ac2Res = await pool.query(`
      INSERT INTO account_customers (code, name, account_type, status)
      VALUES ('ACC-TEST-REASSIGN', 'Account Customer Reassign Target', 'BUSINESS', 'ACTIVE')
      RETURNING id
    `)
    const ac2Id = ac2Res.rows[0].id

    // Reassign with confirmation
    const reassignRes = await request(app)
      .post(`/v1/platform/account-customers/${ac2Id}/businesses/reconcile`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({
        business_id: BUSINESS_1_ID,
        expected_current_account_customer_id: createdAcId,
        confirm_reassignment: true,
        reason: 'Restructuring ownership',
      })

    expect(reassignRes.status).toBe(200)
    expect(reassignRes.body.account_customer_id).toBe(ac2Id)
    expect(reassignRes.body.previous_account_customer_id).toBe(createdAcId)
    expect(reassignRes.body.subscriptions_synced_count).toBe(1)

    // Check DB
    const bizCheck = await pool.query('SELECT account_customer_id FROM businesses WHERE id = $1', [BUSINESS_1_ID])
    expect(bizCheck.rows[0].account_customer_id).toBe(ac2Id)

    const subCheck = await pool.query('SELECT account_customer_id FROM subscriptions WHERE business_id = $1', [BUSINESS_1_ID])
    expect(subCheck.rows[0].account_customer_id).toBe(ac2Id)
  })

  // -------------------------------------------------------------------------
  // 5. Safe Unlink
  // -------------------------------------------------------------------------
  it('AC-ADM-012: unlinking validates route ownership and atomically clears subscriptions', async () => {
    // AC 2 currently owns Business 1
    const ac2Res = await pool.query("SELECT id FROM account_customers WHERE code = 'ACC-TEST-REASSIGN'")
    const ac2Id = ac2Res.rows[0].id

    // 1. Attempt unlinking Business 1 via createdAcId (which no longer owns it) -> REJECTED
    const wrongUnlink = await request(app)
      .post(`/v1/platform/account-customers/${createdAcId}/businesses/${BUSINESS_1_ID}/unlink`)
      .set('Authorization', `Bearer ${superadminToken}`)
    expect(wrongUnlink.status).toBe(400)
    expect(wrongUnlink.body.error.code).toBe('INVALID_BUSINESS_OWNERSHIP')

    // 2. Unlink via ac2Id -> SUCCESS
    const unlinkRes = await request(app)
      .post(`/v1/platform/account-customers/${ac2Id}/businesses/${BUSINESS_1_ID}/unlink`)
      .set('Authorization', `Bearer ${superadminToken}`)

    expect(unlinkRes.status).toBe(200)
    expect(unlinkRes.body.previous_account_customer_id).toBe(ac2Id)
    expect(unlinkRes.body.subscriptions_unlinked_count).toBe(1)

    // Check DB: business and subscription account_customer_id are NULL
    const bizCheck = await pool.query('SELECT account_customer_id FROM businesses WHERE id = $1', [BUSINESS_1_ID])
    expect(bizCheck.rows[0].account_customer_id).toBeNull()

    const subCheck = await pool.query('SELECT account_customer_id FROM subscriptions WHERE business_id = $1', [BUSINESS_1_ID])
    expect(subCheck.rows[0].account_customer_id).toBeNull()

    // Audit log
    const auditRes = await pool.query(
      "SELECT * FROM platform_audit_logs WHERE action = 'BUSINESS_OWNERSHIP_UNLINKED' AND target_id = $1",
      [BUSINESS_1_ID]
    )
    expect(auditRes.rows.length).toBe(1)
  })

  // -------------------------------------------------------------------------
  // 6. Subscriptions Visibility & CRM Invariants
  // -------------------------------------------------------------------------
  it('AC-ADM-013: lists subscriptions across owned businesses under Account Customer', async () => {
    // Link Business 2 to createdAcId
    await pool.query('UPDATE businesses SET account_customer_id = $1 WHERE id = $2', [createdAcId, BUSINESS_2_ID])
    await pool.query(`
      INSERT INTO subscriptions (
        account_customer_id, business_id, plan_code, family_code, source, status, unit_price, final_price, currency, billing_cycle
      ) VALUES ($1, $2, 'PLAN_TEST_PRO', 'ERP_PLAN', 'DIRECT', 'ACTIVE', 100000, 100000, 'IDR', 'MONTHLY')
    `, [createdAcId, BUSINESS_2_ID])

    const res = await request(app)
      .get(`/v1/platform/account-customers/${createdAcId}/subscriptions`)
      .set('Authorization', `Bearer ${superadminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.subscriptions.length).toBe(1)
    expect(res.body.subscriptions[0].business_name).toBe('Unit Bisnis Beta')
    expect(res.body.subscriptions[0].account_customer_id).toBe(createdAcId)
  })

  it('AC-ADM-014: verifies CRM customers table remains untouched and unmutated', async () => {
    // Clean up any stale CRM customer
    await pool.query('DELETE FROM customers WHERE id = $1', ['cccccccc-4444-4ccc-8ccc-cccccccccccc'])

    // Seed CRM customer
    await pool.query(`
      INSERT INTO customers (id, business_id, name, phone, email)
      VALUES ('cccccccc-4444-4ccc-8ccc-cccccccccccc', $1, 'Toko Walk-in Customer', '081234567890', 'crm@retail.com')
    `, [BUSINESS_1_ID])

    const crmBefore = await pool.query('SELECT * FROM customers WHERE business_id = $1', [BUSINESS_1_ID])
    expect(crmBefore.rows.length).toBe(1)

    // Execute list, get, and user operations on Account Customer
    await request(app).get('/v1/platform/account-customers').set('Authorization', `Bearer ${superadminToken}`)
    await request(app).get(`/v1/platform/account-customers/${createdAcId}`).set('Authorization', `Bearer ${superadminToken}`)

    const crmAfter = await pool.query('SELECT * FROM customers WHERE business_id = $1', [BUSINESS_1_ID])
    expect(crmAfter.rows.length).toBe(1)
    expect(crmAfter.rows[0].name).toBe('Toko Walk-in Customer')
  })
})
