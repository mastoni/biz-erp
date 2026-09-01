import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { Pool } from 'pg'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'

describe('Phase SA-2.1: Commercial Governance Database Migration Foundation', { timeout: 30000 }, () => {
  let pool: Pool

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
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
        businesses,
        users
      RESTART IDENTITY CASCADE
    `)
  }, 30000)

  it('1. Plans table supports governance fields (limits, trial_days, is_published, display_order, version)', async () => {
    const insertRes = await pool.query(`
      INSERT INTO plans (
        code, name, family, tier, billing_cycle, pricing, type, status, limits, trial_days, is_published, display_order, version
      ) VALUES (
        'ERP_PRO_TEST', 'ERP Pro Retail', 'ERP_PLAN', 'PRO', 'MONTHLY',
        '{"base_price": 350000, "discount": 0, "tax": 38500, "final_price": 388500, "currency": "IDR"}',
        'STANDALONE', 'ACTIVE',
        '{"max_branches": 5, "max_users": 10}', 14, TRUE, 1, 1
      ) RETURNING *
    `)

    expect(insertRes.rows.length).toBe(1)
    const plan = insertRes.rows[0]
    expect(plan.code).toBe('ERP_PRO_TEST')
    expect(plan.limits).toEqual({ max_branches: 5, max_users: 10 })
    expect(plan.trial_days).toBe(14)
    expect(plan.is_published).toBe(true)
    expect(plan.display_order).toBe(1)
    expect(plan.version).toBe(1)
  })

  it('2. Bundles table supports governance fields', async () => {
    const insertRes = await pool.query(`
      INSERT INTO bundles (
        code, name, pricing, target_segment, installation_required, status, is_published, display_order, version
      ) VALUES (
        'BUNDLE_RETAIL_1', 'Paket Toko Cerdas',
        '{"one_time": 1500000, "monthly": 500000, "commitment_months": 12}',
        'RETAIL', TRUE, 'ACTIVE', TRUE, 2, 1
      ) RETURNING *
    `)

    expect(insertRes.rows.length).toBe(1)
    const bundle = insertRes.rows[0]
    expect(bundle.code).toBe('BUNDLE_RETAIL_1')
    expect(bundle.is_published).toBe(true)
    expect(bundle.display_order).toBe(2)
    expect(bundle.version).toBe(1)
  })

  it('3. Catalog Products table supports governance fields', async () => {
    const insertRes = await pool.query(`
      INSERT INTO catalog_products (
        code, name, type, category, billing_model, base_price, currency, status, is_published, display_order, version
      ) VALUES (
        'ISP_50M_TEST', 'Internet Bisnis 50 Mbps', 'INTERNET', 'CONNECTIVITY', 'RECURRING',
        450000, 'IDR', 'ACTIVE', TRUE, 1, 1
      ) RETURNING *
    `)

    expect(insertRes.rows.length).toBe(1)
    const product = insertRes.rows[0]
    expect(product.code).toBe('ISP_50M_TEST')
    expect(Number(product.base_price)).toBe(450000)
    expect(product.is_published).toBe(true)
  })

  it('4. Showcase Items enforces target integrity (exactly one target entity)', async () => {
    // Seed a plan and a bundle
    await pool.query(`
      INSERT INTO plans (code, name, family, tier, billing_cycle, pricing, type, status)
      VALUES ('PLAN_TEST_SHOWCASE', 'Plan Test', 'ERP_PLAN', 'PRO', 'MONTHLY', '{}', 'STANDALONE', 'ACTIVE')
    `)
    await pool.query(`
      INSERT INTO bundles (code, name, pricing, status)
      VALUES ('BUNDLE_TEST_SHOWCASE', 'Bundle Test', '{}', 'ACTIVE')
    `)

    // Valid PLAN showcase item
    const validPlanShowcase = await pool.query(`
      INSERT INTO showcase_items (
        section, item_type, plan_code, display_name, headline, marketing_badge, features_list, display_order, is_featured, is_published
      ) VALUES (
        'ERP_PLANS', 'PLAN', 'PLAN_TEST_SHOWCASE', 'ERP Juara UMKM', 'Cocok untuk toko berkembang',
        'PALING POPULER', '["Kasir Offline", "Multi Cabang"]', 1, TRUE, TRUE
      ) RETURNING *
    `)
    expect(validPlanShowcase.rows.length).toBe(1)
    expect(validPlanShowcase.rows[0].display_name).toBe('ERP Juara UMKM')

    // Valid BUNDLE showcase item
    const validBundleShowcase = await pool.query(`
      INSERT INTO showcase_items (
        section, item_type, bundle_code, display_name, marketing_badge, display_order
      ) VALUES (
        'BUNDLES', 'BUNDLE', 'BUNDLE_TEST_SHOWCASE', 'Paket Lengkap POS + Internet', 'HEMAT 20%', 2
      ) RETURNING *
    `)
    expect(validBundleShowcase.rows.length).toBe(1)

    // Invalid showcase item: item_type PLAN but bundle_code provided -> MUST FAIL CHECK constraint
    await expect(pool.query(`
      INSERT INTO showcase_items (
        section, item_type, plan_code, bundle_code, display_name
      ) VALUES (
        'HERO_FEATURED', 'PLAN', 'PLAN_TEST_SHOWCASE', 'BUNDLE_TEST_SHOWCASE', 'Conflicted Item'
      )
    `)).rejects.toThrow()

    // Invalid showcase item: item_type PLAN but plan_code is NULL -> MUST FAIL CHECK constraint
    await expect(pool.query(`
      INSERT INTO showcase_items (
        section, item_type, display_name
      ) VALUES (
        'HERO_FEATURED', 'PLAN', 'Missing Target Item'
      )
    `)).rejects.toThrow()
  })

  it('5. Cascading deletion of plan removes associated showcase item', async () => {
    await pool.query(`
      INSERT INTO plans (code, name, family, tier, billing_cycle, pricing, type, status)
      VALUES ('PLAN_TO_DELETE', 'Plan Temp', 'ERP_PLAN', 'PRO', 'MONTHLY', '{}', 'STANDALONE', 'ACTIVE')
    `)
    await pool.query(`
      INSERT INTO showcase_items (section, item_type, plan_code, display_name)
      VALUES ('ERP_PLANS', 'PLAN', 'PLAN_TO_DELETE', 'Showcase Temp')
    `)

    const before = await pool.query('SELECT * FROM showcase_items WHERE plan_code = $1', ['PLAN_TO_DELETE'])
    expect(before.rows.length).toBe(1)

    await pool.query('DELETE FROM plans WHERE code = $1', ['PLAN_TO_DELETE'])

    const after = await pool.query('SELECT * FROM showcase_items WHERE plan_code = $1', ['PLAN_TO_DELETE'])
    expect(after.rows.length).toBe(0)
  })
})
