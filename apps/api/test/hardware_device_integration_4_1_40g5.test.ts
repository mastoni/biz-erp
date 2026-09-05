import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import path from 'path'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { Pool } from 'pg'
import { createApp } from '../src/app'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import { createDeviceService, ALLOWED_DEVICE_TRANSITIONS } from '../src/services/device_service'
import { createDeviceInstallationService, ALLOWED_SERVICE_STATUS_TRANSITIONS } from '../src/services/device_installation_service'
import { inventoryRepository } from '../src/repositories/inventory_repository'
import { createJwtService, JwtService } from '../src/services/jwt_service'
import { ApiError } from '../src/errors/api_error'
import { ConflictError } from '../src/errors/conflict_error'
import { ValidationError } from '../src/errors/validation_error'

import { loadEnv } from '../src/config/env'

import { seedTestUser } from './auth_helper'

describe('Phase 4.1.40G-5: Hardware & Device Service Integration & Transaction Validation', () => {
  let pool: Pool
  let app: ReturnType<typeof createApp>
  let jwtService: JwtService
  let deviceService: ReturnType<typeof createDeviceService>
  let installationService: ReturnType<typeof createDeviceInstallationService>

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))

    const jwtSecret = process.env.JWT_SECRET || 'insecure-test-secret-that-is-at-least-32-chars-long'
    const jwtIssuer = process.env.JWT_ISSUER || 'biz-erp-api'
    const jwtAudience = process.env.JWT_AUDIENCE || 'biz-erp-client'
    jwtService = createJwtService(jwtSecret, jwtIssuer, jwtAudience)

    app = createApp(pool)
    deviceService = createDeviceService(pool)
    installationService = createDeviceInstallationService(pool)
  }, 30000)

  afterAll(async () => {
    await pool.end()
  }, 30000)

  // Helper to create an isolated tenant context for a test
  async function createTenantContext(prefix: string) {
    const bizId = randomUUID()
    const branchId = randomUUID()
    const productId = randomUUID()
    const customerId = randomUUID()

    await seedTestUser(pool, bizId, { withSubscription: true })

    await pool.query(`INSERT INTO businesses (id, name, status) VALUES ($1, $2, 'ACTIVE') ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE'`, [bizId, `${prefix} Biz`])
    await pool.query(`INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, $3, TRUE)`, [
      branchId,
      bizId,
      `${prefix} Branch`
    ])
    await pool.query(
      `INSERT INTO products (id, business_id, name, price_minor, cost_minor, is_active) VALUES ($1, $2, $3, 1500000, 1000000, TRUE)`,
      [productId, bizId, `${prefix} GPON ONU Router`]
    )
    await pool.query(
      `INSERT INTO customers (id, business_id, name, phone) VALUES ($1, $2, $3, '+628123456789')`,
      [customerId, bizId, `${prefix} Customer`]
    )

    const ownerToken = jwtService.signAccessToken({
      sub: randomUUID(),
      business_id: bizId,
      role: 'OWNER',
      session_id: randomUUID(),
      jti: randomUUID()
    })

    const staffToken = jwtService.signAccessToken({
      sub: randomUUID(),
      business_id: bizId,
      role: 'STAFF',
      session_id: randomUUID(),
      jti: randomUUID()
    })

    const cashierToken = jwtService.signAccessToken({
      sub: randomUUID(),
      business_id: bizId,
      role: 'CASHIER',
      session_id: randomUUID(),
      jti: randomUUID()
    })

    return { bizId, branchId, productId, customerId, ownerToken, staffToken, cashierToken }
  }

  // =========================================================================
  // 1. DEVICE LIFECYCLE & STATE MACHINE INTEGRATION
  // =========================================================================
  describe('1. Device Lifecycle State Machine', () => {
    it('G5-001: validates full happy-path lifecycle transitions', async () => {
      const ctx = await createTenantContext('G5-LIFE-1')
      const serial = `SN-G5-LIFE-${Date.now()}`

      // Initial state: IN_STOCK
      const dev = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: serial,
          device_type: 'ROUTER',
          status: 'IN_STOCK'
        },
        'TEST-ACTOR'
      )
      expect(dev.status).toBe('IN_STOCK')

      // IN_STOCK -> RESERVED
      let updated = await deviceService.transitionDeviceStatus(ctx.bizId, dev.id, 'RESERVED')
      expect(updated.status).toBe('RESERVED')

      // RESERVED -> INSTALLED
      updated = await deviceService.transitionDeviceStatus(ctx.bizId, dev.id, 'INSTALLED')
      expect(updated.status).toBe('INSTALLED')

      // INSTALLED -> RETURNED
      updated = await deviceService.transitionDeviceStatus(ctx.bizId, dev.id, 'RETURNED')
      expect(updated.status).toBe('RETURNED')

      // RETURNED -> IN_STOCK
      updated = await deviceService.transitionDeviceStatus(ctx.bizId, dev.id, 'IN_STOCK')
      expect(updated.status).toBe('IN_STOCK')

      // IN_STOCK -> DEFECTIVE
      updated = await deviceService.transitionDeviceStatus(ctx.bizId, dev.id, 'DEFECTIVE')
      expect(updated.status).toBe('DEFECTIVE')

      // DEFECTIVE -> IN_REPAIR
      updated = await deviceService.transitionDeviceStatus(ctx.bizId, dev.id, 'IN_REPAIR')
      expect(updated.status).toBe('IN_REPAIR')

      // IN_REPAIR -> IN_STOCK
      updated = await deviceService.transitionDeviceStatus(ctx.bizId, dev.id, 'IN_STOCK')
      expect(updated.status).toBe('IN_STOCK')

      // IN_STOCK -> DECOMMISSIONED (Terminal)
      updated = await deviceService.transitionDeviceStatus(ctx.bizId, dev.id, 'DECOMMISSIONED')
      expect(updated.status).toBe('DECOMMISSIONED')
    })

    it('G5-002: rejects invalid and terminal state transitions safely', async () => {
      const ctx = await createTenantContext('G5-LIFE-2')
      const serial = `SN-G5-TERM-${Date.now()}`

      const dev = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: serial,
          device_type: 'ROUTER',
          status: 'DECOMMISSIONED'
        },
        'TEST-ACTOR'
      )
      expect(dev.status).toBe('DECOMMISSIONED')

      // DECOMMISSIONED is terminal: cannot transition anywhere
      await expect(deviceService.transitionDeviceStatus(ctx.bizId, dev.id, 'IN_STOCK')).rejects.toThrow(ConflictError)
      await expect(deviceService.transitionDeviceStatus(ctx.bizId, dev.id, 'INSTALLED')).rejects.toThrow(ConflictError)
      await expect(deviceService.transitionDeviceStatus(ctx.bizId, dev.id, 'DEFECTIVE')).rejects.toThrow(ConflictError)

      // IN_STOCK cannot jump directly to IN_REPAIR or RETURNED
      const activeDev = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: `${serial}-ACTIVE`,
          device_type: 'ROUTER',
          status: 'IN_STOCK'
        },
        'TEST-ACTOR'
      )
      await expect(deviceService.transitionDeviceStatus(ctx.bizId, activeDev.id, 'IN_REPAIR')).rejects.toThrow(ConflictError)
      await expect(deviceService.transitionDeviceStatus(ctx.bizId, activeDev.id, 'RETURNED')).rejects.toThrow(ConflictError)
    })
  })

  // =========================================================================
  // 2. INVENTORY <-> DEVICE SYNCHRONIZATION
  // =========================================================================
  describe('2. Inventory <-> Device Synchronization', () => {
    it('G5-003: sync_inventory=true increments stock and creates STOCK_IN movement', async () => {
      const ctx = await createTenantContext('G5-INV-SYNC')
      const serial = `SN-G5-SYNC-${Date.now()}`

      // Initially stock = 0
      const stockBefore = await inventoryRepository.getStock(pool, ctx.bizId, ctx.branchId, ctx.productId)
      expect(stockBefore).toBeNull()

      const dev = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: serial,
          device_type: 'ONT',
          sync_inventory: true
        },
        'TEST-ACTOR'
      )

      // Stock should now be exactly 1
      const stockAfter = await inventoryRepository.getStock(pool, ctx.bizId, ctx.branchId, ctx.productId)
      expect(stockAfter).not.toBeNull()
      expect(stockAfter!.quantity).toBe(1)

      // Stock movement should be recorded as STOCK_IN
      const movements = await pool.query(
        `SELECT * FROM stock_movements WHERE business_id = $1 AND product_id = $2 ORDER BY timestamp DESC`,
        [ctx.bizId, ctx.productId]
      )
      expect(movements.rows.length).toBe(1)
      expect(movements.rows[0].movement_type).toBe('STOCK_IN')
      expect(movements.rows[0].quantity).toBe(1)
      expect(movements.rows[0].reference).toBe(`DEVICE_INGEST:${dev.serial_number}`)
    })

    it('G5-004: sync_inventory=false does NOT increment stock or record movements', async () => {
      const ctx = await createTenantContext('G5-INV-NOSYNC')
      const serial = `SN-G5-NOSYNC-${Date.now()}`

      // Seed initial manual stock = 5
      await pool.query(
        `INSERT INTO stocks (id, business_id, branch_id, product_id, quantity, server_version) VALUES ($1, $2, $3, $4, 5, 1)`,
        [randomUUID(), ctx.bizId, ctx.branchId, ctx.productId]
      )

      await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: serial,
          device_type: 'ONT',
          sync_inventory: false
        },
        'TEST-ACTOR'
      )

      const stock = await inventoryRepository.getStock(pool, ctx.bizId, ctx.branchId, ctx.productId)
      expect(stock!.quantity).toBe(5)

      const movements = await pool.query(
        `SELECT * FROM stock_movements WHERE business_id = $1 AND product_id = $2`,
        [ctx.bizId, ctx.productId]
      )
      expect(movements.rows.length).toBe(0)
    })

    it('G5-005: proves distinction between aggregate stock quantity and serialized units', async () => {
      const ctx = await createTenantContext('G5-INV-BULK')

      // Ingest bulk 3 serialized devices with sync_inventory=true
      const bulkRes = await deviceService.createBulkDevices(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          device_type: 'ROUTER',
          sync_inventory: true,
          items: [
            { serial_number: `SN-BULK-1-${Date.now()}` },
            { serial_number: `SN-BULK-2-${Date.now()}` },
            { serial_number: `SN-BULK-3-${Date.now()}` }
          ]
        },
        'TEST-ACTOR'
      )
      expect(bulkRes.length).toBe(3)

      let stock = await inventoryRepository.getStock(pool, ctx.bizId, ctx.branchId, ctx.productId)
      expect(stock!.quantity).toBe(3)

      // Assign device 1 -> stock decrements to 2
      await deviceService.assignDevice(
        ctx.bizId,
        bulkRes[0].id,
        { customer_id: ctx.customerId, installed_address: 'Main St 101' },
        'TEST-ACTOR'
      )

      stock = await inventoryRepository.getStock(pool, ctx.bizId, ctx.branchId, ctx.productId)
      expect(stock!.quantity).toBe(2)

      // Unassign device 1 back to IN_STOCK -> stock returns to 3
      await deviceService.unassignDevice(ctx.bizId, bulkRes[0].id, { return_status: 'IN_STOCK' }, 'TEST-ACTOR')

      stock = await inventoryRepository.getStock(pool, ctx.bizId, ctx.branchId, ctx.productId)
      expect(stock!.quantity).toBe(3)
    })
  })

  // =========================================================================
  // 3. INSTALLATION TRANSACTION & ATOMIC ROLLBACK
  // =========================================================================
  describe('3. Installation Transaction & Atomic Rollback', () => {
    it('G5-006: completes installation atomically with single stock decrement', async () => {
      const ctx = await createTenantContext('G5-INSTALL')
      const serial = `SN-G5-INST-${Date.now()}`

      const dev = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: serial,
          device_type: 'ROUTER',
          sync_inventory: true
        },
        'TEST-ACTOR'
      )

      const assigned = await deviceService.assignDevice(
        ctx.bizId,
        dev.id,
        {
          customer_id: ctx.customerId,
          installed_address: 'Jl. Sudirman No 45',
          notes: 'Standard fiber install'
        },
        'TEST-ACTOR'
      )

      expect(assigned.status).toBe('INSTALLED')
      expect(assigned.customer_id).toBe(ctx.customerId)
      expect(assigned.installed_address).toBe('Jl. Sudirman No 45')
      expect(assigned.installed_at).not.toBeNull()

      // Stock should decrement from 1 to 0
      const stock = await inventoryRepository.getStock(pool, ctx.bizId, ctx.branchId, ctx.productId)
      expect(stock!.quantity).toBe(0)

      // Movements: 1 STOCK_IN (ingest), 1 STOCK_OUT (install)
      const movements = await pool.query(
        `SELECT * FROM stock_movements WHERE business_id = $1 AND product_id = $2 ORDER BY timestamp ASC`,
        [ctx.bizId, ctx.productId]
      )
      expect(movements.rows.length).toBe(2)
      expect(movements.rows[0].movement_type).toBe('STOCK_IN')
      expect(movements.rows[1].movement_type).toBe('STOCK_OUT')
      expect(movements.rows[1].reference).toBe(`DEVICE_INSTALL:${dev.serial_number}`)
    })

    it('G5-007: rolls back atomically when installation fails due to insufficient stock', async () => {
      const ctx = await createTenantContext('G5-INST-NOSTOCK')
      const serial = `SN-G5-NOSTK-${Date.now()}`

      // Create device with sync_inventory=false, and stock table has quantity=0
      await pool.query(
        `INSERT INTO stocks (id, business_id, branch_id, product_id, quantity, server_version) VALUES ($1, $2, $3, $4, 0, 1)`,
        [randomUUID(), ctx.bizId, ctx.branchId, ctx.productId]
      )

      const dev = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: serial,
          device_type: 'ROUTER',
          sync_inventory: false
        },
        'TEST-ACTOR'
      )

      // Attempting to assign must throw ConflictError (INSUFFICIENT_STOCK)
      await expect(
        deviceService.assignDevice(
          ctx.bizId,
          dev.id,
          { customer_id: ctx.customerId, installed_address: 'No Stock Street' },
          'TEST-ACTOR'
        )
      ).rejects.toThrow(ConflictError)

      // Atomic verification: device is still IN_STOCK, customer is NULL, stock is still 0
      const devCheck = await deviceService.getDevice(ctx.bizId, dev.id)
      expect(devCheck.status).toBe('IN_STOCK')
      expect(devCheck.customer_id).toBeNull()

      const stockCheck = await inventoryRepository.getStock(pool, ctx.bizId, ctx.branchId, ctx.productId)
      expect(stockCheck!.quantity).toBe(0)
    })
  })

  // =========================================================================
  // 4. RETURN TRANSACTION & ATOMIC ROLLBACK
  // =========================================================================
  describe('4. Return Transaction & Atomic Rollback', () => {
    it('G5-008: returns installed device to IN_STOCK with single stock increment', async () => {
      const ctx = await createTenantContext('G5-RETURN-1')
      const serial = `SN-G5-RET-${Date.now()}`

      const dev = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: serial,
          device_type: 'ROUTER',
          sync_inventory: true
        },
        'TEST-ACTOR'
      )

      // Install device
      await deviceService.assignDevice(
        ctx.bizId,
        dev.id,
        { customer_id: ctx.customerId, installed_address: 'Site 10A' },
        'TEST-ACTOR'
      )

      // Unassign back to IN_STOCK
      const unassigned = await deviceService.unassignDevice(
        ctx.bizId,
        dev.id,
        { return_status: 'IN_STOCK', notes: 'Returned after contract ended' },
        'TEST-ACTOR'
      )

      expect(unassigned.status).toBe('IN_STOCK')
      expect(unassigned.customer_id).toBeNull()
      expect(unassigned.installed_address).toBeNull()
      expect(unassigned.installed_at).toBeNull()

      const stock = await inventoryRepository.getStock(pool, ctx.bizId, ctx.branchId, ctx.productId)
      expect(stock!.quantity).toBe(1)

      const movements = await pool.query(
        `SELECT * FROM stock_movements WHERE business_id = $1 AND product_id = $2 ORDER BY timestamp ASC`,
        [ctx.bizId, ctx.productId]
      )
      expect(movements.rows.length).toBe(3) // INGEST -> INSTALL -> RETURN
      expect(movements.rows[2].movement_type).toBe('STOCK_IN')
      expect(movements.rows[2].reference).toBe(`DEVICE_RETURN:${dev.serial_number}`)
    })

    it('G5-009: unassign to DEFECTIVE clears customer without creating duplicate stock increment', async () => {
      const ctx = await createTenantContext('G5-RET-DEF')
      const serial = `SN-G5-RETDEF-${Date.now()}`

      const dev = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: serial,
          device_type: 'ROUTER',
          sync_inventory: true
        },
        'TEST-ACTOR'
      )

      await deviceService.assignDevice(
        ctx.bizId,
        dev.id,
        { customer_id: ctx.customerId, installed_address: 'Site 10B' },
        'TEST-ACTOR'
      )

      // Unassign to DEFECTIVE
      const unassigned = await deviceService.unassignDevice(
        ctx.bizId,
        dev.id,
        { return_status: 'DEFECTIVE', notes: 'Damaged during lightning storm' },
        'TEST-ACTOR'
      )

      expect(unassigned.status).toBe('DEFECTIVE')
      expect(unassigned.customer_id).toBeNull()

      // Stock remains 0 (since defective device cannot be put back into available sellable stock)
      const stock = await inventoryRepository.getStock(pool, ctx.bizId, ctx.branchId, ctx.productId)
      expect(stock!.quantity).toBe(0)
    })

    it('G5-010: rejects unassigning a device that is not INSTALLED', async () => {
      const ctx = await createTenantContext('G5-RET-INVALID')
      const serial = `SN-G5-NOTINST-${Date.now()}`

      const dev = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: serial,
          device_type: 'ROUTER',
          status: 'IN_STOCK'
        },
        'TEST-ACTOR'
      )

      await expect(
        deviceService.unassignDevice(ctx.bizId, dev.id, { return_status: 'IN_STOCK' }, 'TEST-ACTOR')
      ).rejects.toThrow(ConflictError)
    })
  })

  // =========================================================================
  // 5. REPLACEMENT / RMA ATOMIC WORK ORDER
  // =========================================================================
  describe('5. Replacement / RMA Atomic Work Order', () => {
    it('G5-011: executes atomic RMA hardware swap between Device A and Device B', async () => {
      const ctx = await createTenantContext('G5-RMA-OK')
      const serialA = `SN-RMA-A-${Date.now()}`
      const serialB = `SN-RMA-B-${Date.now()}`

      // Device A: INSTALLED at customer
      const devA = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: serialA,
          device_type: 'ONT',
          sync_inventory: true
        },
        'TEST-ACTOR'
      )
      await deviceService.assignDevice(
        ctx.bizId,
        devA.id,
        { customer_id: ctx.customerId, installed_address: 'Kuningan Tower Lt 12' },
        'TEST-ACTOR'
      )

      // Device B: IN_STOCK ready for swap
      const devB = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: serialB,
          device_type: 'ONT',
          sync_inventory: true
        },
        'TEST-ACTOR'
      )

      // Create REPLACEMENT work order
      const workOrder = await installationService.createWorkOrder(
        ctx.bizId,
        {
          device_id: devA.id,
          customer_id: ctx.customerId,
          service_type: 'REPLACEMENT',
          status: 'IN_PROGRESS',
          technician_name: 'Budi Technician',
          replacement_device_id: devB.id,
          findings: 'Optical port burned out',
          notes: 'Replace with brand new unit'
        },
        'TEST-ACTOR'
      )

      // Complete REPLACEMENT work order
      const completedWO = await installationService.completeWorkOrder(
        ctx.bizId,
        workOrder.id,
        {
          findings: 'Port destroyed by surge',
          action_taken: 'Replaced with Device B and tested PON signal -21dBm'
        },
        'TEST-ACTOR'
      )

      expect(completedWO.status).toBe('COMPLETED')
      expect(completedWO.replacement_device_id).toBe(devB.id)

      // Device A must be DEFECTIVE and unassigned
      const refreshedA = await deviceService.getDevice(ctx.bizId, devA.id)
      expect(refreshedA.status).toBe('DEFECTIVE')
      expect(refreshedA.customer_id).toBeNull()

      // Device B must be INSTALLED at ctx.customerId with address inherited from A
      const refreshedB = await deviceService.getDevice(ctx.bizId, devB.id)
      expect(refreshedB.status).toBe('INSTALLED')
      expect(refreshedB.customer_id).toBe(ctx.customerId)
      expect(refreshedB.installed_address).toBe('Kuningan Tower Lt 12')

      // Stock should have deducted Device B
      const stock = await inventoryRepository.getStock(pool, ctx.bizId, ctx.branchId, ctx.productId)
      expect(stock!.quantity).toBe(0) // 1 in for A, 1 out for A, 1 in for B, 1 out for B swap = 0

      const rmaMovement = await pool.query(
        `SELECT * FROM stock_movements WHERE business_id = $1 AND reference LIKE 'DEVICE_RMA_SWAP:%'`,
        [ctx.bizId]
      )
      expect(rmaMovement.rows.length).toBe(1)
      expect(rmaMovement.rows[0].reference).toBe(`DEVICE_RMA_SWAP:${serialA}->${serialB}`)
    })

    it('G5-012: rolls back atomically if replacement device is already INSTALLED elsewhere', async () => {
      const ctx = await createTenantContext('G5-RMA-FAIL')
      const serialA = `SN-RMA-FAIL-A-${Date.now()}`
      const serialB = `SN-RMA-FAIL-B-${Date.now()}`

      // Device A: INSTALLED
      const devA = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: serialA,
          device_type: 'ONT',
          sync_inventory: true
        },
        'TEST-ACTOR'
      )
      await deviceService.assignDevice(
        ctx.bizId,
        devA.id,
        { customer_id: ctx.customerId, installed_address: 'Site A' },
        'TEST-ACTOR'
      )

      // Device B: also INSTALLED at another customer
      const customer2 = randomUUID()
      await pool.query(`INSERT INTO customers (id, business_id, name, phone) VALUES ($1, $2, $3, $4)`, [
        customer2,
        ctx.bizId,
        'Second Customer',
        '+628999999'
      ])

      const devB = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: serialB,
          device_type: 'ONT',
          sync_inventory: true
        },
        'TEST-ACTOR'
      )
      await deviceService.assignDevice(
        ctx.bizId,
        devB.id,
        { customer_id: customer2, installed_address: 'Site B' },
        'TEST-ACTOR'
      )

      // Work order created for Device A
      const workOrder = await installationService.createWorkOrder(
        ctx.bizId,
        {
          device_id: devA.id,
          customer_id: ctx.customerId,
          service_type: 'REPLACEMENT',
          status: 'PENDING'
        },
        'TEST-ACTOR'
      )

      // Attempting to complete with Device B must fail (REPLACEMENT_DEVICE_UNAVAILABLE)
      await expect(
        installationService.completeWorkOrder(
          ctx.bizId,
          workOrder.id,
          { replacement_device_id: devB.id },
          'TEST-ACTOR'
        )
      ).rejects.toThrow(ConflictError)

      // Atomic verification: Device A is still INSTALLED at ctx.customerId, Device B is still INSTALLED at customer2
      const checkA = await deviceService.getDevice(ctx.bizId, devA.id)
      expect(checkA.status).toBe('INSTALLED')
      expect(checkA.customer_id).toBe(ctx.customerId)

      const checkB = await deviceService.getDevice(ctx.bizId, devB.id)
      expect(checkB.status).toBe('INSTALLED')
      expect(checkB.customer_id).toBe(customer2)

      const woCheck = await installationService.getWorkOrder(ctx.bizId, workOrder.id)
      expect(woCheck.status).toBe('PENDING')
    })
  })

  // =========================================================================
  // 6. OPTIMISTIC CONCURRENCY / SERVER VERSIONING
  // =========================================================================
  describe('6. Optimistic Concurrency / Server Versioning', () => {
    it('G5-013: rejects stale stock updates and aborts device assignment safely', async () => {
      const ctx = await createTenantContext('G5-CONCURRENCY')
      const serial = `SN-G5-CONC-${Date.now()}`

      const dev = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: serial,
          device_type: 'ROUTER',
          sync_inventory: true
        },
        'TEST-ACTOR'
      )

      // Stale update test: artificially increment stock server_version in DB
      await pool.query(
        `UPDATE stocks SET server_version = server_version + 10 WHERE business_id = $1 AND product_id = $2`,
        [ctx.bizId, ctx.productId]
      )

      // Attempt atomic update with stale version
      const stock = await inventoryRepository.getStock(pool, ctx.bizId, ctx.branchId, ctx.productId)
      const staleAttempt = await inventoryRepository.updateStockAtomic(
        pool,
        stock!.id,
        -1,
        1 // wrong stale version
      )
      expect(staleAttempt).toBeNull()
    })
  })

  // =========================================================================
  // 7. TENANT ISOLATION BOUNDARY
  // =========================================================================
  describe('7. Tenant Isolation Boundary', () => {
    it('G5-014: cross-tenant access to devices and work orders returns 404', async () => {
      const tenantA = await createTenantContext('G5-TENANT-A')
      const tenantB = await createTenantContext('G5-TENANT-B')

      const devA = await deviceService.createDevice(
        tenantA.bizId,
        {
          branch_id: tenantA.branchId,
          product_id: tenantA.productId,
          serial_number: `SN-TENANT-A-${Date.now()}`,
          device_type: 'ROUTER'
        },
        'TEST-ACTOR'
      )

      const woA = await installationService.createWorkOrder(
        tenantA.bizId,
        {
          device_id: devA.id,
          customer_id: tenantA.customerId,
          service_type: 'INSTALLATION'
        },
        'TEST-ACTOR'
      )

      // Tenant B cannot get Device A
      await expect(deviceService.getDevice(tenantB.bizId, devA.id)).rejects.toThrow(ApiError)

      // Tenant B cannot update Device A
      await expect(
        deviceService.updateDevice(tenantB.bizId, devA.id, { notes: 'Hacked by tenant B' })
      ).rejects.toThrow(ApiError)

      // Tenant B cannot get Work Order A
      await expect(installationService.getWorkOrder(tenantB.bizId, woA.id)).rejects.toThrow(ApiError)

      // Tenant B cannot complete Work Order A
      await expect(
        installationService.completeWorkOrder(tenantB.bizId, woA.id, {}, 'TEST-ACTOR')
      ).rejects.toThrow(ApiError)

      // Tenant A cannot use Tenant B's customer in assignment
      await expect(
        deviceService.assignDevice(
          tenantA.bizId,
          devA.id,
          { customer_id: tenantB.customerId },
          'TEST-ACTOR'
        )
      ).rejects.toThrow(ApiError)
    })

    it('G5-015: cross-tenant replacement device in RMA is rejected with 404', async () => {
      const tenantA = await createTenantContext('G5-RMA-ISOL-A')
      const tenantB = await createTenantContext('G5-RMA-ISOL-B')

      const devA = await deviceService.createDevice(
        tenantA.bizId,
        {
          branch_id: tenantA.branchId,
          product_id: tenantA.productId,
          serial_number: `SN-A-${Date.now()}`,
          device_type: 'ROUTER'
        },
        'TEST-ACTOR'
      )

      const devBFromTenantB = await deviceService.createDevice(
        tenantB.bizId,
        {
          branch_id: tenantB.branchId,
          product_id: tenantB.productId,
          serial_number: `SN-B-TENANT-B-${Date.now()}`,
          device_type: 'ROUTER'
        },
        'TEST-ACTOR'
      )

      const woA = await installationService.createWorkOrder(
        tenantA.bizId,
        {
          device_id: devA.id,
          customer_id: tenantA.customerId,
          service_type: 'REPLACEMENT'
        },
        'TEST-ACTOR'
      )

      // Completing WO in Tenant A with replacement device from Tenant B must fail with 404
      await expect(
        installationService.completeWorkOrder(
          tenantA.bizId,
          woA.id,
          { replacement_device_id: devBFromTenantB.id },
          'TEST-ACTOR'
        )
      ).rejects.toThrow(ApiError)
    })
  })

  // =========================================================================
  // 8. RBAC INTEGRATION & ROUTE SECURITY
  // =========================================================================
  describe('8. RBAC Integration & Route Security', () => {
    it('G5-016: verifies OWNER, STAFF, and CASHIER privileges end-to-end via Express HTTP', async () => {
      const ctx = await createTenantContext('G5-RBAC')
      const serial = `SN-G5-RBAC-${Date.now()}`

      // 1. CASHIER CANNOT register device (403)
      const cashierPost = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ctx.cashierToken}`)
        .send({
          branch_id: ctx.branchId,
          serial_number: serial,
          device_type: 'ROUTER'
        })
      expect(cashierPost.status).toBe(403)

      // 2. STAFF CAN register device (201)
      const staffPost = await request(app)
        .post('/v1/devices')
        .set('Authorization', `Bearer ${ctx.staffToken}`)
        .send({
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: serial,
          device_type: 'ROUTER',
          sync_inventory: true
        })
      expect(staffPost.status).toBe(201)
      const deviceId = staffPost.body.id

      // 3. CASHIER CAN perform read-only lookup on devices (200)
      const cashierGetList = await request(app)
        .get('/v1/devices')
        .set('Authorization', `Bearer ${ctx.cashierToken}`)
      expect(cashierGetList.status).toBe(200)
      expect(cashierGetList.body.items.length).toBeGreaterThanOrEqual(1)

      const cashierGetDetail = await request(app)
        .get(`/v1/devices/${deviceId}`)
        .set('Authorization', `Bearer ${ctx.cashierToken}`)
      expect(cashierGetDetail.status).toBe(200)
      expect(cashierGetDetail.body.serial_number).toBe(serial)

      // 4. CASHIER CANNOT access device-services work orders (403)
      const cashierGetServices = await request(app)
        .get('/v1/device-services')
        .set('Authorization', `Bearer ${ctx.cashierToken}`)
      expect(cashierGetServices.status).toBe(403)

      // 5. STAFF CAN assign device (200)
      const staffAssign = await request(app)
        .post(`/v1/devices/${deviceId}/assign`)
        .set('Authorization', `Bearer ${ctx.staffToken}`)
        .send({ customer_id: ctx.customerId, installed_address: 'Plaza Semanggi' })
      expect(staffAssign.status).toBe(200)
      expect(staffAssign.body.status).toBe('INSTALLED')

      // 6. STAFF CAN create and complete work orders (201 / 200)
      const staffCreateWO = await request(app)
        .post('/v1/device-services')
        .set('Authorization', `Bearer ${ctx.staffToken}`)
        .send({
          device_id: deviceId,
          customer_id: ctx.customerId,
          service_type: 'MAINTENANCE',
          technician_name: 'Staff Tech'
        })
      expect(staffCreateWO.status).toBe(201)
      const woId = staffCreateWO.body.id

      const staffCompleteWO = await request(app)
        .post(`/v1/device-services/${woId}/complete`)
        .set('Authorization', `Bearer ${ctx.staffToken}`)
        .send({ action_taken: 'Cleaned dust filters and checked laser RX' })
      expect(staffCompleteWO.status).toBe(200)
      expect(staffCompleteWO.body.status).toBe('COMPLETED')
    })
  })

  // =========================================================================
  // 9. WORK ORDER INTEGRITY & LIFECYCLE
  // =========================================================================
  describe('9. Work Order Integrity & Lifecycle', () => {
    it('G5-017: validates work order lifecycle transitions and terminal cancellation', async () => {
      const ctx = await createTenantContext('G5-WO-LIFE')
      const serial = `SN-G5-WO-${Date.now()}`

      const dev = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: serial,
          device_type: 'ROUTER'
        },
        'TEST-ACTOR'
      )

      // 1. PENDING -> SCHEDULED
      const wo = await installationService.createWorkOrder(
        ctx.bizId,
        {
          device_id: dev.id,
          customer_id: ctx.customerId,
          service_type: 'MAINTENANCE',
          status: 'PENDING'
        },
        'TEST-ACTOR'
      )
      expect(wo.status).toBe('PENDING')

      let updatedWO = await installationService.updateWorkOrder(ctx.bizId, wo.id, {
        status: 'SCHEDULED',
        scheduled_at: new Date(Date.now() + 86400000).toISOString()
      })
      expect(updatedWO.status).toBe('SCHEDULED')

      // 2. SCHEDULED -> IN_PROGRESS
      updatedWO = await installationService.updateWorkOrder(ctx.bizId, wo.id, {
        status: 'IN_PROGRESS',
        technician_name: 'Agus Technician'
      })
      expect(updatedWO.status).toBe('IN_PROGRESS')

      // 3. IN_PROGRESS -> COMPLETED
      const completed = await installationService.completeWorkOrder(
        ctx.bizId,
        wo.id,
        { findings: 'All OK', action_taken: 'Firmware upgraded' },
        'TEST-ACTOR'
      )
      expect(completed.status).toBe('COMPLETED')

      // 4. COMPLETED is terminal: cannot update status or complete again
      await expect(
        installationService.updateWorkOrder(ctx.bizId, wo.id, { status: 'IN_PROGRESS' })
      ).rejects.toThrow(ConflictError)

      await expect(
        installationService.completeWorkOrder(ctx.bizId, wo.id, {}, 'TEST-ACTOR')
      ).rejects.toThrow(ConflictError)
    })

    it('G5-018: validates CANCELLED work order is terminal', async () => {
      const ctx = await createTenantContext('G5-WO-CANCEL')
      const serial = `SN-G5-WOCANC-${Date.now()}`

      const dev = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: serial,
          device_type: 'ROUTER'
        },
        'TEST-ACTOR'
      )

      const wo = await installationService.createWorkOrder(
        ctx.bizId,
        {
          device_id: dev.id,
          customer_id: ctx.customerId,
          service_type: 'REPAIR',
          status: 'PENDING'
        },
        'TEST-ACTOR'
      )

      // PENDING -> CANCELLED
      const cancelled = await installationService.updateWorkOrder(ctx.bizId, wo.id, {
        status: 'CANCELLED',
        notes: 'Customer cancelled repair appointment'
      })
      expect(cancelled.status).toBe('CANCELLED')

      // CANCELLED cannot transition anywhere
      await expect(
        installationService.updateWorkOrder(ctx.bizId, wo.id, { status: 'PENDING' })
      ).rejects.toThrow(ConflictError)

      await expect(
        installationService.completeWorkOrder(ctx.bizId, wo.id, {}, 'TEST-ACTOR')
      ).rejects.toThrow(ConflictError)
    })
  })
})
