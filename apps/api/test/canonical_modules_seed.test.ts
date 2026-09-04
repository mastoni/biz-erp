import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { Pool } from 'pg'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'
import { randomUUID } from 'crypto'
import { hashPassword } from '../src/services/password_service'
import { Express } from 'express'
import fs from 'fs'

const JWT_SECRET = 'insecure-test-secret-that-is-at-least-32-chars-long'
const JWT_ISSUER = 'biz-erp-api'
const JWT_AUDIENCE = 'biz-erp-client'

describe('Phase: Canonical Module Catalog Seeding (Migration 041)', () => {
  let pool: Pool
  let app: Express
  let platformToken: string
  const migration041Sql = fs.readFileSync(
    path.resolve(process.cwd(), 'migrations/041_canonical_modules_seed.sql'),
    'utf-8'
  )

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET
    process.env.JWT_ISSUER = JWT_ISSUER
    process.env.JWT_AUDIENCE = JWT_AUDIENCE

    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    pool = createPool(databaseUrl)

    // Clean table and run migration 041 to test clean seeding
    await pool.query('DELETE FROM modules')
    await pool.query(migration041Sql)
    app = createApp(pool)

    // Create a Superadmin user for API verification
    const adminId = randomUUID()
    const adminEmail = `superadmin_mod_${Date.now()}@skmnetwork.com`
    const hash = await hashPassword('password123')
    await pool.query(
      `INSERT INTO users (id, email, password_hash, status, platform_role)
       VALUES ($1, $2, $3, 'ACTIVE', 'SUPER_ADMIN')`,
      [adminId, adminEmail, hash]
    )

    const loginRes = await request(app)
      .post('/v1/auth/login')
      .set('x-auth-context', 'platform')
      .send({ email: adminEmail, password: 'password123' })

    expect(loginRes.status).toBe(200)
    platformToken = loginRes.body.access_token
  })

  afterAll(async () => {
    await pool.end()
  })

  it('1. Verifies that all 9 canonical modules exist after Migration 041', async () => {
    const res = await pool.query('SELECT code, name, pillar, category, is_core, status, service_code FROM modules ORDER BY code ASC')
    const codes = res.rows.map((r) => r.code)

    expect(codes).toContain('POS')
    expect(codes).toContain('INVENTORY')
    expect(codes).toContain('PURCHASING')
    expect(codes).toContain('FINANCE')
    expect(codes).toContain('CRM')
    expect(codes).toContain('ISP_CORE')
    expect(codes).toContain('CCTV_CORE')
    expect(codes).toContain('WA_GATEWAY')
    expect(codes).toContain('AUTOPOST')

    const pos = res.rows.find((r) => r.code === 'POS')
    expect(pos).toMatchObject({
      code: 'POS',
      name: 'Point of Sale',
      pillar: 'OPERATE',
      category: 'SALES',
      is_core: true,
      status: 'ACTIVE',
      service_code: 'ERP',
    })

    const ispCore = res.rows.find((r) => r.code === 'ISP_CORE')
    expect(ispCore).toMatchObject({
      code: 'ISP_CORE',
      name: 'ISP Core Management',
      pillar: 'CONNECT',
      category: 'NETWORK',
      is_core: false,
      status: 'ACTIVE',
      service_code: 'ISP_MANAGEMENT',
    })

    const cctvCore = res.rows.find((r) => r.code === 'CCTV_CORE')
    expect(cctvCore).toMatchObject({
      code: 'CCTV_CORE',
      name: 'CCTV Surveillance',
      pillar: 'PROTECT',
      category: 'SECURITY',
      is_core: false,
      status: 'ACTIVE',
      service_code: 'CCTV_MANAGEMENT',
    })
  })

  it('2. Idempotency: Re-running Migration 041 does not fail or duplicate rows', async () => {
    const countBefore = await pool.query('SELECT COUNT(*)::int as count FROM modules')
    
    // Execute migration SQL a second time
    await pool.query(migration041Sql)

    const countAfter = await pool.query('SELECT COUNT(*)::int as count FROM modules')
    expect(countAfter.rows[0].count).toBe(countBefore.rows[0].count)
  })

  it('3. Preservation: ON CONFLICT DO NOTHING preserves existing custom metadata', async () => {
    // Modify an existing module attribute
    await pool.query("UPDATE modules SET name = 'Custom POS Name' WHERE code = 'POS'")

    // Re-run migration
    await pool.query(migration041Sql)

    const posRes = await pool.query("SELECT name FROM modules WHERE code = 'POS'")
    expect(posRes.rows[0].name).toBe('Custom POS Name')

    // Restore standard name
    await pool.query("UPDATE modules SET name = 'Point of Sale' WHERE code = 'POS'")
  })

  it('4. Preservation: Unrelated custom module records are preserved', async () => {
    await pool.query(`
      INSERT INTO modules (code, name, pillar, category, is_core, status)
      VALUES ('CUSTOM_TEST_MOD', 'Custom Test Module', 'OPERATE', 'CUSTOM', FALSE, 'ACTIVE')
      ON CONFLICT (code) DO NOTHING
    `)

    await pool.query(migration041Sql)

    const customRes = await pool.query("SELECT * FROM modules WHERE code = 'CUSTOM_TEST_MOD'")
    expect(customRes.rows.length).toBe(1)
    expect(customRes.rows[0].name).toBe('Custom Test Module')

    await pool.query("DELETE FROM modules WHERE code = 'CUSTOM_TEST_MOD'")
  })

  it('5. API Verification: GET /v1/platform/modules returns canonical modules via Superadmin API', async () => {
    const res = await request(app)
      .get('/v1/platform/modules?limit=20&offset=0')
      .set('Authorization', `Bearer ${platformToken}`)

    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThanOrEqual(9)
    expect(Array.isArray(res.body.items)).toBe(true)

    const returnedCodes = res.body.items.map((m: any) => m.code)
    expect(returnedCodes).toContain('POS')
    expect(returnedCodes).toContain('INVENTORY')
    expect(returnedCodes).toContain('PURCHASING')
    expect(returnedCodes).toContain('FINANCE')
    expect(returnedCodes).toContain('CRM')
  })
})
