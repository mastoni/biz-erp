import request from 'supertest'
import type { Express } from 'express'
import { randomUUID } from 'crypto'
import { Pool } from 'pg'
import bcrypt from 'bcrypt'

export async function seedTestUser(
  pool: Pool,
  businessId: string,
  options: {
    email?: string
    password?: string
    role?: string
    withSubscription?: boolean
  } = {}
) {
  const email = options.email ?? `test-${randomUUID()}@biz-erp.local`
  const password = options.password ?? 'TestPassword123!'
  const role = options.role ?? 'OWNER'
  const withSub = options.withSubscription ?? true
  const userId = randomUUID()

  const hash = await bcrypt.hash(password, 10)

  const userRes = await pool.query(
    `
      INSERT INTO users (id, email, password_hash, status)
      VALUES ($1, $2, $3, 'ACTIVE')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = EXCLUDED.status
      RETURNING id
    `,
    [userId, email, hash]
  )
  const actualUserId = userRes.rows[0].id

  await pool.query(
    `
      INSERT INTO businesses (id, name)
      VALUES ($1, 'Test Business')
      ON CONFLICT (id) DO NOTHING
    `,
    [businessId]
  )

  await pool.query(
    `
      INSERT INTO user_businesses (user_id, business_id, role, status)
      VALUES ($1, $2, $3, 'ACTIVE')
      ON CONFLICT (user_id, business_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status
    `,
    [actualUserId, businessId, role]
  )

  if (withSub) {
    // Ensure canonical services exist
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

    // Ensure default test plan exists
    await pool.query(`
      INSERT INTO plans (code, name, family, tier, billing_cycle, pricing, type, status, service_code)
      VALUES ('test_default_erp_plan', 'Default ERP Plan', 'ERP_PLAN', 'PRO', 'MONTHLY', '{"base_price":100}', 'STANDALONE', 'ACTIVE', 'ERP')
      ON CONFLICT (code) DO UPDATE SET service_code = 'ERP'
    `)

    // Ensure active ERP subscription
    const existingSub = await pool.query(
      `SELECT id FROM subscriptions WHERE business_id = $1 AND family_code = 'ERP_PLAN' AND status = 'ACTIVE' LIMIT 1`,
      [businessId]
    )
    if (existingSub.rows.length === 0) {
      await pool.query(`
        INSERT INTO subscriptions (business_id, plan_code, family_code, source, status, unit_price, discount, tax, final_price, currency, billing_cycle)
        VALUES ($1, 'test_default_erp_plan', 'ERP_PLAN', 'DIRECT', 'ACTIVE', 100000, 0, 0, 100000, 'IDR', 'MONTHLY')
      `, [businessId])
    }
  }

  return { email, password, userId: actualUserId }
}

export async function authenticateTestUser(
  app: Express,
  email: string,
  password: string,
  businessId: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await request(app)
    .post('/v1/auth/login')
    .send({
      email,
      password,
      business_id: businessId
    })
    .expect(200)

  return {
    accessToken: res.body.access_token,
    refreshToken: res.body.refresh_token
  }
}
