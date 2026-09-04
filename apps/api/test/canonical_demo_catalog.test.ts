import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { Pool } from 'pg'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'
import { createPlatformService } from '../src/services/platform_service'

describe('Canonical Demo Product Catalog & Bundles (Migration 044)', () => {
  let pool: Pool
  let platformService: ReturnType<typeof createPlatformService>

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
    const fs = await import('fs')
    const sql044 = fs.readFileSync(path.resolve(process.cwd(), 'migrations/044_canonical_demo_catalog_and_bundles.sql'), 'utf-8')
    await pool.query(sql044)
    platformService = createPlatformService(pool)
  })

  afterAll(async () => {
    await pool.end()
  })

  describe('1. Canonical Catalog Products Seed Verification', () => {
    it('seeds 12 canonical catalog products across all 4 categories', async () => {
      const res = await pool.query(
        `SELECT code, name, type, category, billing_model, base_price, status
         FROM catalog_products
         WHERE code IN (
           'INET_BASIC', 'INET_FAMILY', 'INET_BUSINESS',
           'ONT_FIBER', 'ROUTER_WIFI', 'ROUTER_DUALBAND', 'ACC_LAN_FIBER',
           'CCTV_INDOOR', 'CCTV_OUTDOOR', 'CCTV_4CAM_PKG',
           'INSTALL_WIFI', 'INSTALL_CCTV'
         )
         ORDER BY code ASC`
      )

      expect(res.rows).toHaveLength(12)

      const productMap = new Map(res.rows.map((r) => [r.code, r]))

      // Internet
      expect(productMap.get('INET_BASIC')).toMatchObject({
        type: 'INTERNET',
        billing_model: 'RECURRING',
        status: 'ACTIVE',
      })
      expect(Number(productMap.get('INET_BASIC')?.base_price)).toBe(110000)

      expect(productMap.get('INET_FAMILY')).toMatchObject({
        type: 'INTERNET',
        billing_model: 'RECURRING',
        status: 'ACTIVE',
      })
      expect(Number(productMap.get('INET_FAMILY')?.base_price)).toBe(150000)

      expect(productMap.get('INET_BUSINESS')).toMatchObject({
        type: 'INTERNET',
        billing_model: 'RECURRING',
        status: 'ACTIVE',
      })
      expect(Number(productMap.get('INET_BUSINESS')?.base_price)).toBe(250000)

      // Hardware
      expect(productMap.get('ONT_FIBER')).toMatchObject({
        type: 'HARDWARE',
        billing_model: 'ONE_TIME',
        status: 'ACTIVE',
      })
      expect(Number(productMap.get('ONT_FIBER')?.base_price)).toBe(350000)

      expect(productMap.get('ROUTER_WIFI')).toMatchObject({
        type: 'HARDWARE',
        billing_model: 'ONE_TIME',
        status: 'ACTIVE',
      })
      expect(Number(productMap.get('ROUTER_WIFI')?.base_price)).toBe(250000)

      expect(productMap.get('ROUTER_DUALBAND')).toMatchObject({
        type: 'HARDWARE',
        billing_model: 'ONE_TIME',
        status: 'ACTIVE',
      })
      expect(Number(productMap.get('ROUTER_DUALBAND')?.base_price)).toBe(450000)

      // CCTV
      expect(productMap.get('CCTV_INDOOR')).toMatchObject({
        type: 'HARDWARE',
        billing_model: 'ONE_TIME',
        status: 'ACTIVE',
      })
      expect(Number(productMap.get('CCTV_INDOOR')?.base_price)).toBe(450000)

      expect(productMap.get('CCTV_4CAM_PKG')).toMatchObject({
        type: 'HARDWARE',
        billing_model: 'ONE_TIME',
        status: 'ACTIVE',
      })
      expect(Number(productMap.get('CCTV_4CAM_PKG')?.base_price)).toBe(2500000)

      // Services
      expect(productMap.get('INSTALL_WIFI')).toMatchObject({
        type: 'SERVICE',
        billing_model: 'ONE_TIME',
        status: 'ACTIVE',
      })
      expect(Number(productMap.get('INSTALL_WIFI')?.base_price)).toBe(150000)

      expect(productMap.get('INSTALL_CCTV')).toMatchObject({
        type: 'SERVICE',
        billing_model: 'ONE_TIME',
        status: 'ACTIVE',
      })
      expect(Number(productMap.get('INSTALL_CCTV')?.base_price)).toBe(250000)
    })
  })

  describe('2. Canonical Bundles Seed Verification', () => {
    it('seeds 5 canonical bundles with pricing and metadata', async () => {
      const res = await pool.query(
        `SELECT code, name, pricing, target_segment, status, is_published, display_order
         FROM bundles
         WHERE code IN (
           'BUNDLE_WIFI_BASIC', 'BUNDLE_WIFI_FAMILY', 'BUNDLE_BUSINESS_STARTER',
           'BUNDLE_CCTV_4CAM', 'BUNDLE_HOME_SECURITY'
         )
         ORDER BY display_order ASC`
      )

      expect(res.rows).toHaveLength(5)

      const bundleMap = new Map(res.rows.map((r) => [r.code, r]))

      // Bundle 1: WiFi Basic
      const basic = bundleMap.get('BUNDLE_WIFI_BASIC')
      expect(basic?.status).toBe('ACTIVE')
      expect(basic?.target_segment).toBe('RESIDENTIAL')
      const basicPricing = typeof basic?.pricing === 'string' ? JSON.parse(basic.pricing) : basic?.pricing
      expect(basicPricing.one_time).toBe(350000)
      expect(basicPricing.monthly).toBe(110000)

      // Bundle 2: WiFi Family
      const family = bundleMap.get('BUNDLE_WIFI_FAMILY')
      expect(family?.status).toBe('ACTIVE')
      const familyPricing = typeof family?.pricing === 'string' ? JSON.parse(family.pricing) : family?.pricing
      expect(familyPricing.one_time).toBe(499000)
      expect(familyPricing.monthly).toBe(150000)

      // Bundle 3: Business Starter
      const biz = bundleMap.get('BUNDLE_BUSINESS_STARTER')
      expect(biz?.status).toBe('ACTIVE')
      const bizPricing = typeof biz?.pricing === 'string' ? JSON.parse(biz.pricing) : biz?.pricing
      expect(bizPricing.one_time).toBe(550000)
      expect(bizPricing.monthly).toBe(250000)

      // Bundle 4: CCTV 4 Cam
      const cctv = bundleMap.get('BUNDLE_CCTV_4CAM')
      expect(cctv?.status).toBe('ACTIVE')
      const cctvPricing = typeof cctv?.pricing === 'string' ? JSON.parse(cctv.pricing) : cctv?.pricing
      expect(cctvPricing.one_time).toBe(2650000)
      expect(cctvPricing.monthly).toBe(0)

      // Bundle 5: Home Security All-in-One
      const sec = bundleMap.get('BUNDLE_HOME_SECURITY')
      expect(sec?.status).toBe('ACTIVE')
      const secPricing = typeof sec?.pricing === 'string' ? JSON.parse(sec.pricing) : sec?.pricing
      expect(secPricing.one_time).toBe(1150000)
      expect(secPricing.monthly).toBe(150000)
    })
  })

  describe('3. Bundle Items Referential & Composition Integrity', () => {
    it('links all bundle items to valid catalog products', async () => {
      const res = await pool.query(
        `SELECT bi.bundle_code, bi.item_type, bi.item_code, bi.quantity, bi.required, cp.name as product_name
         FROM bundle_items bi
         JOIN catalog_products cp ON bi.item_code = cp.code
         ORDER BY bi.bundle_code ASC, bi.id ASC`
      )

      expect(res.rows.length).toBeGreaterThanOrEqual(16)

      const wifiBasicItems = res.rows.filter((r) => r.bundle_code === 'BUNDLE_WIFI_BASIC')
      expect(wifiBasicItems).toHaveLength(3)
      expect(wifiBasicItems.map((i) => i.item_code)).toEqual(['INET_BASIC', 'ROUTER_WIFI', 'INSTALL_WIFI'])

      const cctvItems = res.rows.filter((r) => r.bundle_code === 'BUNDLE_CCTV_4CAM')
      expect(cctvItems).toHaveLength(2)
      expect(cctvItems.map((i) => i.item_code)).toEqual(['CCTV_4CAM_PKG', 'INSTALL_CCTV'])

      const homeSecItems = res.rows.filter((r) => r.bundle_code === 'BUNDLE_HOME_SECURITY')
      expect(homeSecItems).toHaveLength(6)
      expect(homeSecItems.map((i) => i.item_code)).toEqual([
        'INET_FAMILY',
        'ROUTER_WIFI',
        'CCTV_INDOOR',
        'CCTV_OUTDOOR',
        'INSTALL_WIFI',
        'INSTALL_CCTV',
      ])
    })
  })

  describe('4. Platform Service Retrieval Integration', () => {
    it('retrieves bundles via listBundles with item counts and summary', async () => {
      const res = await platformService.listBundles({ status: 'ACTIVE' })
      expect(res.items.length).toBeGreaterThanOrEqual(5)
      expect(res.summary).toBeDefined()
      expect(res.summary.active_count).toBeGreaterThanOrEqual(5)

      const wifiFamily = res.items.find((b) => b.code === 'BUNDLE_WIFI_FAMILY')
      expect(wifiFamily).toBeDefined()
      expect(wifiFamily?.item_count).toBe(3)
    })

    it('retrieves bundle detail with composed items via getBundleByCode', async () => {
      const bundle: any = await platformService.getBundleByCode('BUNDLE_HOME_SECURITY')
      expect(bundle.code).toBe('BUNDLE_HOME_SECURITY')
      expect(bundle.items).toHaveLength(6)
      expect(Array.isArray(bundle.showcase_items)).toBe(true)
    })
  })

  describe('5. Idempotency & Conflict Safety', () => {
    it('re-executes migration 044 cleanly without errors or duplicate rows', async () => {
      const countProductsBefore = (await pool.query('SELECT COUNT(*) as count FROM catalog_products')).rows[0].count
      const countBundlesBefore = (await pool.query('SELECT COUNT(*) as count FROM bundles')).rows[0].count
      const countItemsBefore = (await pool.query('SELECT COUNT(*) as count FROM bundle_items')).rows[0].count

      // Re-run migration
      await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))

      const countProductsAfter = (await pool.query('SELECT COUNT(*) as count FROM catalog_products')).rows[0].count
      const countBundlesAfter = (await pool.query('SELECT COUNT(*) as count FROM bundles')).rows[0].count
      const countItemsAfter = (await pool.query('SELECT COUNT(*) as count FROM bundle_items')).rows[0].count

      expect(countProductsAfter).toBe(countProductsBefore)
      expect(countBundlesAfter).toBe(countBundlesBefore)
      expect(countItemsAfter).toBe(countItemsBefore)
    })
  })
})
