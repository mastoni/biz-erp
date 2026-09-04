import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { Pool } from 'pg'
import path from 'path'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { createPlatformService } from '../src/services/platform_service'

describe('Canonical ERP UMKM & Grosir Commercial Bundles (Migration 045)', () => {
  let pool: Pool
  let platformService: ReturnType<typeof createPlatformService>

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    }

    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
    const fs = await import('fs')
    const sql044 = fs.readFileSync(path.resolve(process.cwd(), 'migrations/044_canonical_demo_catalog_and_bundles.sql'), 'utf-8')
    await pool.query(sql044)
    const sql045 = fs.readFileSync(path.resolve(process.cwd(), 'migrations/045_canonical_erp_umkm_bundles.sql'), 'utf-8')
    await pool.query(sql045)
    platformService = createPlatformService(pool)
  })

  afterAll(async () => {
    await pool.end()
  })

  it('1. verifies canonical supporting ERP/POS products and services exist', async () => {
    const expectedProducts = [
      { code: 'POS_PRINTER_THERMAL', type: 'HARDWARE', category: 'POS_EQUIPMENT', price: 650000 },
      { code: 'POS_SCANNER_BARCODE', type: 'HARDWARE', category: 'POS_EQUIPMENT', price: 350000 },
      { code: 'POS_CASH_DRAWER', type: 'HARDWARE', category: 'POS_EQUIPMENT', price: 450000 },
      { code: 'POS_CUSTOMER_DISPLAY', type: 'HARDWARE', category: 'POS_EQUIPMENT', price: 650000 },
      { code: 'POS_PRINTER_LABEL', type: 'HARDWARE', category: 'POS_EQUIPMENT', price: 850000 },
      { code: 'POS_UPS_650VA', type: 'HARDWARE', category: 'POS_EQUIPMENT', price: 550000 },
      { code: 'ACC_THERMAL_ROLL', type: 'HARDWARE', category: 'ACCESSORIES', price: 75000 },
      { code: 'INSTALL_POS', type: 'SERVICE', category: 'INSTALLATION', price: 200000 },
    ]

    for (const item of expectedProducts) {
      const res = await pool.query(
        `SELECT code, name, type, category, billing_model, base_price, status, is_published
         FROM catalog_products WHERE code = $1`,
        [item.code]
      )
      expect(res.rows.length).toBe(1)
      const row = res.rows[0]
      expect(row.type).toBe(item.type)
      expect(row.category).toBe(item.category)
      expect(Number(row.base_price)).toBe(item.price)
      expect(row.status).toBe('ACTIVE')
      expect(row.is_published).toBe(true)
    }

    // Also verify reused products from 044 are intact
    const routerRes = await pool.query(`SELECT code, type FROM catalog_products WHERE code IN ('ROUTER_WIFI', 'ROUTER_DUALBAND')`)
    expect(routerRes.rows.length).toBe(2)
  })

  it('2. verifies canonical ERP plans exist and are preserved', async () => {
    const basicRes = await pool.query(`SELECT code, family, tier, billing_cycle, pricing, status FROM plans WHERE code = 'ERP_BASIC_MONTHLY'`)
    expect(basicRes.rows.length).toBe(1)
    expect(basicRes.rows[0].family).toBe('ERP_PLAN')
    expect(basicRes.rows[0].tier).toBe('BASIC')
    expect(basicRes.rows[0].status).toBe('ACTIVE')
    expect(Number(basicRes.rows[0].pricing.final_price)).toBe(99000)

    const proRes = await pool.query(`SELECT code, family, tier, billing_cycle, pricing, status FROM plans WHERE code = 'ERP_PRO_MONTHLY'`)
    expect(proRes.rows.length).toBe(1)
    expect(proRes.rows[0].family).toBe('ERP_PLAN')
    expect(proRes.rows[0].tier).toBe('PRO')
    expect(proRes.rows[0].status).toBe('ACTIVE')
    expect(Number(proRes.rows[0].pricing.final_price)).toBe(249000)
  })

  it('3. verifies all 5 canonical ERP commercial bundles exist with 12-month commitment and valid pricing', async () => {
    const expectedBundles = [
      {
        code: 'BUNDLE_ERP_UMKM_STARTER',
        name: 'ERP UMKM Toko Starter 1 Tahun',
        one_time: 1500000,
        monthly: 99000,
        commitment_months: 12,
        target_segment: 'UMKM_RETAIL',
        item_count: 5
      },
      {
        code: 'BUNDLE_ERP_UMKM_LENGKAP',
        name: 'ERP UMKM Toko Lengkap 1 Tahun',
        one_time: 2650000,
        monthly: 99000,
        commitment_months: 12,
        target_segment: 'RETAIL_STORE',
        item_count: 7
      },
      {
        code: 'BUNDLE_ERP_GROSIR_1YR',
        name: 'ERP Grosir UMKM 1 Tahun',
        one_time: 2850000,
        monthly: 249000,
        commitment_months: 12,
        target_segment: 'WHOLESALE_GROSIR',
        item_count: 7
      },
      {
        code: 'BUNDLE_ERP_TOKO_WIFI',
        name: 'ERP Toko + WiFi 1 Tahun',
        one_time: 1750000,
        monthly: 99000,
        commitment_months: 12,
        target_segment: 'STORE_CONNECTIVITY',
        item_count: 6
      },
      {
        code: 'BUNDLE_ERP_UMKM_COMPLETE',
        name: 'ERP UMKM Complete 1 Tahun',
        one_time: 3450000,
        monthly: 249000,
        commitment_months: 12,
        target_segment: 'ALL_IN_ONE_STORE',
        item_count: 9
      },
    ]

    for (const b of expectedBundles) {
      const res = await pool.query(
        `SELECT code, name, pricing, target_segment, installation_required, status, is_published
         FROM bundles WHERE code = $1`,
        [b.code]
      )
      expect(res.rows.length).toBe(1)
      const row = res.rows[0]
      expect(row.name).toBe(b.name)
      expect(Number(row.pricing.one_time)).toBe(b.one_time)
      expect(Number(row.pricing.monthly)).toBe(b.monthly)
      expect(Number(row.pricing.commitment_months)).toBe(b.commitment_months)
      expect(row.target_segment).toBe(b.target_segment)
      expect(row.status).toBe('ACTIVE')
      expect(row.is_published).toBe(true)

      const itemsRes = await pool.query(
        `SELECT item_type, item_code, quantity, required FROM bundle_items WHERE bundle_code = $1 ORDER BY id ASC`,
        [b.code]
      )
      expect(itemsRes.rows.length).toBe(b.item_count)
    }
  })

  it('4. verifies PLAN + HARDWARE + SERVICE composition semantics in bundle_items', async () => {
    // Check BUNDLE_ERP_UMKM_STARTER composition
    const starterItems = await pool.query(
      `SELECT item_type, item_code, quantity FROM bundle_items WHERE bundle_code = 'BUNDLE_ERP_UMKM_STARTER' ORDER BY id ASC`
    )
    const starterTypes = starterItems.rows.map(r => ({ type: r.item_type, code: r.item_code }))
    expect(starterTypes).toEqual([
      { type: 'PLAN', code: 'ERP_BASIC_MONTHLY' },
      { type: 'HARDWARE', code: 'POS_PRINTER_THERMAL' },
      { type: 'HARDWARE', code: 'POS_SCANNER_BARCODE' },
      { type: 'HARDWARE', code: 'POS_CASH_DRAWER' },
      { type: 'SERVICE', code: 'INSTALL_POS' }
    ])

    // Check BUNDLE_ERP_GROSIR_1YR composition
    const grosirItems = await pool.query(
      `SELECT item_type, item_code, quantity FROM bundle_items WHERE bundle_code = 'BUNDLE_ERP_GROSIR_1YR' ORDER BY id ASC`
    )
    const grosirTypes = grosirItems.rows.map(r => ({ type: r.item_type, code: r.item_code }))
    expect(grosirTypes).toEqual([
      { type: 'PLAN', code: 'ERP_PRO_MONTHLY' },
      { type: 'HARDWARE', code: 'POS_PRINTER_THERMAL' },
      { type: 'HARDWARE', code: 'POS_SCANNER_BARCODE' },
      { type: 'HARDWARE', code: 'POS_CASH_DRAWER' },
      { type: 'HARDWARE', code: 'POS_PRINTER_LABEL' },
      { type: 'HARDWARE', code: 'POS_UPS_650VA' },
      { type: 'SERVICE', code: 'INSTALL_POS' }
    ])

    // Check BUNDLE_ERP_TOKO_WIFI composition (reusing ROUTER_WIFI)
    const wifiItems = await pool.query(
      `SELECT item_type, item_code, quantity FROM bundle_items WHERE bundle_code = 'BUNDLE_ERP_TOKO_WIFI' ORDER BY id ASC`
    )
    const wifiTypes = wifiItems.rows.map(r => ({ type: r.item_type, code: r.item_code }))
    expect(wifiTypes).toEqual([
      { type: 'PLAN', code: 'ERP_BASIC_MONTHLY' },
      { type: 'HARDWARE', code: 'POS_PRINTER_THERMAL' },
      { type: 'HARDWARE', code: 'POS_SCANNER_BARCODE' },
      { type: 'HARDWARE', code: 'POS_CASH_DRAWER' },
      { type: 'HARDWARE', code: 'ROUTER_WIFI' },
      { type: 'SERVICE', code: 'INSTALL_POS' }
    ])
  })

  it('5. verifies Superadmin platform service retrieves ERP bundles and components correctly', async () => {
    const list = await platformService.listBundles({ status: 'ACTIVE' })
    expect(list.total).toBeGreaterThanOrEqual(10) // 5 network/CCTV bundles + 5 ERP bundles

    const starterBundle = await platformService.getBundleByCode('BUNDLE_ERP_UMKM_STARTER')
    expect(starterBundle.code).toBe('BUNDLE_ERP_UMKM_STARTER')
    expect(starterBundle.name).toBe('ERP UMKM Toko Starter 1 Tahun')
    expect((starterBundle.items as any[]).length).toBe(5)

    const completeBundle = await platformService.getBundleByCode('BUNDLE_ERP_UMKM_COMPLETE')
    expect(completeBundle.code).toBe('BUNDLE_ERP_UMKM_COMPLETE')
    expect((completeBundle.items as any[]).length).toBe(9)
  })

  it('6. verifies idempotency of Migration 045 execution', async () => {
    // Re-run migration 045 explicitly
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))

    // Verify bundle count remains unchanged
    const bundleRes = await pool.query(`SELECT COUNT(*)::int as count FROM bundles WHERE code LIKE 'BUNDLE_ERP_%' OR code = 'BUNDLE_ERP_GROSIR_1YR'`)
    expect(bundleRes.rows[0].count).toBe(5)

    // Verify product count remains unchanged
    const prodRes = await pool.query(`SELECT COUNT(*)::int as count FROM catalog_products WHERE code LIKE 'POS_%' OR code IN ('ACC_THERMAL_ROLL', 'INSTALL_POS')`)
    expect(prodRes.rows[0].count).toBe(8)
  })
})
