import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { Pool } from 'pg'
import { createPool } from '../src/db/pool'
import { runMigrations } from '../src/db/migrate'
import path from 'path'
import { randomUUID } from 'crypto'

describe('Phase 4.1.40G-1: Hardware & Device Service Foundation (Migration 051)', () => {
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

  // Helper to create test business and branch
  async function createTestBusinessAndBranch(prefix: string) {
    const bizId = randomUUID()
    const branchId = randomUUID()
    await pool.query(
      `INSERT INTO businesses (id, name) VALUES ($1, $2)`,
      [bizId, `${prefix} Business`]
    )
    await pool.query(
      `INSERT INTO branches (id, business_id, name, status) VALUES ($1, $2, $3, TRUE)`,
      [branchId, bizId, `${prefix} Branch`]
    )
    return { bizId, branchId }
  }

  describe('1. Schema Structure & Table Verification', () => {
    it('G1-001: verifies devices table and all required columns exist', async () => {
      const res = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'devices'
        ORDER BY ordinal_position;
      `)

      const columns = res.rows.map((r) => r.column_name)
      expect(columns).toContain('id')
      expect(columns).toContain('business_id')
      expect(columns).toContain('branch_id')
      expect(columns).toContain('product_id')
      expect(columns).toContain('serial_number')
      expect(columns).toContain('mac_address')
      expect(columns).toContain('device_type')
      expect(columns).toContain('ownership_type')
      expect(columns).toContain('status')
      expect(columns).toContain('customer_id')
      expect(columns).toContain('installed_address')
      expect(columns).toContain('installed_at')
      expect(columns).toContain('warranty_months')
      expect(columns).toContain('warranty_expires_at')
      expect(columns).toContain('notes')
      expect(columns).toContain('metadata')
      expect(columns).toContain('created_at')
      expect(columns).toContain('updated_at')
    })

    it('G1-002: verifies device_services table and all required columns exist', async () => {
      const res = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'device_services'
        ORDER BY ordinal_position;
      `)

      const columns = res.rows.map((r) => r.column_name)
      expect(columns).toContain('id')
      expect(columns).toContain('business_id')
      expect(columns).toContain('device_id')
      expect(columns).toContain('customer_id')
      expect(columns).toContain('service_type')
      expect(columns).toContain('status')
      expect(columns).toContain('technician_name')
      expect(columns).toContain('scheduled_at')
      expect(columns).toContain('completed_at')
      expect(columns).toContain('replacement_device_id')
      expect(columns).toContain('findings')
      expect(columns).toContain('action_taken')
      expect(columns).toContain('notes')
      expect(columns).toContain('metadata')
      expect(columns).toContain('created_at')
      expect(columns).toContain('updated_at')
    })
  })

  describe('2. devices Table Constraints & Normalization', () => {
    it('G1-003: creates a device with valid fields and defaults', async () => {
      const { bizId, branchId } = await createTestBusinessAndBranch('DEV-CREATE')
      const serial = `SN-ONT-${Date.now()}`
      const mac = 'AA:BB:CC:11:22:33'

      const res = await pool.query(`
        INSERT INTO devices (
          business_id, branch_id, serial_number, mac_address, device_type, ownership_type, status, warranty_months, notes
        ) VALUES (
          $1, $2, $3, $4, 'ONT', 'TENANT_OWNED', 'IN_STOCK', 12, 'Test Device'
        ) RETURNING *;
      `, [bizId, branchId, serial, mac])

      expect(res.rows.length).toBe(1)
      const row = res.rows[0]
      expect(row.id).toBeDefined()
      expect(row.business_id).toBe(bizId)
      expect(row.branch_id).toBe(branchId)
      expect(row.serial_number).toBe(serial)
      expect(row.mac_address).toBe(mac)
      expect(row.device_type).toBe('ONT')
      expect(row.ownership_type).toBe('TENANT_OWNED')
      expect(row.status).toBe('IN_STOCK')
      expect(row.warranty_months).toBe(12)
      expect(row.metadata).toEqual({})
      expect(row.created_at).toBeDefined()
      expect(row.updated_at).toBeDefined()
    })

    it('G1-004: enforces unique (business_id, serial_number)', async () => {
      const { bizId, branchId } = await createTestBusinessAndBranch('DEV-DUP-SN')
      const serial = `SN-DUP-${Date.now()}`

      await pool.query(`
        INSERT INTO devices (business_id, branch_id, serial_number, device_type)
        VALUES ($1, $2, $3, 'ROUTER');
      `, [bizId, branchId, serial])

      await expect(
        pool.query(`
          INSERT INTO devices (business_id, branch_id, serial_number, device_type)
          VALUES ($1, $2, $3, 'ROUTER');
        `, [bizId, branchId, serial])
      ).rejects.toThrow(/duplicate key value violates unique constraint|uq_devices_business_serial|23505/)
    })

    it('G1-005: permits same serial_number across DIFFERENT businesses', async () => {
      const bizA = await createTestBusinessAndBranch('DEV-BIZ-A')
      const bizB = await createTestBusinessAndBranch('DEV-BIZ-B')
      const sharedSerial = `SN-SHARED-${Date.now()}`

      const resA = await pool.query(`
        INSERT INTO devices (business_id, branch_id, serial_number, device_type)
        VALUES ($1, $2, $3, 'PRINTER') RETURNING id;
      `, [bizA.bizId, bizA.branchId, sharedSerial])

      const resB = await pool.query(`
        INSERT INTO devices (business_id, branch_id, serial_number, device_type)
        VALUES ($1, $2, $3, 'PRINTER') RETURNING id;
      `, [bizB.bizId, bizB.branchId, sharedSerial])

      expect(resA.rows[0].id).toBeDefined()
      expect(resB.rows[0].id).toBeDefined()
      expect(resA.rows[0].id).not.toBe(resB.rows[0].id)
    })

    it('G1-006: enforces unique (business_id, mac_address) when MAC is present', async () => {
      const { bizId, branchId } = await createTestBusinessAndBranch('DEV-DUP-MAC')
      const mac = '11:22:33:44:55:66'

      await pool.query(`
        INSERT INTO devices (business_id, branch_id, serial_number, mac_address, device_type)
        VALUES ($1, $2, 'SN-MAC-1', $3, 'ROUTER');
      `, [bizId, branchId, mac])

      await expect(
        pool.query(`
          INSERT INTO devices (business_id, branch_id, serial_number, mac_address, device_type)
          VALUES ($1, $2, 'SN-MAC-2', $3, 'ROUTER');
        `, [bizId, branchId, mac])
      ).rejects.toThrow(/duplicate key value violates unique constraint|idx_devices_business_mac|23505/)
    })

    it('G1-007: allows multiple NULL mac_addresses in the same business', async () => {
      const { bizId, branchId } = await createTestBusinessAndBranch('DEV-NULL-MAC')

      const res1 = await pool.query(`
        INSERT INTO devices (business_id, branch_id, serial_number, mac_address, device_type)
        VALUES ($1, $2, 'SN-NULLMAC-1', NULL, 'CASH_DRAWER') RETURNING id;
      `, [bizId, branchId])

      const res2 = await pool.query(`
        INSERT INTO devices (business_id, branch_id, serial_number, mac_address, device_type)
        VALUES ($1, $2, 'SN-NULLMAC-2', NULL, 'CASH_DRAWER') RETURNING id;
      `, [bizId, branchId])

      expect(res1.rows[0].id).toBeDefined()
      expect(res2.rows[0].id).toBeDefined()
    })

    it('G1-008: rejects non-uppercase or empty serial numbers via check constraint', async () => {
      const { bizId, branchId } = await createTestBusinessAndBranch('DEV-CHK-SN')

      // Empty string serial
      await expect(
        pool.query(`
          INSERT INTO devices (business_id, branch_id, serial_number, device_type)
          VALUES ($1, $2, '', 'SCANNER');
        `, [bizId, branchId])
      ).rejects.toThrow(/violates check constraint|chk_devices_serial_normalized|23514/)

      // Whitespace-only serial
      await expect(
        pool.query(`
          INSERT INTO devices (business_id, branch_id, serial_number, device_type)
          VALUES ($1, $2, '   ', 'SCANNER');
        `, [bizId, branchId])
      ).rejects.toThrow(/violates check constraint|chk_devices_serial_normalized|23514/)

      // Lowercase serial
      await expect(
        pool.query(`
          INSERT INTO devices (business_id, branch_id, serial_number, device_type)
          VALUES ($1, $2, 'sn-lowercase-123', 'SCANNER');
        `, [bizId, branchId])
      ).rejects.toThrow(/violates check constraint|chk_devices_serial_normalized|23514/)
    })

    it('G1-009: rejects invalid MAC address format via check constraint', async () => {
      const { bizId, branchId } = await createTestBusinessAndBranch('DEV-CHK-MAC')

      // Invalid MAC format (not 12 hex chars, lowercase, bad delimiters)
      await expect(
        pool.query(`
          INSERT INTO devices (business_id, branch_id, serial_number, mac_address, device_type)
          VALUES ($1, $2, 'SN-BADMAC-1', 'aa-bb-cc-dd-ee-ff', 'ONT');
        `, [bizId, branchId])
      ).rejects.toThrow(/violates check constraint|chk_devices_mac_normalized|23514/)

      await expect(
        pool.query(`
          INSERT INTO devices (business_id, branch_id, serial_number, mac_address, device_type)
          VALUES ($1, $2, 'SN-BADMAC-2', 'INVALID_MAC_STRING', 'ONT');
        `, [bizId, branchId])
      ).rejects.toThrow(/violates check constraint|chk_devices_mac_normalized|23514/)
    })

    it('G1-010: rejects invalid device_type, ownership_type, and status enums', async () => {
      const { bizId, branchId } = await createTestBusinessAndBranch('DEV-ENUMS')

      // Invalid device_type
      await expect(
        pool.query(`
          INSERT INTO devices (business_id, branch_id, serial_number, device_type)
          VALUES ($1, $2, 'SN-TYPE-INV', 'FLYING_CAR');
        `, [bizId, branchId])
      ).rejects.toThrow(/violates check constraint|23514/)

      // Invalid ownership_type
      await expect(
        pool.query(`
          INSERT INTO devices (business_id, branch_id, serial_number, device_type, ownership_type)
          VALUES ($1, $2, 'SN-OWN-INV', 'ONT', 'ALIEN_OWNED');
        `, [bizId, branchId])
      ).rejects.toThrow(/violates check constraint|23514/)

      // Invalid status
      await expect(
        pool.query(`
          INSERT INTO devices (business_id, branch_id, serial_number, device_type, status)
          VALUES ($1, $2, 'SN-STAT-INV', 'ONT', 'TELEPORTED');
        `, [bizId, branchId])
      ).rejects.toThrow(/violates check constraint|23514/)
    })
  })

  describe('3. device_services & Composite Tenant Integrity', () => {
    it('G1-011: creates a device_service work order linked to a device in the same business', async () => {
      const { bizId, branchId } = await createTestBusinessAndBranch('SVC-CREATE')
      const devRes = await pool.query(`
        INSERT INTO devices (business_id, branch_id, serial_number, device_type)
        VALUES ($1, $2, 'SN-SVC-TARGET', 'CCTV_CAMERA') RETURNING id;
      `, [bizId, branchId])
      const deviceId = devRes.rows[0].id

      const svcRes = await pool.query(`
        INSERT INTO device_services (
          business_id, device_id, service_type, status, technician_name, notes
        ) VALUES (
          $1, $2, 'INSTALLATION', 'PENDING', 'Ahmad Technician', 'Initial CCTV setup'
        ) RETURNING *;
      `, [bizId, deviceId])

      expect(svcRes.rows.length).toBe(1)
      const row = svcRes.rows[0]
      expect(row.id).toBeDefined()
      expect(row.business_id).toBe(bizId)
      expect(row.device_id).toBe(deviceId)
      expect(row.service_type).toBe('INSTALLATION')
      expect(row.status).toBe('PENDING')
      expect(row.technician_name).toBe('Ahmad Technician')
      expect(row.created_at).toBeDefined()
      expect(row.updated_at).toBeDefined()
    })

    it('G1-012: PREVENTS cross-tenant device reference via composite foreign key', async () => {
      const bizA = await createTestBusinessAndBranch('SVC-BIZ-A')
      const bizB = await createTestBusinessAndBranch('SVC-BIZ-B')

      // Device belongs to Biz A
      const devRes = await pool.query(`
        INSERT INTO devices (business_id, branch_id, serial_number, device_type)
        VALUES ($1, $2, 'SN-BIZ-A-DEV', 'ROUTER') RETURNING id;
      `, [bizA.bizId, bizA.branchId])
      const deviceIdA = devRes.rows[0].id

      // Attempt to create work order in Biz B referencing device in Biz A -> MUST FAIL
      await expect(
        pool.query(`
          INSERT INTO device_services (business_id, device_id, service_type)
          VALUES ($1, $2, 'REPAIR');
        `, [bizB.bizId, deviceIdA])
      ).rejects.toThrow(/violates foreign key constraint|fk_device_services_device|23503/)
    })

    it('G1-013: PREVENTS cross-tenant replacement_device_id reference via composite foreign key', async () => {
      const bizA = await createTestBusinessAndBranch('RMA-BIZ-A')
      const bizB = await createTestBusinessAndBranch('RMA-BIZ-B')

      // Device A in Biz A
      const devA = await pool.query(`
        INSERT INTO devices (business_id, branch_id, serial_number, device_type)
        VALUES ($1, $2, 'SN-DEFECTIVE-A', 'ONT') RETURNING id;
      `, [bizA.bizId, bizA.branchId])
      const deviceIdA = devA.rows[0].id

      // Replacement Device B in Biz B
      const devB = await pool.query(`
        INSERT INTO devices (business_id, branch_id, serial_number, device_type)
        VALUES ($1, $2, 'SN-SPARE-B', 'ONT') RETURNING id;
      `, [bizB.bizId, bizB.branchId])
      const deviceIdB = devB.rows[0].id

      // Attempt to create service in Biz A with replacement_device_id from Biz B -> MUST FAIL
      await expect(
        pool.query(`
          INSERT INTO device_services (business_id, device_id, service_type, replacement_device_id)
          VALUES ($1, $2, 'REPLACEMENT', $3);
        `, [bizA.bizId, deviceIdA, deviceIdB])
      ).rejects.toThrow(/violates foreign key constraint|fk_device_services_replacement_device|23503/)
    })

    it('G1-014: allows replacement_device_id when both devices belong to the SAME business', async () => {
      const { bizId, branchId } = await createTestBusinessAndBranch('RMA-SAME-BIZ')

      const devA = await pool.query(`
        INSERT INTO devices (business_id, branch_id, serial_number, device_type)
        VALUES ($1, $2, 'SN-RMA-OLD', 'ONT') RETURNING id;
      `, [bizId, branchId])
      const deviceIdA = devA.rows[0].id

      const devB = await pool.query(`
        INSERT INTO devices (business_id, branch_id, serial_number, device_type)
        VALUES ($1, $2, 'SN-RMA-NEW', 'ONT') RETURNING id;
      `, [bizId, branchId])
      const deviceIdB = devB.rows[0].id

      const svcRes = await pool.query(`
        INSERT INTO device_services (business_id, device_id, service_type, status, replacement_device_id)
        VALUES ($1, $2, 'REPLACEMENT', 'COMPLETED', $3) RETURNING *;
      `, [bizId, deviceIdA, deviceIdB])

      expect(svcRes.rows.length).toBe(1)
      expect(svcRes.rows[0].replacement_device_id).toBe(deviceIdB)
    })

    it('G1-015: rejects invalid service_type and status values on device_services', async () => {
      const { bizId, branchId } = await createTestBusinessAndBranch('SVC-INV-ENUMS')
      const devRes = await pool.query(`
        INSERT INTO devices (business_id, branch_id, serial_number, device_type)
        VALUES ($1, $2, 'SN-SVC-ENUM-TEST', 'DVR_NVR') RETURNING id;
      `, [bizId, branchId])
      const deviceId = devRes.rows[0].id

      // Invalid service_type
      await expect(
        pool.query(`
          INSERT INTO device_services (business_id, device_id, service_type)
          VALUES ($1, $2, 'MAGIC_UPGRADE');
        `, [bizId, deviceId])
      ).rejects.toThrow(/violates check constraint|23514/)

      // Invalid status
      await expect(
        pool.query(`
          INSERT INTO device_services (business_id, device_id, service_type, status)
          VALUES ($1, $2, 'MAINTENANCE', 'FLOATING');
        `, [bizId, deviceId])
      ).rejects.toThrow(/violates check constraint|23514/)
    })
  })
})
