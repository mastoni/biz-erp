import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { Pool } from 'pg'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'
import { randomUUID } from 'crypto'
import { createDeviceService } from '../src/services/device_service'
import { createDeviceInstallationService } from '../src/services/device_installation_service'
import { inventoryRepository } from '../src/repositories/inventory_repository'
import { ApiError } from '../src/errors/api_error'
import { ConflictError } from '../src/errors/conflict_error'

describe('Phase 4.1.40G-3: Hardware & Device Service Logic & Repository', () => {
  let pool: Pool
  let deviceService: ReturnType<typeof createDeviceService>
  let installationService: ReturnType<typeof createDeviceInstallationService>

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    pool = createPool(databaseUrl)
    await runMigrations(pool, path.resolve(process.cwd(), 'migrations'))
    deviceService = createDeviceService(pool)
    installationService = createDeviceInstallationService(pool)
  })

  afterAll(async () => {
    await pool.end()
  })

  // Helper to create fully populated test business context
  async function createTestContext(prefix: string) {
    const bizId = randomUUID()
    const branchId = randomUUID()
    const productId = randomUUID()
    const customerId = randomUUID()

    await pool.query(`INSERT INTO businesses (id, name) VALUES ($1, $2)`, [bizId, `${prefix} Biz`])
    await pool.query(`INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, $3, TRUE)`, [
      branchId,
      bizId,
      `${prefix} Branch`
    ])
    await pool.query(
      `INSERT INTO products (id, business_id, name, price_minor, cost_minor, is_active) VALUES ($1, $2, $3, 100000, 50000, TRUE)`,
      [productId, bizId, `${prefix} Product`]
    )
    await pool.query(
      `INSERT INTO customers (id, business_id, name, phone) VALUES ($1, $2, $3, '+6281111111')`,
      [customerId, bizId, `${prefix} Customer`]
    )

    return { bizId, branchId, productId, customerId }
  }

  describe('1. Device Creation & Cross-Tenant Rejection', () => {
    it('G3-001: creates device with tenant-scoped validation', async () => {
      const ctx = await createTestContext('G3-CREATE')
      const serial = `SN-G3-${Date.now()}`

      const dev = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: serial,
          mac_address: '11:22:33:AA:BB:CC',
          device_type: 'ONT',
          ownership_type: 'TENANT_OWNED',
          status: 'IN_STOCK'
        },
        'TEST_ACTOR'
      )

      expect(dev.id).toBeDefined()
      expect(dev.business_id).toBe(ctx.bizId)
      expect(dev.serial_number).toBe(serial)
      expect(dev.status).toBe('IN_STOCK')
    })

    it('G3-002: rejects creation with cross-tenant branch, product, or customer', async () => {
      const ctxA = await createTestContext('G3-CT-A')
      const ctxB = await createTestContext('G3-CT-B')

      // Cross-tenant branch
      await expect(
        deviceService.createDevice(
          ctxA.bizId,
          {
            branch_id: ctxB.branchId, // Branch belongs to B
            serial_number: `SN-BAD-BR-${Date.now()}`,
            device_type: 'ROUTER'
          },
          'TEST_ACTOR'
        )
      ).rejects.toThrow(ApiError)

      // Cross-tenant product
      await expect(
        deviceService.createDevice(
          ctxA.bizId,
          {
            branch_id: ctxA.branchId,
            product_id: ctxB.productId, // Product belongs to B
            serial_number: `SN-BAD-PR-${Date.now()}`,
            device_type: 'ROUTER'
          },
          'TEST_ACTOR'
        )
      ).rejects.toThrow(ApiError)

      // Cross-tenant customer
      await expect(
        deviceService.createDevice(
          ctxA.bizId,
          {
            branch_id: ctxA.branchId,
            customer_id: ctxB.customerId, // Customer belongs to B
            serial_number: `SN-BAD-CU-${Date.now()}`,
            device_type: 'ROUTER'
          },
          'TEST_ACTOR'
        )
      ).rejects.toThrow(ApiError)
    })

    it('G3-003: rejects duplicate serial and MAC in same business', async () => {
      const ctx = await createTestContext('G3-DUP')
      const serial = `SN-DUP-SVC-${Date.now()}`
      const mac = 'AA:11:22:33:44:55'

      await deviceService.createDevice(
        ctx.bizId,
        { branch_id: ctx.branchId, serial_number: serial, mac_address: mac, device_type: 'ONT' },
        'TEST_ACTOR'
      )

      // Duplicate serial
      await expect(
        deviceService.createDevice(
          ctx.bizId,
          { branch_id: ctx.branchId, serial_number: serial, device_type: 'ONT' },
          'TEST_ACTOR'
        )
      ).rejects.toThrow(ConflictError)

      // Duplicate MAC
      await expect(
        deviceService.createDevice(
          ctx.bizId,
          { branch_id: ctx.branchId, serial_number: `SN-OTHER-${Date.now()}`, mac_address: mac, device_type: 'ONT' },
          'TEST_ACTOR'
        )
      ).rejects.toThrow(ConflictError)
    })

    it('G3-004: bulk creates devices atomically and syncs inventory when requested', async () => {
      const ctx = await createTestContext('G3-BULK')

      const items = [
        { serial_number: `SN-BLK-1-${Date.now()}`, mac_address: '00:11:22:33:44:01' },
        { serial_number: `SN-BLK-2-${Date.now()}`, mac_address: '00:11:22:33:44:02' },
        { serial_number: `SN-BLK-3-${Date.now()}`, mac_address: '00:11:22:33:44:03' }
      ]

      const res = await deviceService.createBulkDevices(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          device_type: 'ONT',
          sync_inventory: true,
          items
        },
        'TEST_ACTOR'
      )

      expect(res.length).toBe(3)

      // Verify stock was incremented by 3
      const client = await pool.connect()
      try {
        const stock = await inventoryRepository.getStock(client, ctx.bizId, ctx.branchId, ctx.productId)
        expect(stock?.quantity).toBe(3)
      } finally {
        client.release()
      }
    })
  })

  describe('2. Device Lifecycle Transitions', () => {
    it('G3-005: enforces valid and invalid lifecycle transitions', async () => {
      const ctx = await createTestContext('G3-LIFECYCLE')
      const dev = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          serial_number: `SN-LC-${Date.now()}`,
          device_type: 'CCTV_CAMERA',
          status: 'IN_STOCK'
        },
        'TEST_ACTOR'
      )

      // IN_STOCK -> RESERVED (Valid)
      const res1 = await deviceService.transitionDeviceStatus(ctx.bizId, dev.id, 'RESERVED')
      expect(res1.status).toBe('RESERVED')

      // RESERVED -> IN_STOCK (Valid)
      const res2 = await deviceService.transitionDeviceStatus(ctx.bizId, dev.id, 'IN_STOCK')
      expect(res2.status).toBe('IN_STOCK')

      // IN_STOCK -> DEFECTIVE (Valid)
      const res3 = await deviceService.transitionDeviceStatus(ctx.bizId, dev.id, 'DEFECTIVE')
      expect(res3.status).toBe('DEFECTIVE')

      // DEFECTIVE -> IN_REPAIR (Valid)
      const res4 = await deviceService.transitionDeviceStatus(ctx.bizId, dev.id, 'IN_REPAIR')
      expect(res4.status).toBe('IN_REPAIR')

      // IN_REPAIR -> DECOMMISSIONED (Valid)
      const res5 = await deviceService.transitionDeviceStatus(ctx.bizId, dev.id, 'DECOMMISSIONED')
      expect(res5.status).toBe('DECOMMISSIONED')

      // DECOMMISSIONED is terminal -> attempting transition must throw ConflictError
      await expect(
        deviceService.transitionDeviceStatus(ctx.bizId, dev.id, 'IN_STOCK')
      ).rejects.toThrow(ConflictError)
    })
  })

  describe('3. Assignment, Unassignment, and Inventory Synchronization', () => {
    it('G3-006: assigning IN_STOCK device sets INSTALLED and decrements branch stock', async () => {
      const ctx = await createTestContext('G3-ASSIGN')
      const serial = `SN-ASN-${Date.now()}`

      // Create device with initial stock = 1 (via sync_inventory)
      const dev = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: serial,
          device_type: 'ONT',
          status: 'IN_STOCK',
          sync_inventory: true
        },
        'TEST_ACTOR'
      )

      // Verify stock = 1
      const client = await pool.connect()
      try {
        const stockBefore = await inventoryRepository.getStock(client, ctx.bizId, ctx.branchId, ctx.productId)
        expect(stockBefore?.quantity).toBe(1)
      } finally {
        client.release()
      }

      // Assign device to customer
      const assigned = await deviceService.assignDevice(
        ctx.bizId,
        dev.id,
        {
          customer_id: ctx.customerId,
          installed_address: 'Komplek Permata Blok A1'
        },
        'TEKNISI_1'
      )

      expect(assigned.status).toBe('INSTALLED')
      expect(assigned.customer_id).toBe(ctx.customerId)
      expect(assigned.installed_address).toBe('Komplek Permata Blok A1')

      // Verify stock = 0
      const client2 = await pool.connect()
      try {
        const stockAfter = await inventoryRepository.getStock(client2, ctx.bizId, ctx.branchId, ctx.productId)
        expect(stockAfter?.quantity).toBe(0)
      } finally {
        client2.release()
      }
    })

    it('G3-007: unassigning device back to IN_STOCK increments stock and clears customer', async () => {
      const ctx = await createTestContext('G3-UNASSIGN')
      const serial = `SN-UNASN-${Date.now()}`

      const dev = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: serial,
          device_type: 'ONT',
          status: 'IN_STOCK',
          sync_inventory: true
        },
        'TEST_ACTOR'
      )

      // Assign first (stock becomes 0)
      await deviceService.assignDevice(ctx.bizId, dev.id, { customer_id: ctx.customerId }, 'TEKNISI')

      // Unassign back to IN_STOCK
      const unassigned = await deviceService.unassignDevice(
        ctx.bizId,
        dev.id,
        { return_status: 'IN_STOCK', notes: 'Contract ended' },
        'TEKNISI'
      )

      expect(unassigned.status).toBe('IN_STOCK')
      expect(unassigned.customer_id).toBeNull()
      expect(unassigned.installed_address).toBeNull()

      // Verify stock = 1 again
      const client = await pool.connect()
      try {
        const stock = await inventoryRepository.getStock(client, ctx.bizId, ctx.branchId, ctx.productId)
        expect(stock?.quantity).toBe(1)
      } finally {
        client.release()
      }
    })
  })

  describe('4. Device Service Work Orders & Atomic Replacement', () => {
    it('G3-008: creates and updates a service work order with valid transitions', async () => {
      const ctx = await createTestContext('G3-WO')
      const dev = await deviceService.createDevice(
        ctx.bizId,
        { branch_id: ctx.branchId, serial_number: `SN-WO-${Date.now()}`, device_type: 'ROUTER' },
        'TEST_ACTOR'
      )

      // Create work order
      const wo = await installationService.createWorkOrder(
        ctx.bizId,
        {
          device_id: dev.id,
          customer_id: ctx.customerId,
          service_type: 'MAINTENANCE',
          technician_name: 'Budi Teknisi'
        },
        'DISPATCHER'
      )

      expect(wo.id).toBeDefined()
      expect(wo.status).toBe('PENDING')
      expect(wo.technician_name).toBe('Budi Teknisi')

      // PENDING -> IN_PROGRESS (Valid)
      const updated = await installationService.updateWorkOrder(ctx.bizId, wo.id, {
        status: 'IN_PROGRESS',
        findings: 'Router firmware outdated'
      })
      expect(updated.status).toBe('IN_PROGRESS')
      expect(updated.findings).toBe('Router firmware outdated')

      // Complete work order
      const completed = await installationService.completeWorkOrder(
        ctx.bizId,
        wo.id,
        { action_taken: 'Upgraded firmware to v3.0' },
        'BUDI'
      )
      expect(completed.status).toBe('COMPLETED')
      expect(completed.completed_at).toBeDefined()
    })

    it('G3-009: performs ATOMIC REPLACEMENT swap (Device A -> Device B)', async () => {
      const ctx = await createTestContext('G3-REPLACE')

      // 1. Device A: currently INSTALLED at Customer
      const devA = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: `SN-OLD-FAULTY-${Date.now()}`,
          device_type: 'ONT',
          status: 'IN_STOCK',
          sync_inventory: true
        },
        'ACTOR'
      )
      await deviceService.assignDevice(
        ctx.bizId,
        devA.id,
        { customer_id: ctx.customerId, installed_address: 'Gedung Cyber Lt 5' },
        'ACTOR'
      )

      // 2. Device B: currently IN_STOCK (replacement unit)
      const devB = await deviceService.createDevice(
        ctx.bizId,
        {
          branch_id: ctx.branchId,
          product_id: ctx.productId,
          serial_number: `SN-NEW-SPARE-${Date.now()}`,
          device_type: 'ONT',
          status: 'IN_STOCK',
          sync_inventory: true
        },
        'ACTOR'
      )

      // Stock before swap: 1 (from devB in stock)
      const client = await pool.connect()
      try {
        const stockBefore = await inventoryRepository.getStock(client, ctx.bizId, ctx.branchId, ctx.productId)
        expect(stockBefore?.quantity).toBe(1)
      } finally {
        client.release()
      }

      // 3. Create REPLACEMENT work order targeting Device A
      const wo = await installationService.createWorkOrder(
        ctx.bizId,
        {
          device_id: devA.id,
          customer_id: ctx.customerId,
          service_type: 'REPLACEMENT',
          replacement_device_id: devB.id
        },
        'DISPATCHER'
      )

      // 4. Complete REPLACEMENT work order
      const completedWo = await installationService.completeWorkOrder(
        ctx.bizId,
        wo.id,
        {
          findings: 'Port LAN 1 dead',
          action_taken: 'Swapped with spare unit'
        },
        'TECHNICIAN'
      )

      expect(completedWo.status).toBe('COMPLETED')
      expect(completedWo.replacement_device_id).toBe(devB.id)

      // 5. Verify Device A is now DEFECTIVE and unassigned
      const updatedDevA = await deviceService.getDevice(ctx.bizId, devA.id)
      expect(updatedDevA.status).toBe('DEFECTIVE')
      expect(updatedDevA.customer_id).toBeNull()

      // 6. Verify Device B is now INSTALLED at Customer with Device A's address
      const updatedDevB = await deviceService.getDevice(ctx.bizId, devB.id)
      expect(updatedDevB.status).toBe('INSTALLED')
      expect(updatedDevB.customer_id).toBe(ctx.customerId)
      expect(updatedDevB.installed_address).toBe('Gedung Cyber Lt 5')

      // 7. Verify stock: Device B was consumed, so available stock = 0
      const client2 = await pool.connect()
      try {
        const stockAfter = await inventoryRepository.getStock(client2, ctx.bizId, ctx.branchId, ctx.productId)
        expect(stockAfter?.quantity).toBe(0)
      } finally {
        client2.release()
      }
    })

    it('G3-010: rejects replacement if Device B belongs to another tenant', async () => {
      const ctxA = await createTestContext('G3-RMA-TX-A')
      const ctxB = await createTestContext('G3-RMA-TX-B')

      const devA = await deviceService.createDevice(
        ctxA.bizId,
        { branch_id: ctxA.branchId, serial_number: `SN-TX-A-${Date.now()}`, device_type: 'ONT' },
        'ACTOR'
      )
      const devB = await deviceService.createDevice(
        ctxB.bizId,
        { branch_id: ctxB.branchId, serial_number: `SN-TX-B-${Date.now()}`, device_type: 'ONT' },
        'ACTOR'
      )

      // Work order creation in Biz A with replacement_device_id from Biz B -> must fail
      await expect(
        installationService.createWorkOrder(
          ctxA.bizId,
          {
            device_id: devA.id,
            service_type: 'REPLACEMENT',
            replacement_device_id: devB.id
          },
          'ACTOR'
        )
      ).rejects.toThrow(ApiError)
    })
  })
})
