import path from 'path'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { seedTestUser, authenticateTestUser } from './auth_helper'
import { createJwtService, JwtService } from '../src/services/jwt_service'

const BUSINESS_A = '11111111-aaaa-4111-8aaa-111111111111'
const BUSINESS_B = '22222222-bbbb-4222-8bbb-222222222222'
const BRANCH_A = '33333333-aaaa-4333-8aaa-333333333333'
const BRANCH_B = '44444444-bbbb-4444-8bbb-444444444444'

let pool!: Pool
let app!: ReturnType<typeof createApp>
let jwtService!: JwtService
let ownerTokenA!: string
let staffTokenA!: string
let cashierTokenA!: string
let ownerTokenB!: string

async function cleanOperationalData(): Promise<void> {
  await pool.query(`
    TRUNCATE
      device_services,
      devices,
      stock_movements,
      stocks,
      products,
      customers
    RESTART IDENTITY CASCADE
  `)
}

async function seedProduct(businessId: string, branchId: string, name = 'Fiber Router GPON'): Promise<string> {
  const productId = randomUUID()
  await pool.query(
    `INSERT INTO products (id, business_id, name, price_minor, cost_minor, is_active)
     VALUES ($1, $2, $3, 500000, 300000, true)`,
    [productId, businessId, name]
  )
  await pool.query(
    `INSERT INTO stocks (id, business_id, branch_id, product_id, quantity, server_version)
     VALUES ($1, $2, $3, $4, 10, 1)`,
    [randomUUID(), businessId, branchId, productId]
  )
  return productId
}

async function seedCustomer(businessId: string, name = 'John Customer'): Promise<string> {
  const customerId = randomUUID()
  await pool.query(
    `INSERT INTO customers (id, business_id, name, phone)
     VALUES ($1, $2, $3, '08123456789')`,
    [customerId, businessId, name]
  )
  return customerId
}

beforeAll(async () => {
  const dbUrl =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://bizerp:bizerp@localhost:5432/biz_erp_finance_test'
  process.env.DATABASE_URL = dbUrl
  pool = createPool(dbUrl)

  const migrationsDir = path.resolve(__dirname, '../migrations')
  await runMigrations(pool, migrationsDir)

  const jwtSecret = process.env.JWT_SECRET || 'insecure-test-secret-that-is-at-least-32-chars-long'
  const jwtIssuer = process.env.JWT_ISSUER || 'biz-erp-api'
  const jwtAudience = process.env.JWT_AUDIENCE || 'biz-erp-client'
  jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)

  app = createApp(pool)

  await pool.query(`
    TRUNCATE
      device_services,
      devices,
      stock_movements,
      stocks,
      products,
      customers,
      branches,
      subscriptions,
      user_businesses,
      users,
      businesses
    RESTART IDENTITY CASCADE
  `)

  await pool.query(
    `INSERT INTO businesses (id, name, status) VALUES ($1, 'Tenant Alpha', 'ACTIVE'), ($2, 'Tenant Beta', 'ACTIVE') ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE'`,
    [BUSINESS_A, BUSINESS_B]
  )
  await pool.query(
    `INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, 'Branch Alpha', true), ($3, $4, 'Branch Beta', true) ON CONFLICT (id) DO NOTHING`,
    [BRANCH_A, BUSINESS_A, BRANCH_B, BUSINESS_B]
  )

  const ownerA = await seedTestUser(pool, BUSINESS_A, { role: 'OWNER', email: 'owner-a@test.local' })
  ownerTokenA = jwtService.signAccessToken({
    sub: ownerA.userId,
    business_id: BUSINESS_A,
    role: 'OWNER',
    session_id: randomUUID(),
    jti: randomUUID()
  })

  const cashierA = await seedTestUser(pool, BUSINESS_A, { role: 'CASHIER', email: 'cashier-a@test.local' })
  cashierTokenA = jwtService.signAccessToken({
    sub: cashierA.userId,
    business_id: BUSINESS_A,
    role: 'CASHIER',
    session_id: randomUUID(),
    jti: randomUUID()
  })

  const ownerB = await seedTestUser(pool, BUSINESS_B, { role: 'OWNER', email: 'owner-b@test.local' })
  ownerTokenB = jwtService.signAccessToken({
    sub: ownerB.userId,
    business_id: BUSINESS_B,
    role: 'OWNER',
    session_id: randomUUID(),
    jti: randomUUID()
  })

  // Generate tenant-authenticated STAFF token for Tenant A
  staffTokenA = jwtService.signAccessToken({
    sub: randomUUID(),
    business_id: BUSINESS_A,
    role: 'STAFF',
    session_id: randomUUID(),
    jti: randomUUID()
  })
}, 30000)

beforeEach(async () => {
  await cleanOperationalData()
}, 30000)

afterAll(async () => {
  await pool.end()
}, 30000)

describe('Phase 4.1.40G-4 — Express Routes & App Mounting Integration Tests', () => {
  // =========================================================================
  // 1. AUTH & RBAC MATRIX TESTS (OWNER, STAFF, CASHIER)
  // =========================================================================
  describe('Authentication and RBAC Matrix', () => {
    it('1. unauthenticated request rejected (401)', async () => {
      const res = await request(app).get('/v1/devices')
      expect(res.status).toBe(401)
      expect(res.body.error?.code).toBe('INVALID_TOKEN')
    })

    it('2. OWNER allowed full operational & management access', async () => {
      const res = await request(app)
        .get('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
      expect(res.status).toBe(200)
      expect(res.body.items).toBeDefined()
    })

    it('3. STAFF allowed operational read on devices (GET list and detail)', async () => {
      const createRes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          serial_number: 'SN-STAFF-READ-01',
          device_type: 'ROUTER',
          notes: 'MikroTik hEX'
        })
      expect(createRes.status).toBe(201)
      const deviceId = createRes.body.id

      // STAFF list
      const listRes = await request(app)
        .get('/v1/devices')
        .set('Authorization', `Bearer ${staffTokenA}`)
      expect(listRes.status).toBe(200)
      expect(listRes.body.items.length).toBe(1)

      // STAFF detail
      const detailRes = await request(app)
        .get(`/v1/devices/${deviceId}`)
        .set('Authorization', `Bearer ${staffTokenA}`)
      expect(detailRes.status).toBe(200)
      expect(detailRes.body.serial_number).toBe('SN-STAFF-READ-01')
    })

    it('4. STAFF allowed device registration & mutation (POST, PATCH, assign, unassign)', async () => {
      // 4a. STAFF POST /v1/devices
      const createRes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({
          branch_id: BRANCH_A,
          serial_number: 'SN-STAFF-MUT-01',
          device_type: 'ROUTER',
          notes: 'Created by Staff'
        })
      expect(createRes.status).toBe(201)
      const deviceId = createRes.body.id

      // 4b. STAFF PATCH /v1/devices/:id
      const patchRes = await request(app)
        .patch(`/v1/devices/${deviceId}`)
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({ notes: 'Updated by Staff' })
      expect(patchRes.status).toBe(200)
      expect(patchRes.body.notes).toBe('Updated by Staff')

      // 4c. STAFF POST /v1/devices/:id/assign
      const custId = await seedCustomer(BUSINESS_A)
      const assignRes = await request(app)
        .post(`/v1/devices/${deviceId}/assign`)
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({ customer_id: custId, installed_address: 'Site 101' })
      expect(assignRes.status).toBe(200)
      expect(assignRes.body.status).toBe('INSTALLED')

      // 4d. STAFF POST /v1/devices/:id/unassign
      const unassignRes = await request(app)
        .post(`/v1/devices/${deviceId}/unassign`)
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({ return_status: 'IN_STOCK', notes: 'Unassigned by Staff' })
      expect(unassignRes.status).toBe(200)
      expect(unassignRes.body.status).toBe('IN_STOCK')
    })

    it('5. STAFF allowed device-services work order operations (list, create, detail, patch, complete/RMA)', async () => {
      const devRes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({
          branch_id: BRANCH_A,
          serial_number: 'SN-STAFF-WO-01',
          device_type: 'ROUTER'
        })
      const deviceId = devRes.body.id

      // 5a. STAFF POST /v1/device-services (create)
      const woRes = await request(app)
        .post('/v1/device-services')
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({
          device_id: deviceId,
          service_type: 'MAINTENANCE',
          technician_name: 'Tech Staff 1'
        })
      expect(woRes.status).toBe(201)
      const serviceId = woRes.body.id

      // 5b. STAFF GET /v1/device-services (list)
      const listRes = await request(app)
        .get('/v1/device-services')
        .set('Authorization', `Bearer ${staffTokenA}`)
      expect(listRes.status).toBe(200)
      expect(listRes.body.items.length).toBe(1)

      // 5c. STAFF GET /v1/device-services/:id (detail)
      const detailRes = await request(app)
        .get(`/v1/device-services/${serviceId}`)
        .set('Authorization', `Bearer ${staffTokenA}`)
      expect(detailRes.status).toBe(200)
      expect(detailRes.body.id).toBe(serviceId)

      // 5d. STAFF PATCH /v1/device-services/:id (update)
      const patchRes = await request(app)
        .patch(`/v1/device-services/${serviceId}`)
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({ status: 'IN_PROGRESS' })
      expect(patchRes.status).toBe(200)
      expect(patchRes.body.status).toBe('IN_PROGRESS')

      // 5e. STAFF POST /v1/device-services/:id/complete (complete)
      const compRes = await request(app)
        .post(`/v1/device-services/${serviceId}/complete`)
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({ action_taken: 'Routine maintenance finished' })
      expect(compRes.status).toBe(200)
      expect(compRes.body.status).toBe('COMPLETED')
    })

    it('6. CASHIER read allowed on device list and detail', async () => {
      const createRes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          serial_number: 'SN-CASHIER-READ-01',
          device_type: 'ROUTER',
          notes: 'MikroTik hEX RB750Gr3'
        })
      expect(createRes.status).toBe(201)
      const deviceId = createRes.body.id

      // CASHIER list
      const listRes = await request(app)
        .get('/v1/devices')
        .set('Authorization', `Bearer ${cashierTokenA}`)
      expect(listRes.status).toBe(200)
      expect(listRes.body.items.length).toBe(1)

      // CASHIER detail
      const detailRes = await request(app)
        .get(`/v1/devices/${deviceId}`)
        .set('Authorization', `Bearer ${cashierTokenA}`)
      expect(detailRes.status).toBe(200)
      expect(detailRes.body.serial_number).toBe('SN-CASHIER-READ-01')
    })

    it('7. CASHIER blocked from ALL mutation endpoints and device-services (403)', async () => {
      const createRes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          serial_number: 'SN-CASHIER-BLOCKED-01',
          device_type: 'ROUTER'
        })
      const deviceId = createRes.body.id

      // 7a. Blocked from POST /v1/devices
      const resPostDev = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .send({ branch_id: BRANCH_A, serial_number: 'SN-FORBIDDEN-01', device_type: 'ROUTER' })
      expect(resPostDev.status).toBe(403)
      expect(resPostDev.body.error?.code).toBe('INSUFFICIENT_PERMISSIONS')

      // 7b. Blocked from PATCH /v1/devices/:id
      const resPatchDev = await request(app)
        .patch(`/v1/devices/${deviceId}`)
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .send({ notes: 'unauthorized' })
      expect(resPatchDev.status).toBe(403)

      // 7c. Blocked from POST /v1/devices/:id/assign
      const custId = await seedCustomer(BUSINESS_A)
      const resAssign = await request(app)
        .post(`/v1/devices/${deviceId}/assign`)
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .send({ customer_id: custId })
      expect(resAssign.status).toBe(403)

      // 7d. Blocked from POST /v1/devices/:id/unassign
      const resUnassign = await request(app)
        .post(`/v1/devices/${deviceId}/unassign`)
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .send({ return_status: 'IN_STOCK' })
      expect(resUnassign.status).toBe(403)

      // 7e. Blocked from GET /v1/device-services
      const resGetServices = await request(app)
        .get('/v1/device-services')
        .set('Authorization', `Bearer ${cashierTokenA}`)
      expect(resGetServices.status).toBe(403)

      // 7f. Blocked from POST /v1/device-services
      const resPostService = await request(app)
        .post('/v1/device-services')
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .send({ device_id: deviceId, service_type: 'MAINTENANCE' })
      expect(resPostService.status).toBe(403)

      // Create a service with OWNER to test detail/patch/complete blocking
      const srvRes = await request(app)
        .post('/v1/device-services')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ device_id: deviceId, service_type: 'MAINTENANCE' })
      const serviceId = srvRes.body.id

      // 7g. Blocked from GET /v1/device-services/:id
      const resGetSrvDetail = await request(app)
        .get(`/v1/device-services/${serviceId}`)
        .set('Authorization', `Bearer ${cashierTokenA}`)
      expect(resGetSrvDetail.status).toBe(403)

      // 7h. Blocked from PATCH /v1/device-services/:id
      const resPatchSrv = await request(app)
        .patch(`/v1/device-services/${serviceId}`)
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .send({ status: 'IN_PROGRESS' })
      expect(resPatchSrv.status).toBe(403)

      // 7i. Blocked from POST /v1/device-services/:id/complete
      const resCompSrv = await request(app)
        .post(`/v1/device-services/${serviceId}/complete`)
        .set('Authorization', `Bearer ${cashierTokenA}`)
        .send({ action_taken: 'Cashier attempt' })
      expect(resCompSrv.status).toBe(403)
    })
  })

  // =========================================================================
  // 2. DEVICE ROUTES CRUD & LIFECYCLE
  // =========================================================================
  describe('Device Routes (/v1/devices)', () => {
    it('8. POST /v1/devices - single device registration with sync_inventory', async () => {
      const productId = await seedProduct(BUSINESS_A, BRANCH_A)

      const res = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          product_id: productId,
          serial_number: 'sn-router-1001',
          mac_address: 'aa:bb:cc:dd:ee:ff',
          device_type: 'ROUTER',
          notes: 'MikroTik hEX S',
          sync_inventory: true
        })

      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()
      expect(res.body.serial_number).toBe('SN-ROUTER-1001') // Uppercased normalization
      expect(res.body.mac_address).toBe('AA:BB:CC:DD:EE:FF')
      expect(res.body.status).toBe('IN_STOCK')

      // Check inventory incremented from 10 to 11
      const stockRes = await pool.query(
        'SELECT quantity FROM stocks WHERE business_id = $1 AND product_id = $2',
        [BUSINESS_A, productId]
      )
      expect(stockRes.rows[0].quantity).toBe(11)
    })

    it('9. POST /v1/devices - bulk device registration', async () => {
      const res = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          device_type: 'ONT',
          items: [
            {
              serial_number: 'SN-BULK-001',
              notes: 'Huawei HG8245H5 Unit 1'
            },
            {
              serial_number: 'SN-BULK-002',
              notes: 'Huawei HG8245H5 Unit 2'
            }
          ]
        })

      expect(res.status).toBe(201)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBe(2)
      expect(res.body[0].serial_number).toBe('SN-BULK-001')
      expect(res.body[1].serial_number).toBe('SN-BULK-002')
    })

    it('10. GET /v1/devices - list with filters and pagination', async () => {
      // Seed 2 devices
      await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          serial_number: 'SN-LIST-A1',
          device_type: 'ROUTER',
          status: 'IN_STOCK'
        })
      await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          serial_number: 'SN-LIST-A2',
          device_type: 'ONT',
          status: 'IN_STOCK'
        })

      const res = await request(app)
        .get('/v1/devices?device_type=ROUTER&limit=10&offset=0')
        .set('Authorization', `Bearer ${ownerTokenA}`)

      expect(res.status).toBe(200)
      expect(res.body.items.length).toBe(1)
      expect(res.body.items[0].serial_number).toBe('SN-LIST-A1')
      expect(res.body.total).toBe(1)
      expect(res.body.has_more).toBe(false)
    })

    it('11. GET /v1/devices/:id - detail lookup with relationships', async () => {
      const productId = await seedProduct(BUSINESS_A, BRANCH_A)
      const createRes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          product_id: productId,
          serial_number: 'SN-DETAIL-01',
          device_type: 'ACCESS_POINT',
          notes: 'Ubiquiti U6-Lite'
        })

      const deviceId = createRes.body.id
      const detailRes = await request(app)
        .get(`/v1/devices/${deviceId}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)

      expect(detailRes.status).toBe(200)
      expect(detailRes.body.id).toBe(deviceId)
      expect(detailRes.body.branch_name).toBe('Branch Alpha')
      expect(detailRes.body.product_name).toBe('Fiber Router GPON')
    })

    it('12. PATCH /v1/devices/:id - update metadata and notes', async () => {
      const createRes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          serial_number: 'SN-PATCH-01',
          device_type: 'ROUTER'
        })

      const deviceId = createRes.body.id
      const patchRes = await request(app)
        .patch(`/v1/devices/${deviceId}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          notes: 'Configured with VLAN 100',
          warranty_expires_at: '2027-12-31'
        })

      expect(patchRes.status).toBe(200)
      expect(patchRes.body.notes).toBe('Configured with VLAN 100')
      expect(patchRes.body.warranty_expires_at).toBeDefined()
      expect(String(patchRes.body.warranty_expires_at)).toContain('2027-12-3')
    })

    it('13. POST /v1/devices/:id/assign - assign to customer with stock decrement', async () => {
      const productId = await seedProduct(BUSINESS_A, BRANCH_A)
      const customerId = await seedCustomer(BUSINESS_A)

      const createRes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          product_id: productId,
          serial_number: 'SN-ASSIGN-01',
          device_type: 'ROUTER'
        })
      const deviceId = createRes.body.id

      const assignRes = await request(app)
        .post(`/v1/devices/${deviceId}/assign`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          customer_id: customerId,
          installed_address: 'Jl. Melati No. 45',
          installed_at: '2026-09-05T10:00:00Z',
          sync_inventory: true
        })

      expect(assignRes.status).toBe(200)
      expect(assignRes.body.status).toBe('INSTALLED')
      expect(assignRes.body.customer_id).toBe(customerId)
      expect(assignRes.body.installed_address).toBe('Jl. Melati No. 45')

      // Stock should have decremented from 10 to 9
      const stockRes = await pool.query(
        'SELECT quantity FROM stocks WHERE business_id = $1 AND product_id = $2',
        [BUSINESS_A, productId]
      )
      expect(stockRes.rows[0].quantity).toBe(9)
    })

    it('14. POST /v1/devices/:id/unassign - return device to IN_STOCK with stock increment', async () => {
      const productId = await seedProduct(BUSINESS_A, BRANCH_A)
      const customerId = await seedCustomer(BUSINESS_A)

      const createRes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          product_id: productId,
          serial_number: 'SN-UNASSIGN-01',
          device_type: 'ROUTER'
        })
      const deviceId = createRes.body.id

      // Assign first
      await request(app)
        .post(`/v1/devices/${deviceId}/assign`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ customer_id: customerId, sync_inventory: true })

      // Unassign back to IN_STOCK
      const unassignRes = await request(app)
        .post(`/v1/devices/${deviceId}/unassign`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          return_status: 'IN_STOCK',
          notes: 'Customer relocated',
          sync_inventory: true
        })

      expect(unassignRes.status).toBe(200)
      expect(unassignRes.body.status).toBe('IN_STOCK')
      expect(unassignRes.body.customer_id).toBeNull()

      // Stock restored to 10
      const stockRes = await pool.query(
        'SELECT quantity FROM stocks WHERE business_id = $1 AND product_id = $2',
        [BUSINESS_A, productId]
      )
      expect(stockRes.rows[0].quantity).toBe(10)
    })
  })

  // =========================================================================
  // 3. DEVICE SERVICE ROUTES & ATOMIC REPLACEMENT
  // =========================================================================
  describe('Device Service Routes (/v1/device-services)', () => {
    it('15. POST /v1/device-services - create INSTALLATION work order', async () => {
      const customerId = await seedCustomer(BUSINESS_A)
      const devRes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          serial_number: 'SN-WO-INST-01',
          device_type: 'ROUTER'
        })
      const deviceId = devRes.body.id

      const res = await request(app)
        .post('/v1/device-services')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          device_id: deviceId,
          customer_id: customerId,
          service_type: 'INSTALLATION',
          technician_name: 'Budi Santoso',
          scheduled_at: '2026-09-06T09:00:00Z',
          notes: 'New fiber installation'
        })

      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()
      expect(res.body.service_type).toBe('INSTALLATION')
      expect(res.body.status).toBe('PENDING')
      expect(res.body.technician_name).toBe('Budi Santoso')
    })

    it('16. GET /v1/device-services - list work orders with filters', async () => {
      const devRes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          serial_number: 'SN-WO-LIST-01',
          device_type: 'ROUTER'
        })
      const deviceId = devRes.body.id

      await request(app)
        .post('/v1/device-services')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          device_id: deviceId,
          service_type: 'MAINTENANCE',
          technician_name: 'Agus'
        })

      const listRes = await request(app)
        .get('/v1/device-services?service_type=MAINTENANCE')
        .set('Authorization', `Bearer ${ownerTokenA}`)

      expect(listRes.status).toBe(200)
      expect(listRes.body.items.length).toBe(1)
      expect(listRes.body.items[0].service_type).toBe('MAINTENANCE')
    })

    it('17. GET /v1/device-services/:id - retrieve work order detail', async () => {
      const devRes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          serial_number: 'SN-WO-DET-01',
          device_type: 'ROUTER',
          notes: 'MikroTik'
        })
      const deviceId = devRes.body.id

      const woRes = await request(app)
        .post('/v1/device-services')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          device_id: deviceId,
          service_type: 'REPAIR',
          findings: 'Port 1 damaged by lightning'
        })
      const serviceId = woRes.body.id

      const detailRes = await request(app)
        .get(`/v1/device-services/${serviceId}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)

      expect(detailRes.status).toBe(200)
      expect(detailRes.body.id).toBe(serviceId)
      expect(detailRes.body.device_serial).toBe('SN-WO-DET-01')
      expect(detailRes.body.findings).toBe('Port 1 damaged by lightning')
    })

    it('18. PATCH /v1/device-services/:id - update work order status and technician', async () => {
      const devRes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          serial_number: 'SN-WO-PATCH-01',
          device_type: 'ROUTER'
        })
      const deviceId = devRes.body.id

      const woRes = await request(app)
        .post('/v1/device-services')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          device_id: deviceId,
          service_type: 'MAINTENANCE'
        })
      const serviceId = woRes.body.id

      const patchRes = await request(app)
        .patch(`/v1/device-services/${serviceId}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          status: 'IN_PROGRESS',
          technician_name: 'Dedi Kusuma'
        })

      expect(patchRes.status).toBe(200)
      expect(patchRes.body.status).toBe('IN_PROGRESS')
      expect(patchRes.body.technician_name).toBe('Dedi Kusuma')
    })

    it('19. POST /v1/device-services/:id/complete - atomic RMA replacement swap by STAFF', async () => {
      const customerId = await seedCustomer(BUSINESS_A)
      const productId = await seedProduct(BUSINESS_A, BRANCH_A)

      // Device A (defective currently installed at customer)
      const devARes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({
          branch_id: BRANCH_A,
          product_id: productId,
          serial_number: 'SN-DEV-A-BROKEN',
          device_type: 'ROUTER'
        })
      const deviceAId = devARes.body.id
      await request(app)
        .post(`/v1/devices/${deviceAId}/assign`)
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({ customer_id: customerId, installed_address: 'Site 101, Ruang Server' })

      // Device B (replacement in stock)
      const devBRes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({
          branch_id: BRANCH_A,
          product_id: productId,
          serial_number: 'SN-DEV-B-HEALTHY',
          device_type: 'ROUTER'
        })
      const deviceBId = devBRes.body.id

      // Create REPLACEMENT work order
      const woRes = await request(app)
        .post('/v1/device-services')
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({
          device_id: deviceAId,
          customer_id: customerId,
          service_type: 'REPLACEMENT',
          replacement_device_id: deviceBId,
          technician_name: 'Field Eng Staff'
        })
      const serviceId = woRes.body.id

      // Complete work order -> executes atomic hardware swap
      const compRes = await request(app)
        .post(`/v1/device-services/${serviceId}/complete`)
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({
          replacement_device_id: deviceBId,
          findings: 'Hardware failure on CPU',
          action_taken: 'Replaced with fresh unit by Staff'
        })

      expect(compRes.status).toBe(200)
      expect(compRes.body.status).toBe('COMPLETED')
      expect(compRes.body.replacement_device_id).toBe(deviceBId)

      // Verify Device A status: DEFECTIVE and unassigned
      const devAState = await request(app)
        .get(`/v1/devices/${deviceAId}`)
        .set('Authorization', `Bearer ${staffTokenA}`)
      expect(devAState.body.status).toBe('DEFECTIVE')
      expect(devAState.body.customer_id).toBeNull()

      // Verify Device B status: INSTALLED at customer with Device A's address
      const devBState = await request(app)
        .get(`/v1/devices/${deviceBId}`)
        .set('Authorization', `Bearer ${staffTokenA}`)
      expect(devBState.body.status).toBe('INSTALLED')
      expect(devBState.body.customer_id).toBe(customerId)
      expect(devBState.body.installed_address).toBe('Site 101, Ruang Server')
    })
  })

  // =========================================================================
  // 4. SECURITY & TENANT ISOLATION
  // =========================================================================
  describe('Tenant Isolation and Security', () => {
    it('20. Cross-tenant device access rejected with 404', async () => {
      // Create device in Tenant A
      const createRes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          serial_number: 'SN-SECRET-A',
          device_type: 'ROUTER'
        })
      const deviceId = createRes.body.id

      // Tenant B attempts to read
      const res = await request(app)
        .get(`/v1/devices/${deviceId}`)
        .set('Authorization', `Bearer ${ownerTokenB}`)
      expect(res.status).toBe(404)
      expect(res.body.error?.code).toBe('NOT_FOUND')
    })

    it('21. Cross-tenant service access rejected with 404', async () => {
      const devRes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          serial_number: 'SN-SERVICE-A',
          device_type: 'ROUTER'
        })
      const deviceId = devRes.body.id

      const woRes = await request(app)
        .post('/v1/device-services')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          device_id: deviceId,
          service_type: 'MAINTENANCE'
        })
      const serviceId = woRes.body.id

      // Tenant B attempts to read
      const res = await request(app)
        .get(`/v1/device-services/${serviceId}`)
        .set('Authorization', `Bearer ${ownerTokenB}`)
      expect(res.status).toBe(404)
      expect(res.body.error?.code).toBe('NOT_FOUND')
    })

    it('22. Arbitrary business_id in payload or query cannot bypass authenticated tenant', async () => {
      // Attacker sends body with business_id: BUSINESS_B using Token A
      const res = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          business_id: BUSINESS_B, // Mismatch
          branch_id: BRANCH_A,
          serial_number: 'SN-ATTACK-01',
          device_type: 'ROUTER'
        })
      expect(res.status).toBe(403)
      expect(res.body.error?.code).toBe('BUSINESS_ACCESS_DENIED')
    })

    it('23. Cross-tenant replacement device rejected with 404', async () => {
      // Device A in Tenant A
      const devARes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          serial_number: 'SN-TENANT-A-DEV',
          device_type: 'ROUTER'
        })
      const devAId = devARes.body.id

      // Device B in Tenant B
      const devBRes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenB}`)
        .send({
          branch_id: BRANCH_B,
          serial_number: 'SN-TENANT-B-DEV',
          device_type: 'ROUTER'
        })
      const devBId = devBRes.body.id

      // Tenant A creates work order referencing Tenant B's device -> 404
      const res = await request(app)
        .post('/v1/device-services')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          device_id: devAId,
          service_type: 'REPLACEMENT',
          replacement_device_id: devBId
        })

      expect(res.status).toBe(404)
      expect(res.body.error?.code).toBe('REPLACEMENT_DEVICE_NOT_FOUND')
    })
  })

  // =========================================================================
  // 5. VALIDATION & ERROR MAPPING
  // =========================================================================
  describe('Validation and Error Mapping', () => {
    it('24. Invalid UUID rejected deterministically (400)', async () => {
      const res = await request(app)
        .get('/v1/devices/not-a-valid-uuid')
        .set('Authorization', `Bearer ${ownerTokenA}`)

      expect(res.status).toBe(400)
      expect(res.body.error?.code).toBe('VALIDATION_ERROR')
    })

    it('25. Invalid DTO missing required fields rejected (400)', async () => {
      const res = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          // Missing branch_id and device_type
          serial_number: 'SN-INVALID'
        })

      expect(res.status).toBe(400)
      expect(res.body.error?.code).toBe('VALIDATION_ERROR')
    })

    it('26. Duplicate serial number returns Conflict (409)', async () => {
      await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          serial_number: 'SN-DUPLICATE-TEST',
          device_type: 'ROUTER'
        })
        .expect(201)

      const duplicateRes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          serial_number: 'sn-duplicate-test', // Same serial, case-insensitive
          device_type: 'ROUTER'
        })

      expect(duplicateRes.status).toBe(409)
      expect(duplicateRes.body.error?.code).toBe('DUPLICATE_SERIAL_NUMBER')
    })

    it('27. Invalid status transition rejected with Conflict (409)', async () => {
      const devRes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          serial_number: 'SN-TRANSITION-ERR',
          device_type: 'ROUTER'
        })
      const deviceId = devRes.body.id

      const woRes = await request(app)
        .post('/v1/device-services')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          device_id: deviceId,
          service_type: 'MAINTENANCE'
        })
      const serviceId = woRes.body.id

      // Try invalid transition from PENDING directly to COMPLETED via PATCH without completing
      const patchRes = await request(app)
        .patch(`/v1/device-services/${serviceId}`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          status: 'COMPLETED'
        })

      expect(patchRes.status).toBe(409)
      expect(patchRes.body.error?.code).toBe('INVALID_SERVICE_STATUS_TRANSITION')
    })

    it('28. Replacement with an unavailable device (INSTALLED) rejected with Conflict (409)', async () => {
      const customerId = await seedCustomer(BUSINESS_A)

      // Device A (defective)
      const devARes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          serial_number: 'SN-RMA-A',
          device_type: 'ROUTER'
        })
      const devAId = devARes.body.id

      // Device B (already installed elsewhere)
      const devBRes = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          branch_id: BRANCH_A,
          serial_number: 'SN-RMA-B',
          device_type: 'ROUTER'
        })
      const devBId = devBRes.body.id
      await request(app)
        .post(`/v1/devices/${devBId}/assign`)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ customer_id: customerId })

      // Try to create work order with Device B as replacement
      const woRes = await request(app)
        .post('/v1/device-services')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({
          device_id: devAId,
          service_type: 'REPLACEMENT',
          replacement_device_id: devBId
        })

      expect(woRes.status).toBe(409)
      expect(woRes.body.error?.code).toBe('REPLACEMENT_DEVICE_UNAVAILABLE')
    })
  })
})
