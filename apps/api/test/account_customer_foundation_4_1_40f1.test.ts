import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { Pool } from 'pg'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'
import { randomUUID } from 'crypto'
import { hashPassword } from '../src/services/password_service'

describe('Phase 4.1.40F-1: Account Customer Foundation', () => {
  let pool: Pool

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
  })

  afterAll(async () => {
    await pool.end()
  })

  describe('1. account_customers Table Schema & Constraints', () => {
    it('AC-FND-001: creates account customer with valid fields and defaults', async () => {
      const code = `ACC-TEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      const res = await pool.query(
        `INSERT INTO account_customers (code, name, account_type, billing_email, billing_phone)
         VALUES ($1, 'PT Maju Terus', 'BUSINESS', 'billing@majuterus.com', '+628123456789')
         RETURNING *`,
        [code]
      )

      expect(res.rows.length).toBe(1)
      const row = res.rows[0]
      expect(row.id).toBeDefined()
      expect(row.code).toBe(code)
      expect(row.name).toBe('PT Maju Terus')
      expect(row.account_type).toBe('BUSINESS')
      expect(row.status).toBe('ACTIVE')
      expect(row.metadata).toEqual({})
      expect(row.created_at).toBeDefined()
      expect(row.updated_at).toBeDefined()
    })

    it('AC-FND-002: enforces unique constraint on account_customers.code', async () => {
      const code = `ACC-DUP-${Date.now()}`
      await pool.query(
        `INSERT INTO account_customers (code, name, account_type)
         VALUES ($1, 'Original Company', 'INDIVIDUAL')`,
        [code]
      )

      await expect(
        pool.query(
          `INSERT INTO account_customers (code, name, account_type)
           VALUES ($1, 'Duplicate Code Company', 'BUSINESS')`,
          [code]
        )
      ).rejects.toThrow(/duplicate key value violates unique constraint|23505/)
    })

    it('AC-FND-003: rejects invalid account_type values', async () => {
      const code = `ACC-TYPE-INV-${Date.now()}`
      await expect(
        pool.query(
          `INSERT INTO account_customers (code, name, account_type)
           VALUES ($1, 'Invalid Type Corp', 'INVALID_TYPE')`,
          [code]
        )
      ).rejects.toThrow(/violates check constraint|23514/)
    })

    it('AC-FND-004: rejects invalid status values', async () => {
      const code = `ACC-STAT-INV-${Date.now()}`
      await expect(
        pool.query(
          `INSERT INTO account_customers (code, name, account_type, status)
           VALUES ($1, 'Invalid Status Corp', 'ENTERPRISE', 'UNKNOWN_STATUS')`,
          [code]
        )
      ).rejects.toThrow(/violates check constraint|23514/)
    })
  })

  describe('2. account_customer_users Table Schema & Roles', () => {
    it('AC-FND-005: maps user to account customer with PRIMARY_CONTACT default role', async () => {
      const acCode = `ACC-USR-${Date.now()}`
      const acRes = await pool.query(
        `INSERT INTO account_customers (code, name, account_type)
         VALUES ($1, 'User Mapping Test', 'INDIVIDUAL')
         RETURNING id`,
        [acCode]
      )
      const acId = acRes.rows[0].id

      const userId = randomUUID()
      const hashed = await hashPassword('password123')
      await pool.query(
        `INSERT INTO users (id, email, password_hash, status)
         VALUES ($1, $2, $3, 'ACTIVE')`,
        [userId, `ac_user_${Date.now()}@test.com`, hashed]
      )

      const mapRes = await pool.query(
        `INSERT INTO account_customer_users (account_customer_id, user_id)
         VALUES ($1, $2)
         RETURNING *`,
        [acId, userId]
      )

      expect(mapRes.rows.length).toBe(1)
      expect(mapRes.rows[0].role).toBe('PRIMARY_CONTACT')
      expect(mapRes.rows[0].status).toBe('ACTIVE')
    })

    it('AC-FND-006: supports BILLING_ADMIN and AUTHORIZED_USER roles', async () => {
      const acCode = `ACC-ROLES-${Date.now()}`
      const acRes = await pool.query(
        `INSERT INTO account_customers (code, name, account_type)
         VALUES ($1, 'Roles Test Corp', 'BUSINESS')
         RETURNING id`,
        [acCode]
      )
      const acId = acRes.rows[0].id

      const userBillingId = randomUUID()
      const userAuthId = randomUUID()
      const hashed = await hashPassword('password123')

      await pool.query(
        `INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, 'ACTIVE'), ($4, $5, $6, 'ACTIVE')`,
        [userBillingId, `billing_${Date.now()}@test.com`, hashed, userAuthId, `auth_${Date.now()}@test.com`, hashed]
      )

      const res1 = await pool.query(
        `INSERT INTO account_customer_users (account_customer_id, user_id, role)
         VALUES ($1, $2, 'BILLING_ADMIN')
         RETURNING role`,
        [acId, userBillingId]
      )
      expect(res1.rows[0].role).toBe('BILLING_ADMIN')

      const res2 = await pool.query(
        `INSERT INTO account_customer_users (account_customer_id, user_id, role)
         VALUES ($1, $2, 'AUTHORIZED_USER')
         RETURNING role`,
        [acId, userAuthId]
      )
      expect(res2.rows[0].role).toBe('AUTHORIZED_USER')
    })

    it('AC-FND-007: rejects invalid role names (e.g. legacy MEMBER or PRIMARY_OWNER)', async () => {
      const acCode = `ACC-BAD-ROLE-${Date.now()}`
      const acRes = await pool.query(
        `INSERT INTO account_customers (code, name, account_type)
         VALUES ($1, 'Bad Role Corp', 'BUSINESS')
         RETURNING id`,
        [acCode]
      )
      const acId = acRes.rows[0].id

      const userId = randomUUID()
      const hashed = await hashPassword('password123')
      await pool.query(
        `INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, 'ACTIVE')`,
        [userId, `bad_role_${Date.now()}@test.com`, hashed]
      )

      await expect(
        pool.query(
          `INSERT INTO account_customer_users (account_customer_id, user_id, role)
           VALUES ($1, $2, 'PRIMARY_OWNER')`,
          [acId, userId]
        )
      ).rejects.toThrow(/violates check constraint|23514/)

      await expect(
        pool.query(
          `INSERT INTO account_customer_users (account_customer_id, user_id, role)
           VALUES ($1, $2, 'MEMBER')`,
          [acId, userId]
        )
      ).rejects.toThrow(/violates check constraint|23514/)
    })

    it('AC-FND-008: enforces composite uniqueness on (account_customer_id, user_id)', async () => {
      const acCode = `ACC-UQ-MAP-${Date.now()}`
      const acRes = await pool.query(
        `INSERT INTO account_customers (code, name, account_type)
         VALUES ($1, 'Unique Mapping Test', 'INDIVIDUAL')
         RETURNING id`,
        [acCode]
      )
      const acId = acRes.rows[0].id

      const userId = randomUUID()
      const hashed = await hashPassword('password123')
      await pool.query(
        `INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, 'ACTIVE')`,
        [userId, `uq_user_${Date.now()}@test.com`, hashed]
      )

      await pool.query(
        `INSERT INTO account_customer_users (account_customer_id, user_id, role)
         VALUES ($1, $2, 'PRIMARY_CONTACT')`,
        [acId, userId]
      )

      await expect(
        pool.query(
          `INSERT INTO account_customer_users (account_customer_id, user_id, role)
           VALUES ($1, $2, 'BILLING_ADMIN')`,
          [acId, userId]
        )
      ).rejects.toThrow(/duplicate key value violates unique constraint|uq_account_customer_user|23505/)
    })
  })

  describe('3. Foreign Keys & Tenant Isolation Compatibility', () => {
    it('AC-FND-009: businesses table allows NULL account_customer_id and valid FK reference', async () => {
      const bizNullId = randomUUID()
      const resNull = await pool.query(
        `INSERT INTO businesses (id, name, status, account_customer_id)
         VALUES ($1, 'Unlinked Business', 'ACTIVE', NULL)
         RETURNING id, account_customer_id`,
        [bizNullId]
      )
      expect(resNull.rows[0].account_customer_id).toBeNull()

      const acCode = `ACC-BIZ-${Date.now()}`
      const acRes = await pool.query(
        `INSERT INTO account_customers (code, name, account_type)
         VALUES ($1, 'Linked Parent Account', 'BUSINESS')
         RETURNING id`,
        [acCode]
      )
      const acId = acRes.rows[0].id

      const bizLinkedId = randomUUID()
      const resLinked = await pool.query(
        `INSERT INTO businesses (id, name, status, account_customer_id)
         VALUES ($1, 'Linked Business', 'ACTIVE', $2)
         RETURNING id, account_customer_id`,
        [bizLinkedId, acId]
      )
      expect(resLinked.rows[0].account_customer_id).toBe(acId)
    })

    it('AC-FND-010: subscriptions table allows NULL account_customer_id and valid FK reference', async () => {
      const bizId = randomUUID()
      await pool.query(`INSERT INTO businesses (id, name, status) VALUES ($1, 'Sub FK Test Biz', 'ACTIVE')`, [bizId])

      const planRes = await pool.query(`SELECT code, family FROM plans WHERE status = 'ACTIVE' LIMIT 1`)
      const planCode = planRes.rows[0]?.code || 'ERP_STARTER_M'
      const familyCode = planRes.rows[0]?.family || 'ERP_PLAN'

      const acCode = `ACC-SUB-${Date.now()}`
      const acRes = await pool.query(
        `INSERT INTO account_customers (code, name, account_type)
         VALUES ($1, 'Sub Parent Account', 'BUSINESS')
         RETURNING id`,
        [acCode]
      )
      const acId = acRes.rows[0].id

      const subRes = await pool.query(
        `INSERT INTO subscriptions (
           business_id, account_customer_id, plan_code, family_code, source, status, unit_price, final_price, billing_cycle
         ) VALUES (
           $1, $2, $3, $4, 'DIRECT', 'ACTIVE', 100000, 100000, 'MONTHLY'
         ) RETURNING id, account_customer_id, business_id`,
        [bizId, acId, planCode, familyCode]
      )
      expect(subRes.rows[0].account_customer_id).toBe(acId)
      expect(subRes.rows[0].business_id).toBe(bizId)
    })

    it('AC-FND-011: ON DELETE RESTRICT prevents deleting account_customers when referenced by business or subscription', async () => {
      const acCode = `ACC-RESTRICT-${Date.now()}`
      const acRes = await pool.query(
        `INSERT INTO account_customers (code, name, account_type)
         VALUES ($1, 'Restricted Account', 'ENTERPRISE')
         RETURNING id`,
        [acCode]
      )
      const acId = acRes.rows[0].id

      const bizId = randomUUID()
      await pool.query(
        `INSERT INTO businesses (id, name, status, account_customer_id)
         VALUES ($1, 'Dependent Business', 'ACTIVE', $2)`,
        [bizId, acId]
      )

      await expect(
        pool.query(`DELETE FROM account_customers WHERE id = $1`, [acId])
      ).rejects.toThrow(/violates foreign key constraint|23503/)
    })

    it('AC-FND-012: supports 1:N multi-business ownership under one account_customer', async () => {
      const acCode = `ACC-MULTI-${Date.now()}`
      const acRes = await pool.query(
        `INSERT INTO account_customers (code, name, account_type)
         VALUES ($1, 'Multi-Business Group', 'ENTERPRISE')
         RETURNING id`,
        [acCode]
      )
      const acId = acRes.rows[0].id

      const biz1Id = randomUUID()
      const biz2Id = randomUUID()
      const biz3Id = randomUUID()

      await pool.query(
        `INSERT INTO businesses (id, name, status, account_customer_id) VALUES
         ($1, 'Outlet Cabang 1', 'ACTIVE', $4),
         ($2, 'Outlet Cabang 2', 'ACTIVE', $4),
         ($3, 'Outlet Cabang 3', 'ACTIVE', $4)`,
        [biz1Id, biz2Id, biz3Id, acId]
      )

      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM businesses WHERE account_customer_id = $1`,
        [acId]
      )
      expect(countRes.rows[0].cnt).toBe(3)
    })
  })
})
