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
  } = {}
) {
  const email = options.email ?? `test-${randomUUID()}@biz-erp.local`
  const password = options.password ?? 'TestPassword123!'
  const role = options.role ?? 'OWNER'
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
