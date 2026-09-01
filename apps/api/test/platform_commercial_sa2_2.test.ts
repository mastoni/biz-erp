import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { Pool } from 'pg'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { createJwtService } from '../src/services/jwt_service'
import { randomUUID } from 'crypto'
import path from 'path'

describe('Phase SA-2.2: Platform Commercial Governance API Integration Tests', { timeout: 30000 }, () => {
  let pool: Pool
  let app: any
  let jwtService: any
  let superadminToken: string
  let platformAdminToken: string
  let tenantOwnerToken: string

  const JWT_SECRET = 'test-secret-at-least-32-chars-long-for-jwt-signing'
  const JWT_ISSUER = 'biz-erp-api'
  const JWT_AUDIENCE = 'biz-erp-client'

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
  }, 30000)

  afterAll(async () => {
    await pool.end()
  })

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE TABLE
        showcase_items,
        bundle_items,
        bundles,
        plan_modules,
        subscriptions,
        plans,
        catalog_products,
        modules,
        user_businesses,
        businesses,
        users
      RESTART IDENTITY CASCADE
    `)

    // Seed Platform Users
    const superId = randomUUID()
    await pool.query(`
      INSERT INTO users (id, email, password_hash, status, platform_role)
      VALUES ($1, 'superadmin@skmnetwork.com', 'dummy_hash', 'ACTIVE', 'SUPER_ADMIN')
    `, [superId])

    const platId = randomUUID()
    await pool.query(`
      INSERT INTO users (id, email, password_hash, status, platform_role)
      VALUES ($1, 'platformadmin@skmnetwork.com', 'dummy_hash', 'ACTIVE', 'PLATFORM_ADMIN')
    `, [platId])

    // Seed Tenant User & Business
    const tenantUserId = randomUUID()
    await pool.query(`
      INSERT INTO users (id, email, password_hash, status)
      VALUES ($1, 'owner@tenant.com', 'dummy_hash', 'ACTIVE')
    `, [tenantUserId])

    const bizId = randomUUID()
    await pool.query(`
      INSERT INTO businesses (id, name, owner_user_id, status)
      VALUES ($1, 'Toko Tenant Test', $2, 'ACTIVE')
    `, [bizId, tenantUserId])

    await pool.query(`
      INSERT INTO user_businesses (user_id, business_id, role, status)
      VALUES ($1, $2, 'OWNER', 'ACTIVE')
    `, [tenantUserId, bizId])

    // Generate tokens
    superadminToken = jwtService.signAccessToken({
      sub: superId,
      scope: 'platform',
      role: 'SUPER_ADMIN',
      session_id: randomUUID(),
      jti: randomUUID()
    })

    platformAdminToken = jwtService.signAccessToken({
      sub: platId,
      scope: 'platform',
      role: 'PLATFORM_ADMIN',
      session_id: randomUUID(),
      jti: randomUUID()
    })

    tenantOwnerToken = jwtService.signAccessToken({
      sub: tenantUserId,
      scope: 'tenant',
      business_id: bizId,
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID()
    })

    // Seed canonical modules for plan entitlement testing
    await pool.query(`
      INSERT INTO modules (code, name, pillar, category, is_core, status)
      VALUES
        ('POS', 'Point of Sale', 'OPERATE', 'SALES', TRUE, 'ACTIVE'),
        ('INVENTORY', 'Manajemen Inventaris', 'OPERATE', 'LOGISTICS', TRUE, 'ACTIVE'),
        ('FINANCE', 'Keuangan & Akuntansi', 'OPERATE', 'FINANCE', FALSE, 'ACTIVE'),
        ('CRM', 'Manajemen Pelanggan', 'OPERATE', 'SALES', FALSE, 'ACTIVE')
    `)

    // Seed canonical catalog product for bundle and showcase testing
    await pool.query(`
      INSERT INTO catalog_products (code, name, type, category, billing_model, base_price, currency, status)
      VALUES
        ('ISP_50M', 'Internet Bisnis 50 Mbps', 'INTERNET', 'CONNECTIVITY', 'RECURRING', 450000, 'IDR', 'ACTIVE'),
        ('ROUTER_MIKROTIK', 'Router MikroTik hEX', 'HARDWARE', 'HARDWARE', 'ONE_TIME', 850000, 'IDR', 'ACTIVE')
    `)
  }, 30000)

  // ===========================================================================
  // 1. PLAN GOVERNANCE & PRICING
  // ===========================================================================
  describe('Plan Governance & Pricing', () => {
    it('creates a new plan with limits, trial_days, and IDR direct integer pricing', async () => {
      const res = await request(app)
        .post('/v1/platform/plans')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          code: 'ERP_GROWTH_2026',
          name: 'Paket Usaha Berkembang',
          family: 'ERP_PLAN',
          tier: 'GROWTH',
          billing_cycle: 'MONTHLY',
          pricing: {
            base_price: 250000,
            discount: 50000,
            tax: 22000,
            final_price: 222000
          },
          trial_days: 14,
          limits: { max_branches: 3, max_users: 5 },
          status: 'DRAFT',
          is_published: false,
          display_order: 1
        })

      expect(res.status).toBe(201)
      expect(res.body.plan.code).toBe('ERP_GROWTH_2026')
      expect(res.body.plan.pricing.base_price).toBe(250000)
      expect(res.body.plan.pricing.final_price).toBe(222000)
      expect(res.body.plan.limits).toEqual({ max_branches: 3, max_users: 5 })
      expect(res.body.plan.trial_days).toBe(14)
      expect(res.body.plan.status).toBe('DRAFT')
    })

    it('updates plan pricing and checks optimistic concurrency', async () => {
      // Create initial plan
      await request(app)
        .post('/v1/platform/plans')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          code: 'ERP_TEST_EDIT',
          name: 'Plan Original Name',
          family: 'ERP_PLAN',
          pricing: { base_price: 100000 }
        })

      // Update with matching expected_version (1)
      const updateRes = await request(app)
        .put('/v1/platform/plans/ERP_TEST_EDIT')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          name: 'Plan Updated Name',
          expected_version: 1,
          pricing: { base_price: 150000, final_price: 150000 }
        })

      expect(updateRes.status).toBe(200)
      expect(updateRes.body.plan.name).toBe('Plan Updated Name')
      expect(updateRes.body.plan.version).toBe(2)

      // Update with outdated expected_version (1) -> MUST FAIL 409 CONFLICT
      const conflictRes = await request(app)
        .put('/v1/platform/plans/ERP_TEST_EDIT')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          name: 'Plan Conflicted Edit',
          expected_version: 1
        })

      expect(conflictRes.status).toBe(409)
    })

    it('handles status transitions and module assignment', async () => {
      await request(app)
        .post('/v1/platform/plans')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          code: 'ERP_MODULE_TEST',
          name: 'Plan Module Test',
          family: 'ERP_PLAN',
          status: 'DRAFT'
        })

      // Assign valid modules
      const modRes = await request(app)
        .put('/v1/platform/plans/ERP_MODULE_TEST/modules')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          modules: [
            { module_code: 'POS', feature_overrides: { offline_mode: true } },
            { module_code: 'INVENTORY' }
          ]
        })
      expect(modRes.status).toBe(200)
      expect(modRes.body.module_count).toBe(2)

      // Assign invalid module -> 400 INVALID_MODULE
      const invalidModRes = await request(app)
        .put('/v1/platform/plans/ERP_MODULE_TEST/modules')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          modules: [{ module_code: 'NON_EXISTENT_MODULE' }]
        })
      expect(invalidModRes.status).toBe(400)

      // Transition status to ACTIVE
      const statusRes = await request(app)
        .patch('/v1/platform/plans/ERP_MODULE_TEST/status')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ status: 'ACTIVE' })
      expect(statusRes.status).toBe(200)
      expect(statusRes.body.plan.status).toBe('ACTIVE')

      // Transition to invalid status -> 400
      const invalidStatusRes = await request(app)
        .patch('/v1/platform/plans/ERP_MODULE_TEST/status')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ status: 'UNKNOWN_STATUS' })
      expect(invalidStatusRes.status).toBe(400)

      // Detail endpoint returns allocated modules
      const detailRes = await request(app)
        .get('/v1/platform/plans/ERP_MODULE_TEST')
        .set('Authorization', `Bearer ${superadminToken}`)
      expect(detailRes.status).toBe(200)
      expect(detailRes.body.modules.length).toBe(2)
      expect(detailRes.body.modules.map((m: any) => m.code)).toContain('POS')
    })
  })

  // ===========================================================================
  // 2. BUNDLE GOVERNANCE & ITEMS
  // ===========================================================================
  describe('Bundle Governance & Items', () => {
    it('creates bundle, adds items, and enforces activation integrity', async () => {
      // Create plan for bundle
      await request(app)
        .post('/v1/platform/plans')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ code: 'ERP_BUNDLE_PART', name: 'ERP Plan Part', status: 'ACTIVE' })

      // Create bundle
      const createRes = await request(app)
        .post('/v1/platform/bundles')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          code: 'SMART_STORE_PRO',
          name: 'Paket Toko Pintar Pro',
          pricing: { one_time: 1000000, monthly: 650000, commitment_months: 12 },
          target_segment: 'RETAIL_STORE',
          installation_required: true,
          status: 'DRAFT'
        })
      expect(createRes.status).toBe(201)

      // Attempt activation without items -> 400 BUNDLE_EMPTY
      const emptyActivateRes = await request(app)
        .patch('/v1/platform/bundles/SMART_STORE_PRO/status')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ status: 'ACTIVE' })
      expect(emptyActivateRes.status).toBe(400)
      expect(emptyActivateRes.body.error.code).toBe('BUNDLE_EMPTY')

      // Add items (quantity >= 1)
      const itemsRes = await request(app)
        .put('/v1/platform/bundles/SMART_STORE_PRO/items')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          items: [
            { item_type: 'PLAN', item_code: 'ERP_BUNDLE_PART', quantity: 1, required: true },
            { item_type: 'PRODUCT', item_code: 'ISP_50M', quantity: 1, required: true },
            { item_type: 'HARDWARE', item_code: 'ROUTER_MIKROTIK', quantity: 2, required: false }
          ]
        })
      expect(itemsRes.status).toBe(200)
      expect(itemsRes.body.item_count).toBe(3)

      // Attempt adding item with quantity 0 -> MUST FAIL 400
      const invalidQtyRes = await request(app)
        .put('/v1/platform/bundles/SMART_STORE_PRO/items')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          items: [{ item_type: 'PLAN', item_code: 'ERP_BUNDLE_PART', quantity: 0 }]
        })
      expect(invalidQtyRes.status).toBe(400)

      // Activate bundle now that valid active items exist -> MUST PASS 200
      const activeRes = await request(app)
        .patch('/v1/platform/bundles/SMART_STORE_PRO/status')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ status: 'ACTIVE' })
      expect(activeRes.status).toBe(200)
      expect(activeRes.body.bundle.status).toBe('ACTIVE')
    })
  })

  // ===========================================================================
  // 3. SHOWCASE GOVERNANCE & MULTI-SECTION PLACEMENT
  // ===========================================================================
  describe('Showcase Governance', () => {
    it('supports multi-section placement, target exclusivity, and publishing toggle', async () => {
      // Seed an active plan
      await request(app)
        .post('/v1/platform/plans')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          code: 'ERP_SHOWCASE_TARGET',
          name: 'Paket ERP Showcase',
          family: 'ERP_PLAN',
          status: 'ACTIVE',
          pricing: { base_price: 300000, final_price: 300000 }
        })

      // Placement 1: Hero section
      const p1 = await request(app)
        .post('/v1/platform/showcase')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          section: 'HERO_FEATURED',
          item_type: 'PLAN',
          plan_code: 'ERP_SHOWCASE_TARGET',
          display_name: 'Solusi Bisnis #1 di Indonesia',
          marketing_badge: 'TERLARIS',
          display_order: 1,
          is_featured: true,
          is_published: true
        })
      expect(p1.status).toBe(201)

      // Placement 2: Same plan in ERP_PLANS section
      const p2 = await request(app)
        .post('/v1/platform/showcase')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          section: 'ERP_PLANS',
          item_type: 'PLAN',
          plan_code: 'ERP_SHOWCASE_TARGET',
          display_name: 'Paket Lengkap POS + Akuntansi',
          features_list: ['Kasir Cepat', 'Laporan Laba Rugi Realtime'],
          display_order: 2,
          is_published: true
        })
      expect(p2.status).toBe(201)

      // Target exclusivity check: sending both plan_code and bundle_code -> MUST FAIL
      const invalidTarget = await request(app)
        .post('/v1/platform/showcase')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          section: 'HERO_FEATURED',
          item_type: 'PLAN',
          plan_code: 'ERP_SHOWCASE_TARGET',
          bundle_code: 'SOME_BUNDLE',
          display_name: 'Conflicted'
        })
      expect(invalidTarget.status).toBe(400)

      // Toggle unpublish
      const unpubRes = await request(app)
        .patch(`/v1/platform/showcase/${p1.body.item.id}/publish`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ is_published: false })
      expect(unpubRes.status).toBe(200)
      expect(unpubRes.body.item.is_published).toBe(false)
    })
  })

  // ===========================================================================
  // 4. PUBLIC SHOWCASE API
  // ===========================================================================
  describe('Public Showcase API', () => {
    it('returns only published items with active targets without requiring authentication', async () => {
      // Seed active plan & draft plan
      await request(app)
        .post('/v1/platform/plans')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          code: 'ERP_PUB_ACTIVE',
          name: 'Paket Publik Aktif',
          status: 'ACTIVE',
          pricing: { base_price: 200000, final_price: 200000 }
        })

      await request(app)
        .post('/v1/platform/plans')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          code: 'ERP_PUB_DRAFT',
          name: 'Paket Draft Internal',
          status: 'DRAFT'
        })

      // Create published showcase for active plan
      await request(app)
        .post('/v1/platform/showcase')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          section: 'ERP_PLANS',
          item_type: 'PLAN',
          plan_code: 'ERP_PUB_ACTIVE',
          display_name: 'Paket Usaha Mantap',
          display_order: 1,
          is_published: true
        })

      // Create published showcase for draft plan (should be filtered out by public API)
      await request(app)
        .post('/v1/platform/showcase')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          section: 'ERP_PLANS',
          item_type: 'PLAN',
          plan_code: 'ERP_PUB_DRAFT',
          display_name: 'Paket Draft Tampil',
          display_order: 2,
          is_published: true
        })

      // Create unpublished showcase for active plan (should be filtered out)
      await request(app)
        .post('/v1/platform/showcase')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          section: 'ERP_PLANS',
          item_type: 'PLAN',
          plan_code: 'ERP_PUB_ACTIVE',
          display_name: 'Paket Unpublished',
          display_order: 3,
          is_published: false
        })

      // Public unauthenticated request
      const pubRes = await request(app)
        .get('/v1/public/showcase?section=ERP_PLANS')

      expect(pubRes.status).toBe(200)
      expect(pubRes.body.items.length).toBe(1)
      expect(pubRes.body.items[0].item_code).toBe('ERP_PUB_ACTIVE')
      expect(pubRes.body.items[0].display_name).toBe('Paket Usaha Mantap')
      expect(pubRes.body.items[0].pricing.final_price).toBe(200000)
    })
  })

  // ===========================================================================
  // 5. SECURITY & SCOPE ENFORCEMENT
  // ===========================================================================
  describe('Security & Scope Enforcement', () => {
    it('strictly rejects tenant token on platform routes with 403 WRONG_SCOPE', async () => {
      const tenantRes = await request(app)
        .get('/v1/platform/plans')
        .set('Authorization', `Bearer ${tenantOwnerToken}`)

      expect(tenantRes.status).toBe(403)
      expect(tenantRes.body.error.code).toBe('WRONG_SCOPE')
    })

    it('allows SUPER_ADMIN and PLATFORM_ADMIN on platform routes', async () => {
      const superRes = await request(app)
        .get('/v1/platform/plans')
        .set('Authorization', `Bearer ${superadminToken}`)
      expect(superRes.status).toBe(200)

      const platRes = await request(app)
        .get('/v1/platform/plans')
        .set('Authorization', `Bearer ${platformAdminToken}`)
      expect(platRes.status).toBe(200)
    })
  })
})
