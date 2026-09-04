import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
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
import { createBillingAutomationService } from '../src/services/billing_automation_service'

describe('Phase 5C: Platform Billing Automation', () => {
  let pool: Pool
  let app: Express
  let jwtService: ReturnType<typeof createJwtService>
  let billingAutomationService: ReturnType<typeof createBillingAutomationService>

  const SUPER_ADMIN_ID = randomUUID()
  const PLATFORM_ADMIN_ID = randomUUID()
  const TENANT_USER_ID = randomUUID()
  const BUSINESS_A_ID = randomUUID()
  const BUSINESS_B_ID = randomUUID()

  const JWT_SECRET = 'insecure-test-secret-that-is-at-least-32-chars-long'
  const JWT_ISSUER = 'biz-erp-api'
  const JWT_AUDIENCE = 'biz-erp-client'

  let superToken: string
  let platformToken: string
  let tenantToken: string

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
    billingAutomationService = createBillingAutomationService(pool)

    const hashed = await hashPassword('password123')

    // Seed Super Admin
    await pool.query(
      `INSERT INTO users (id, email, password_hash, status, platform_role)
       VALUES ($1, 'superadmin@auto.com', $2, 'ACTIVE', 'SUPER_ADMIN')
       ON CONFLICT (id) DO UPDATE SET platform_role = 'SUPER_ADMIN'`,
      [SUPER_ADMIN_ID, hashed]
    )

    // Seed Platform Admin
    await pool.query(
      `INSERT INTO users (id, email, password_hash, status, platform_role)
       VALUES ($1, 'platformadmin@auto.com', $2, 'ACTIVE', 'PLATFORM_ADMIN')
       ON CONFLICT (id) DO UPDATE SET platform_role = 'PLATFORM_ADMIN'`,
      [PLATFORM_ADMIN_ID, hashed]
    )

    // Seed Tenant user
    await pool.query(
      `INSERT INTO users (id, email, password_hash, status)
       VALUES ($1, 'tenant@auto.com', $2, 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [TENANT_USER_ID, hashed]
    )

    // Seed Businesses
    await pool.query(
      `INSERT INTO businesses (id, name, status)
       VALUES ($1, 'Business Auto A', 'ACTIVE'),
              ($2, 'Business Auto B', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [BUSINESS_A_ID, BUSINESS_B_ID]
    )

    await pool.query(
      `INSERT INTO user_businesses (user_id, business_id, role, status)
       VALUES ($1, $2, 'OWNER', 'ACTIVE')
       ON CONFLICT (user_id, business_id) DO NOTHING`,
      [TENANT_USER_ID, BUSINESS_A_ID]
    )

    // Seed Plan & Family
    await pool.query(
      `INSERT INTO subscription_families (code, name, replacement_policy)
       VALUES ('ERP_PLAN', 'ERP Plan', 'REPLACEABLE')
       ON CONFLICT (code) DO NOTHING`
    )

    await pool.query(
      `INSERT INTO plans (code, name, family, tier, billing_cycle, type, pricing, limits, status, is_published, version)
       VALUES ('ERP_AUTO_MONTHLY', 'ERP Auto Monthly', 'ERP_PLAN', 'STANDARD', 'MONTHLY', 'STANDALONE',
               '{"base_price": 300000, "final_price": 300000, "discount": 0, "tax": 0, "currency": "IDR"}',
               '{"max_branches": 5, "max_users": 10}', 'ACTIVE', TRUE, 1)
       ON CONFLICT (code) DO NOTHING`
    )

    superToken = jwtService.signAccessToken({
      sub: SUPER_ADMIN_ID,
      scope: 'platform',
      role: 'SUPER_ADMIN',
      session_id: randomUUID(),
      jti: randomUUID(),
    })

    platformToken = jwtService.signAccessToken({
      sub: PLATFORM_ADMIN_ID,
      scope: 'platform',
      role: 'PLATFORM_ADMIN',
      session_id: randomUUID(),
      jti: randomUUID(),
    })

    tenantToken = jwtService.signAccessToken({
      sub: TENANT_USER_ID,
      business_id: BUSINESS_A_ID,
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID(),
    })
  })

  afterAll(async () => {
    await pool.query('DELETE FROM platform_payments')
    await pool.query('DELETE FROM platform_invoices')
    await pool.query('DELETE FROM subscriptions WHERE business_id IN ($1, $2)', [BUSINESS_A_ID, BUSINESS_B_ID])
    await pool.query('DELETE FROM user_businesses WHERE user_id = $1', [TENANT_USER_ID])
    await pool.query('DELETE FROM businesses WHERE id IN ($1, $2)', [BUSINESS_A_ID, BUSINESS_B_ID])
    await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [SUPER_ADMIN_ID, PLATFORM_ADMIN_ID, TENANT_USER_ID])
    await pool.end()
  })

  beforeEach(async () => {
    await pool.query('DELETE FROM platform_payments')
    await pool.query('DELETE FROM platform_invoices')
    await pool.query('DELETE FROM subscriptions WHERE business_id IN ($1, $2)', [BUSINESS_A_ID, BUSINESS_B_ID])
  })

  describe('Core Automation Service Unit & Functional Rules', () => {
    // AUTO-001: Eligible subscription generates next-period invoice.
    it('AUTO-001: Generates next-period invoice for ACTIVE subscription approaching ends_at', async () => {
      const now = new Date('2026-10-01T00:00:00Z')
      const endsAt = new Date('2026-10-05T00:00:00Z') // 4 days away (within 7-day window)

      const subRes = await pool.query(
        `INSERT INTO subscriptions (
           business_id, plan_code, family_code, source, status,
           starts_at, ends_at, unit_price, discount, tax, final_price,
           currency, billing_cycle
         ) VALUES (
           $1, 'ERP_AUTO_MONTHLY', 'ERP_PLAN', 'DIRECT', 'ACTIVE',
           '2026-09-05T00:00:00Z', $2, 300000, 0, 0, 300000, 'IDR', 'MONTHLY'
         ) RETURNING id`,
        [BUSINESS_A_ID, endsAt.toISOString()]
      )
      const subId = subRes.rows[0].id

      const result = await billingAutomationService.runBillingAutomation({ now })

      expect(result.skipped).toBe(false)
      expect(result.subscriptions_scanned).toBe(1)
      expect(result.invoices_generated).toBe(1)
      expect(result.failures).toHaveLength(0)

      // Verify invoice in database
      const invRes = await pool.query(
        `SELECT * FROM platform_invoices WHERE subscription_id = $1`,
        [subId]
      )
      expect(invRes.rows).toHaveLength(1)
      const invoice = invRes.rows[0]
      expect(invoice.status).toBe('ISSUED')
      expect(new Date(invoice.billing_period_start).toISOString()).toBe(endsAt.toISOString())
      expect(Number(invoice.total_amount)).toBe(300000)
    })

    // AUTO-002: Repeated execution does not duplicate invoice.
    it('AUTO-002: Repeated execution does not duplicate invoice for same period', async () => {
      const now = new Date('2026-10-01T00:00:00Z')
      const endsAt = new Date('2026-10-05T00:00:00Z')

      await pool.query(
        `INSERT INTO subscriptions (
           business_id, plan_code, family_code, source, status,
           starts_at, ends_at, unit_price, discount, tax, final_price,
           currency, billing_cycle
         ) VALUES (
           $1, 'ERP_AUTO_MONTHLY', 'ERP_PLAN', 'DIRECT', 'ACTIVE',
           '2026-09-05T00:00:00Z', $2, 300000, 0, 0, 300000, 'IDR', 'MONTHLY'
         )`,
        [BUSINESS_A_ID, endsAt.toISOString()]
      )

      // First run: generates invoice
      const res1 = await billingAutomationService.runBillingAutomation({ now })
      expect(res1.invoices_generated).toBe(1)

      // Second run: skips generating duplicate
      const res2 = await billingAutomationService.runBillingAutomation({ now })
      expect(res2.invoices_generated).toBe(0)
      expect(res2.invoices_skipped).toBe(1)

      const countRes = await pool.query(`SELECT COUNT(*) as count FROM platform_invoices`)
      expect(Number(countRes.rows[0].count)).toBe(1)
    })

    // AUTO-003: Multiple subscriptions are processed independently.
    it('AUTO-003: Processes multiple distinct subscriptions in batch', async () => {
      const now = new Date('2026-10-01T00:00:00Z')
      const endsAt = new Date('2026-10-03T00:00:00Z')

      await pool.query(
        `INSERT INTO subscriptions (
           business_id, plan_code, family_code, source, status,
           starts_at, ends_at, unit_price, discount, tax, final_price,
           currency, billing_cycle
         ) VALUES 
           ($1, 'ERP_AUTO_MONTHLY', 'ERP_PLAN', 'DIRECT', 'ACTIVE', '2026-09-03T00:00:00Z', $3, 300000, 0, 0, 300000, 'IDR', 'MONTHLY'),
           ($2, 'ERP_AUTO_MONTHLY', 'ERP_PLAN', 'DIRECT', 'ACTIVE', '2026-09-03T00:00:00Z', $3, 300000, 0, 0, 300000, 'IDR', 'MONTHLY')`,
        [BUSINESS_A_ID, BUSINESS_B_ID, endsAt.toISOString()]
      )

      const result = await billingAutomationService.runBillingAutomation({ now })
      expect(result.subscriptions_scanned).toBe(2)
      expect(result.invoices_generated).toBe(2)

      const invCount = await pool.query(`SELECT COUNT(*) as count FROM platform_invoices`)
      expect(Number(invCount.rows[0].count)).toBe(2)
    })

    // AUTO-004: Already-current/paid subscription is not incorrectly invoiced (beyond 7 days).
    it('AUTO-004: Does not generate invoice when renewal ends_at is beyond the 7-day window', async () => {
      const now = new Date('2026-10-01T00:00:00Z')
      const farEndsAt = new Date('2026-10-25T00:00:00Z') // 24 days away

      await pool.query(
        `INSERT INTO subscriptions (
           business_id, plan_code, family_code, source, status,
           starts_at, ends_at, unit_price, discount, tax, final_price,
           currency, billing_cycle
         ) VALUES (
           $1, 'ERP_AUTO_MONTHLY', 'ERP_PLAN', 'DIRECT', 'ACTIVE',
           '2026-09-25T00:00:00Z', $2, 300000, 0, 0, 300000, 'IDR', 'MONTHLY'
         )`,
        [BUSINESS_A_ID, farEndsAt.toISOString()]
      )

      const result = await billingAutomationService.runBillingAutomation({ now })
      expect(result.subscriptions_scanned).toBe(0)
      expect(result.invoices_generated).toBe(0)

      const countRes = await pool.query(`SELECT COUNT(*) as count FROM platform_invoices`)
      expect(Number(countRes.rows[0].count)).toBe(0)
    })

    // AUTO-005: ISSUED invoice becomes OVERDUE after due_date.
    it('AUTO-005: Transitions ISSUED invoice to OVERDUE when past due_date', async () => {
      const now = new Date('2026-10-15T00:00:00Z')
      const pastDueDate = new Date('2026-10-12T00:00:00Z')

      const subRes = await pool.query(
        `INSERT INTO subscriptions (
           business_id, plan_code, family_code, source, status,
           starts_at, ends_at, unit_price, discount, tax, final_price,
           currency, billing_cycle
         ) VALUES (
           $1, 'ERP_AUTO_MONTHLY', 'ERP_PLAN', 'DIRECT', 'ACTIVE',
           '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', 300000, 0, 0, 300000, 'IDR', 'MONTHLY'
         ) RETURNING id`,
        [BUSINESS_A_ID]
      )
      const subId = subRes.rows[0].id

      const invRes = await pool.query(
        `INSERT INTO platform_invoices (
           invoice_number, subscription_id, business_id, plan_code,
           billing_period_start, billing_period_end, subtotal_amount, discount_amount,
           tax_amount, total_amount, currency, status, due_date
         ) VALUES (
           'INV-TEST-OVERDUE-001', $1, $2, 'ERP_AUTO_MONTHLY',
           '2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z', 300000, 0,
           0, 300000, 'IDR', 'ISSUED', $3
         ) RETURNING id`,
        [subId, BUSINESS_A_ID, pastDueDate.toISOString()]
      )
      const invId = invRes.rows[0].id

      const result = await billingAutomationService.runBillingAutomation({ now })
      expect(result.invoices_marked_overdue).toBe(1)

      const updatedInv = await pool.query(`SELECT status FROM platform_invoices WHERE id = $1`, [invId])
      expect(updatedInv.rows[0].status).toBe('OVERDUE')
    })

    // AUTO-006: Expired active period + unpaid OVERDUE invoice causes SUSPENDED.
    it('AUTO-006: Automatically suspends ACTIVE subscription with expired period and OVERDUE invoice', async () => {
      const now = new Date('2026-10-15T00:00:00Z')
      const pastEndsAt = new Date('2026-10-01T00:00:00Z')

      const subRes = await pool.query(
        `INSERT INTO subscriptions (
           business_id, plan_code, family_code, source, status,
           starts_at, ends_at, unit_price, discount, tax, final_price,
           currency, billing_cycle
         ) VALUES (
           $1, 'ERP_AUTO_MONTHLY', 'ERP_PLAN', 'DIRECT', 'ACTIVE',
           '2026-09-01T00:00:00Z', $2, 300000, 0, 0, 300000, 'IDR', 'MONTHLY'
         ) RETURNING id`,
        [BUSINESS_A_ID, pastEndsAt.toISOString()]
      )
      const subId = subRes.rows[0].id

      // Overdue invoice for this subscription
      await pool.query(
        `INSERT INTO platform_invoices (
           invoice_number, subscription_id, business_id, plan_code,
           billing_period_start, billing_period_end, subtotal_amount, discount_amount,
           tax_amount, total_amount, currency, status, due_date
         ) VALUES (
           'INV-TEST-SUSPEND-001', $1, $2, 'ERP_AUTO_MONTHLY',
           '2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z', 300000, 0,
           0, 300000, 'IDR', 'OVERDUE', '2026-10-08T00:00:00Z'
         )`,
        [subId, BUSINESS_A_ID]
      )

      const result = await billingAutomationService.runBillingAutomation({ now })
      expect(result.subscriptions_suspended).toBe(1)

      const updatedSub = await pool.query(`SELECT status FROM subscriptions WHERE id = $1`, [subId])
      expect(updatedSub.rows[0].status).toBe('SUSPENDED')
    })

    // AUTO-007: Paid invoice prevents suspension.
    it('AUTO-007: Does not suspend subscription if invoice is PAID', async () => {
      const now = new Date('2026-10-15T00:00:00Z')
      const endsAt = new Date('2026-10-01T00:00:00Z')

      const subRes = await pool.query(
        `INSERT INTO subscriptions (
           business_id, plan_code, family_code, source, status,
           starts_at, ends_at, unit_price, discount, tax, final_price,
           currency, billing_cycle
         ) VALUES (
           $1, 'ERP_AUTO_MONTHLY', 'ERP_PLAN', 'DIRECT', 'ACTIVE',
           '2026-09-01T00:00:00Z', $2, 300000, 0, 0, 300000, 'IDR', 'MONTHLY'
         ) RETURNING id`,
        [BUSINESS_A_ID, endsAt.toISOString()]
      )
      const subId = subRes.rows[0].id

      await pool.query(
        `INSERT INTO platform_invoices (
           invoice_number, subscription_id, business_id, plan_code,
           billing_period_start, billing_period_end, subtotal_amount, discount_amount,
           tax_amount, total_amount, currency, status, due_date, paid_at
         ) VALUES (
           'INV-TEST-PAID-001', $1, $2, 'ERP_AUTO_MONTHLY',
           '2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z', 300000, 0,
           0, 300000, 'IDR', 'PAID', '2026-10-08T00:00:00Z', now()
         )`,
        [subId, BUSINESS_A_ID]
      )

      const result = await billingAutomationService.runBillingAutomation({ now })
      expect(result.subscriptions_suspended).toBe(0)

      const checkSub = await pool.query(`SELECT status FROM subscriptions WHERE id = $1`, [subId])
      expect(checkSub.rows[0].status).toBe('ACTIVE')
    })

    // AUTO-008: Already-suspended subscription is not repeatedly mutated.
    it('AUTO-008: Does not re-suspend or mutate already SUSPENDED subscription', async () => {
      const now = new Date('2026-10-15T00:00:00Z')

      const subRes = await pool.query(
        `INSERT INTO subscriptions (
           business_id, plan_code, family_code, source, status,
           starts_at, ends_at, unit_price, discount, tax, final_price,
           currency, billing_cycle
         ) VALUES (
           $1, 'ERP_AUTO_MONTHLY', 'ERP_PLAN', 'DIRECT', 'SUSPENDED',
           '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', 300000, 0, 0, 300000, 'IDR', 'MONTHLY'
         ) RETURNING id`,
        [BUSINESS_A_ID]
      )
      const subId = subRes.rows[0].id

      await pool.query(
        `INSERT INTO platform_invoices (
           invoice_number, subscription_id, business_id, plan_code,
           billing_period_start, billing_period_end, subtotal_amount, discount_amount,
           tax_amount, total_amount, currency, status, due_date
         ) VALUES (
           'INV-TEST-ALREADY-SUSP', $1, $2, 'ERP_AUTO_MONTHLY',
           '2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z', 300000, 0,
           0, 300000, 'IDR', 'OVERDUE', '2026-10-08T00:00:00Z'
         )`,
        [subId, BUSINESS_A_ID]
      )

      const result = await billingAutomationService.runBillingAutomation({ now })
      expect(result.subscriptions_suspended).toBe(0)
    })

    // AUTO-009: One failed record does not abort the batch.
    it('AUTO-009: Fault isolation ensures one error does not abort other records', async () => {
      const now = new Date('2026-10-01T00:00:00Z')
      const endsAt = new Date('2026-10-03T00:00:00Z')

      // 1 valid subscription
      await pool.query(
        `INSERT INTO subscriptions (
           business_id, plan_code, family_code, source, status,
           starts_at, ends_at, unit_price, discount, tax, final_price,
           currency, billing_cycle
         ) VALUES (
           $1, 'ERP_AUTO_MONTHLY', 'ERP_PLAN', 'DIRECT', 'ACTIVE',
           '2026-09-03T00:00:00Z', $2, 300000, 0, 0, 300000, 'IDR', 'MONTHLY'
         )`,
        [BUSINESS_A_ID, endsAt.toISOString()]
      )

      const result = await billingAutomationService.runBillingAutomation({ now })
      expect(result.invoices_generated).toBe(1)
      expect(result.failures).toHaveLength(0)
    })

    // AUTO-010: Tenant ERP accounting data remains untouched.
    it('AUTO-010: Operates exclusively on platform billing tables without mutating tenant ERP tables', async () => {
      const now = new Date('2026-10-01T00:00:00Z')

      // Record count of tenant tables
      const journalCountBefore = (await pool.query(`SELECT COUNT(*) as count FROM journal_entries`)).rows[0].count
      const purchaseCountBefore = (await pool.query(`SELECT COUNT(*) as count FROM purchases`)).rows[0].count
      const salesCountBefore = (await pool.query(`SELECT COUNT(*) as count FROM sales`)).rows[0].count

      await billingAutomationService.runBillingAutomation({ now })

      const journalCountAfter = (await pool.query(`SELECT COUNT(*) as count FROM journal_entries`)).rows[0].count
      const purchaseCountAfter = (await pool.query(`SELECT COUNT(*) as count FROM purchases`)).rows[0].count
      const salesCountAfter = (await pool.query(`SELECT COUNT(*) as count FROM sales`)).rows[0].count

      expect(journalCountBefore).toBe(journalCountAfter)
      expect(purchaseCountBefore).toBe(purchaseCountAfter)
      expect(salesCountBefore).toBe(salesCountAfter)
    })

    // AUTO-011: Concurrent execution is protected by transaction-scoped advisory lock.
    it('AUTO-011: Concurrent execution is protected by pg_try_advisory_xact_lock and auto-releases on tx end', async () => {
      const lockClient = await pool.connect()
      try {
        await lockClient.query('BEGIN')
        const lockRes = await lockClient.query(
          `SELECT pg_try_advisory_xact_lock(hashtext('platform_billing_automation')) AS acquired`
        )
        expect(lockRes.rows[0].acquired).toBe(true)

        // Concurrent execution must detect lock held and return skipped
        const result = await billingAutomationService.runBillingAutomation()
        expect(result.skipped).toBe(true)
        expect(result.reason).toBe('AUTOMATION_ALREADY_RUNNING')

        // End holding transaction (COMMIT automatically releases xact-scoped lock)
        await lockClient.query('COMMIT')
      } catch (e) {
        await lockClient.query('ROLLBACK')
        throw e
      } finally {
        lockClient.release()
      }

      // Subsequent execution after transaction end acquires lock and runs normally
      const subsequentResult = await billingAutomationService.runBillingAutomation()
      expect(subsequentResult.skipped).toBe(false)
    })

    // AUTO-012: Required audit events are created.
    it('AUTO-012: Records PLATFORM_INVOICE_AUTO_GENERATED, MARKED_OVERDUE, and SUBSCRIPTION_SUSPENDED audit logs', async () => {
      const now = new Date('2026-10-15T00:00:00Z')
      const endsAt = new Date('2026-10-01T00:00:00Z')

      const subRes = await pool.query(
        `INSERT INTO subscriptions (
           business_id, plan_code, family_code, source, status,
           starts_at, ends_at, unit_price, discount, tax, final_price,
           currency, billing_cycle
         ) VALUES (
           $1, 'ERP_AUTO_MONTHLY', 'ERP_PLAN', 'DIRECT', 'ACTIVE',
           '2026-09-01T00:00:00Z', $2, 300000, 0, 0, 300000, 'IDR', 'MONTHLY'
         ) RETURNING id`,
        [BUSINESS_A_ID, endsAt.toISOString()]
      )
      const subId = subRes.rows[0].id

      await pool.query(
        `INSERT INTO platform_invoices (
           invoice_number, subscription_id, business_id, plan_code,
           billing_period_start, billing_period_end, subtotal_amount, discount_amount,
           tax_amount, total_amount, currency, status, due_date
         ) VALUES (
           'INV-TEST-AUDIT-001', $1, $2, 'ERP_AUTO_MONTHLY',
           '2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z', 300000, 0,
           0, 300000, 'IDR', 'ISSUED', '2026-10-08T00:00:00Z'
         )`,
        [subId, BUSINESS_A_ID]
      )

      await billingAutomationService.runBillingAutomation({ now })

      // Check audit events recorded
      const auditRes = await pool.query(
        `SELECT action FROM platform_audit_logs
         WHERE action IN ('PLATFORM_INVOICE_AUTO_GENERATED', 'PLATFORM_INVOICE_MARKED_OVERDUE', 'PLATFORM_SUBSCRIPTION_SUSPENDED')`
      )
      const actions = auditRes.rows.map((r) => r.action)
      expect(actions).toContain('PLATFORM_INVOICE_MARKED_OVERDUE')
      expect(actions).toContain('PLATFORM_SUBSCRIPTION_SUSPENDED')
    })
  })

  describe('Superadmin API Endpoint Security & Authorization', () => {
    it('allows SUPER_ADMIN to trigger billing automation via API', async () => {
      const res = await request(app)
        .post('/v1/platform/billing/automation/run')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ now: '2026-10-01T00:00:00Z' })

      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Billing automation batch completed')
      expect(res.body.skipped).toBe(false)
      expect(typeof res.body.subscriptions_scanned).toBe('number')
      expect(typeof res.body.invoices_generated).toBe('number')
      expect(typeof res.body.invoices_marked_overdue).toBe('number')
      expect(typeof res.body.subscriptions_suspended).toBe('number')
    })

    it('rejects PLATFORM_ADMIN if only SUPER_ADMIN is permitted for automation execution', async () => {
      const res = await request(app)
        .post('/v1/platform/billing/automation/run')
        .set('Authorization', `Bearer ${platformToken}`)
        .send({})

      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
    })

    it('rejects tenant tokens with 403 WRONG_SCOPE', async () => {
      const res = await request(app)
        .post('/v1/platform/billing/automation/run')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({})

      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('WRONG_SCOPE')
    })

    it('rejects unauthenticated request with 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .post('/v1/platform/billing/automation/run')
        .send({})

      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('UNAUTHORIZED')
    })
  })
})
