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

  await pool.query(
    `
      INSERT INTO users (id, email, password_hash, status)
      VALUES ($1, $2, $3, 'ACTIVE')
    `,
    [userId, email, hash]
  )

  await pool.query(
    `
      INSERT INTO user_businesses (user_id, business_id, role, status)
      VALUES ($1, $2, $3, 'ACTIVE')
    `,
    [userId, businessId, role]
  )

  return { email, password, userId }
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
