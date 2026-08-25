import { randomUUID } from 'crypto'
import type { Express } from 'express'
import { Pool } from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { seedTestUser, authenticateTestUser } from './auth_helper'

const BUSINESS_A = '11111111-1111-4111-8111-111111111111'
const BUSINESS_B = '22222222-2222-4222-8222-222222222222'

let pool!: Pool
let app!: Express
let tokenAOwner!: string
let tokenBOwner!: string

async function resetDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE
      stock_movements,
      stocks,
      branches,
      sale_items,
      sales,
      idempotency_keys,
      products,
      businesses
    RESTART IDENTITY CASCADE
  `)

  await pool.query(
    `
      INSERT INTO businesses (id, name)
      VALUES ($1, $2), ($3, $4)
      ON CONFLICT (id) DO NOTHING
    `,
    [BUSINESS_A, 'Business A', BUSINESS_B, 'Business B']
  )
}

describe('PHASE 2A — Reporting Branch Scope Test Suite', () => {
  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL!)
    const dbName = pool.options.database
    if (dbName === 'biz_erp_prod' || dbName === 'biz_erp_prod_clone') {
      throw new Error('TESTS MUST NOT RUN ON PRODUCTION DB. Check your DATABASE_URL.')
    }
    await runMigrations(pool)
    app = createApp(pool)
  })

  afterAll(async () => {
    await pool.end()
  })

  let branchA1: string
  let branchA2: string
  let branchB1: string
  let productA1: string
  let productA2: string

  beforeEach(async () => {
    await resetDatabase()

    const u1 = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER' })
    const { accessToken: ta } = await authenticateTestUser(app, u1.email, u1.password, BUSINESS_A)
    tokenAOwner = ta

    const u2 = await seedTestUser(pool, BUSINESS_B, { role: 'OWNER' })
    const { accessToken: tb } = await authenticateTestUser(app, u2.email, u2.password, BUSINESS_B)
    tokenBOwner = tb

    // Create Branch A1 and Branch A2
    branchA1 = randomUUID()
    branchA2 = randomUUID()
    branchB1 = randomUUID()

    await pool.query(
      `INSERT INTO branches (id, business_id, name, status, created_at, updated_at)
       VALUES ($1, $2, 'Branch A1', TRUE, now(), now()),
              ($3, $4, 'Branch A2', TRUE, now(), now()),
              ($5, $6, 'Branch B1', TRUE, now(), now())`,
      [branchA1, BUSINESS_A, branchA2, BUSINESS_A, branchB1, BUSINESS_B]
    )

    // Seed products in Business A
    productA1 = randomUUID()
    productA2 = randomUUID()
    await pool.query(
      `INSERT INTO products (id, business_id, name, price_minor, is_active, server_version, created_at, updated_at)
       VALUES ($1, $2, 'Kopi Susu', 1500000, TRUE, 1, now(), now()),
              ($3, $4, 'Roti Bakar', 2000000, TRUE, 1, now(), now())`,
      [productA1, BUSINESS_A, productA2, BUSINESS_A]
    )

    // Seed stocks: Branch A1 has 0 stock for productA1, Branch A2 has 10 stock
    await pool.query(
      `INSERT INTO stocks (id, business_id, branch_id, product_id, quantity, server_version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 0, 1, now(), now()),
              ($5, $6, $7, $8, 10, 1, now(), now())`,
      [randomUUID(), BUSINESS_A, branchA1, productA1, randomUUID(), BUSINESS_A, branchA2, productA2]
    )

    // Seed sales in Branch A1: 1 sale with total 30.000 (minor 3000000), CASH
    const saleA1 = randomUUID()
    await pool.query(
      `INSERT INTO sales (id, business_id, branch_id, idempotency_key, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, cash_received_minor, change_minor, client_created_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'REC-001', 3000000, 0, 0, 3000000, 'CASH', 5000000, 2000000, 1700000000000, now(), now())`,
      [saleA1, BUSINESS_A, branchA1, randomUUID()]
    )
    await pool.query(
      `INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price_minor, subtotal_minor)
       VALUES ($1, $2, $3, 'Kopi Susu', 2, 1500000, 3000000)`,
      [randomUUID(), saleA1, productA1]
    )

    // Seed sales in Branch A2: 2 sales with total 40.000 (minor 4000000), QRIS
    const saleA2 = randomUUID()
    await pool.query(
      `INSERT INTO sales (id, business_id, branch_id, idempotency_key, receipt_number, subtotal_minor, discount_minor, tax_minor, total_minor, payment_method, cash_received_minor, change_minor, client_created_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'REC-002', 4000000, 0, 0, 4000000, 'QRIS', 4000000, 0, 1700000000000, now(), now())`,
      [saleA2, BUSINESS_A, branchA2, randomUUID()]
    )
    await pool.query(
      `INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price_minor, subtotal_minor)
       VALUES ($1, $2, $3, 'Roti Bakar', 2, 2000000, 4000000)`,
      [randomUUID(), saleA2, productA2]
    )
  })

  it('REPORT-BRANCH-001: tenant-wide request without branch_id preserves old results', async () => {
    // 1. Dashboard without branch_id -> aggregates across both branches (30.000 + 40.000 = 70.000)
    const dashRes = await request(app)
      .get('/v1/dashboard')
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .expect(200)

    expect(dashRes.body.total_revenue_minor).toBe(7000000)
    expect(dashRes.body.total_sales).toBe(2)
    expect(dashRes.body.total_products).toBe(2)
    expect(dashRes.body.out_of_stock_count).toBe(1)
    expect(dashRes.body.top_products.length).toBe(2)

    // 2. Sales summary report without branch_id
    const reportRes = await request(app)
      .get('/v1/reports/sales-summary')
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .expect(200)

    expect(reportRes.body.sales_summary.total_revenue_minor).toBe(7000000)
    expect(reportRes.body.sales_summary.total_sales).toBe(2)
    expect(reportRes.body.sales_summary.payment_methods.length).toBe(2)
  })

  it('REPORT-BRANCH-002: valid branch_id returns only selected branch metrics', async () => {
    // Query Branch A1 (only 1 sale = 3000000, 0 out of stock in branch A1, CASH only)
    const dashA1 = await request(app)
      .get(`/v1/dashboard?branch_id=${branchA1}`)
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .expect(200)

    expect(dashA1.body.total_revenue_minor).toBe(3000000)
    expect(dashA1.body.total_sales).toBe(1)
    expect(dashA1.body.out_of_stock_count).toBe(1)
    expect(dashA1.body.total_products).toBe(2) // catalog remains tenant scoped
    expect(dashA1.body.top_products.length).toBe(1)
    expect(dashA1.body.top_products[0].product_name).toBe('Kopi Susu')

    // Query Branch A2 (only 1 sale = 4000000, 0 out of stock in branch A2, QRIS only)
    const dashA2 = await request(app)
      .get(`/v1/dashboard?branch_id=${branchA2}`)
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .expect(200)

    expect(dashA2.body.total_revenue_minor).toBe(4000000)
    expect(dashA2.body.total_sales).toBe(1)
    expect(dashA2.body.out_of_stock_count).toBe(0)
    expect(dashA2.body.top_products.length).toBe(1)
    expect(dashA2.body.top_products[0].product_name).toBe('Roti Bakar')

    // Reports sales summary with branch_id
    const reportA1 = await request(app)
      .get(`/v1/reports/sales-summary?branch_id=${branchA1}`)
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .expect(200)

    expect(reportA1.body.sales_summary.total_revenue_minor).toBe(3000000)
    expect(reportA1.body.sales_summary.total_sales).toBe(1)
    expect(reportA1.body.sales_summary.payment_methods.length).toBe(1)
    expect(reportA1.body.sales_summary.payment_methods[0].payment_method).toBe('CASH')

    // Reports product sales with branch_id
    const prodReportA1 = await request(app)
      .get(`/v1/reports/product-sales?branch_id=${branchA1}`)
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .expect(200)

    expect(prodReportA1.body.product_sales.length).toBe(1)
    expect(prodReportA1.body.product_sales[0].product_name).toBe('Kopi Susu')
  })

  it('REPORT-BRANCH-003: branch from another tenant rejected', async () => {
    // Attempt to access Branch B1 using Business A token
    const res = await request(app)
      .get(`/v1/dashboard?branch_id=${branchB1}`)
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .expect(403)

    expect(res.body.error).toBe('BUSINESS_ACCESS_DENIED')

    // Attempt reports endpoint with branch from another tenant
    const reportRes = await request(app)
      .get(`/v1/reports/sales-summary?branch_id=${branchB1}`)
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .expect(403)

    expect(reportRes.body.error).toBe('BUSINESS_ACCESS_DENIED')
  })

  it('REPORT-BRANCH-004: invalid branch UUID rejected', async () => {
    // Attempt with non-UUID string
    const res = await request(app)
      .get('/v1/dashboard?branch_id=BRANCH-001')
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .expect(400)

    expect(res.body.error).toBe('BAD_REQUEST')
    expect(res.body.message).toContain('branch_id must be a valid UUID')

    // Reports endpoint with invalid UUID
    const reportRes = await request(app)
      .get('/v1/reports/sales-summary?branch_id=invalid-uuid')
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .expect(400)

    expect(reportRes.body.error).toBe('BAD_REQUEST')
  })

  it('REPORT-BRANCH-005: existing API behavior remains unchanged', async () => {
    // Verify date range filters still work accurately without branch_id
    const today = new Date().toISOString().split('T')[0]
    const res = await request(app)
      .get(`/v1/reports/sales-summary?from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .expect(200)

    expect(res.body.sales_summary).toBeDefined()
    expect(res.body.sales_summary.total_revenue_minor).toBe(7000000)
  })
})
