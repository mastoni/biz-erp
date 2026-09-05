import { describe, expect, it } from 'vitest'
import { randomUUID } from 'crypto'
import { ValidationError } from '../src/errors/validation_error'
import {
  normalizeSerialNumber,
  normalizeMacAddress,
  validateCreateDevice,
  validateBulkCreateDevice,
  validateUpdateDevice,
  validateAssignDevice,
  validateUnassignDevice,
  validateDeviceQuery,
  VALID_DEVICE_TYPES,
  VALID_DEVICE_OWNERSHIP_TYPES,
  VALID_DEVICE_STATUSES
} from '../src/dto/device_dto'
import {
  validateCreateDeviceService,
  validateUpdateDeviceService,
  validateCompleteDeviceService,
  validateDeviceServiceQuery,
  VALID_DEVICE_SERVICE_TYPES,
  VALID_DEVICE_SERVICE_STATUSES
} from '../src/dto/device_service_dto'

describe('Phase 4.1.40G-2: Hardware & Device Service DTO & Validation Contracts', () => {
  const sampleBranchId = randomUUID()
  const sampleProductId = randomUUID()
  const sampleCustomerId = randomUUID()
  const sampleDeviceId = randomUUID()
  const sampleReplacementDeviceId = randomUUID()

  describe('1. Serial Number Normalization & Validation', () => {
    it('G2-001: trims whitespace and converts serial to uppercase', () => {
      expect(normalizeSerialNumber('  sn-zte-12345  ')).toBe('SN-ZTE-12345')
      expect(normalizeSerialNumber('abcde')).toBe('ABCDE')
    })

    it('G2-002: rejects empty or whitespace-only serial number', () => {
      expect(() => normalizeSerialNumber('')).toThrow(ValidationError)
      expect(() => normalizeSerialNumber('   ')).toThrow(ValidationError)
    })

    it('G2-003: rejects non-string serial numbers', () => {
      expect(() => normalizeSerialNumber(null)).toThrow(ValidationError)
      expect(() => normalizeSerialNumber(12345)).toThrow(ValidationError)
      expect(() => normalizeSerialNumber({})).toThrow(ValidationError)
    })
  })

  describe('2. MAC Address Normalization & Validation', () => {
    it('G2-004: accepts and normalizes valid colon-separated MAC address', () => {
      expect(normalizeMacAddress('aa:bb:cc:dd:ee:ff')).toBe('AA:BB:CC:DD:EE:FF')
      expect(normalizeMacAddress('00:1A:2B:3C:4D:5E')).toBe('00:1A:2B:3C:4D:5E')
    })

    it('G2-005: accepts and normalizes valid hyphen-separated MAC address', () => {
      expect(normalizeMacAddress('aa-bb-cc-dd-ee-ff')).toBe('AA:BB:CC:DD:EE:FF')
      expect(normalizeMacAddress('11-22-33-44-55-66')).toBe('11:22:33:44:55:66')
    })

    it('G2-006: accepts and normalizes raw 12-hex-character string without separators', () => {
      expect(normalizeMacAddress('aabbccddeeff')).toBe('AA:BB:CC:DD:EE:FF')
      expect(normalizeMacAddress('AABBCCDDEEFF')).toBe('AA:BB:CC:DD:EE:FF')
    })

    it('G2-007: returns null for null, undefined, or empty string MAC address', () => {
      expect(normalizeMacAddress(null)).toBeNull()
      expect(normalizeMacAddress(undefined)).toBeNull()
      expect(normalizeMacAddress('')).toBeNull()
      expect(normalizeMacAddress('   ')).toBeNull()
    })

    it('G2-008: rejects invalid MAC address length and non-hex characters', () => {
      expect(() => normalizeMacAddress('invalid_mac')).toThrow(ValidationError)
      expect(() => normalizeMacAddress('AA:BB:CC:DD:EE')).toThrow(ValidationError) // 10 hex
      expect(() => normalizeMacAddress('AA:BB:CC:DD:EE:FF:00')).toThrow(ValidationError) // 14 hex
      expect(() => normalizeMacAddress('GG:HH:II:JJ:KK:LL')).toThrow(ValidationError) // non-hex
      expect(() => normalizeMacAddress(123456789012)).toThrow(ValidationError)
    })
  })

  describe('3. Create Device Validation', () => {
    it('G2-009: validates valid create-device payload with all optional fields', () => {
      const payload = {
        branch_id: sampleBranchId,
        product_id: sampleProductId,
        serial_number: '  sn-ont-9988  ',
        mac_address: 'aa-bb-cc-11-22-33',
        device_type: 'ONT',
        ownership_type: 'LEASED_RENTED',
        status: 'IN_STOCK',
        customer_id: sampleCustomerId,
        installed_address: 'Jl. Melati No. 10',
        installed_at: '2026-09-05T10:00:00.000Z',
        warranty_months: 24,
        warranty_expires_at: '2028-09-05',
        notes: 'VIP customer unit',
        metadata: { optical_power: -18.5, vlan: 100 },
        sync_inventory: true
      }

      const validated = validateCreateDevice(payload)
      expect(validated.branch_id).toBe(sampleBranchId)
      expect(validated.product_id).toBe(sampleProductId)
      expect(validated.serial_number).toBe('SN-ONT-9988')
      expect(validated.mac_address).toBe('AA:BB:CC:11:22:33')
      expect(validated.device_type).toBe('ONT')
      expect(validated.ownership_type).toBe('LEASED_RENTED')
      expect(validated.status).toBe('IN_STOCK')
      expect(validated.customer_id).toBe(sampleCustomerId)
      expect(validated.installed_address).toBe('Jl. Melati No. 10')
      expect(validated.installed_at).toBe('2026-09-05T10:00:00.000Z')
      expect(validated.warranty_months).toBe(24)
      expect(validated.warranty_expires_at).toBe('2028-09-05')
      expect(validated.notes).toBe('VIP customer unit')
      expect(validated.metadata).toEqual({ optical_power: -18.5, vlan: 100 })
      expect(validated.sync_inventory).toBe(true)
    })

    it('G2-010: applies correct defaults for minimal valid create-device payload', () => {
      const payload = {
        branch_id: sampleBranchId,
        serial_number: 'SN-BASIC-01',
        device_type: 'PRINTER'
      }

      const validated = validateCreateDevice(payload)
      expect(validated.branch_id).toBe(sampleBranchId)
      expect(validated.serial_number).toBe('SN-BASIC-01')
      expect(validated.device_type).toBe('PRINTER')
      expect(validated.ownership_type).toBe('TENANT_OWNED')
      expect(validated.status).toBe('IN_STOCK')
      expect(validated.warranty_months).toBe(12)
      expect(validated.mac_address).toBeNull()
      expect(validated.sync_inventory).toBe(false)
    })

    it('G2-011: rejects invalid UUID for branch_id, product_id, or customer_id', () => {
      expect(() => validateCreateDevice({ branch_id: 'not-a-uuid', serial_number: 'SN1', device_type: 'ONT' })).toThrow(ValidationError)
      expect(() => validateCreateDevice({ branch_id: sampleBranchId, product_id: 'bad-product-id', serial_number: 'SN1', device_type: 'ONT' })).toThrow(ValidationError)
      expect(() => validateCreateDevice({ branch_id: sampleBranchId, customer_id: 'bad-customer-id', serial_number: 'SN1', device_type: 'ONT' })).toThrow(ValidationError)
    })

    it('G2-012: rejects invalid device_type, ownership_type, and status', () => {
      expect(() => validateCreateDevice({ branch_id: sampleBranchId, serial_number: 'SN1', device_type: 'INVALID_TYPE' })).toThrow(ValidationError)
      expect(() => validateCreateDevice({ branch_id: sampleBranchId, serial_number: 'SN1', device_type: 'ONT', ownership_type: 'UNKNOWN' })).toThrow(ValidationError)
      expect(() => validateCreateDevice({ branch_id: sampleBranchId, serial_number: 'SN1', device_type: 'ONT', status: 'FLYING' })).toThrow(ValidationError)
    })

    it('G2-013: rejects negative warranty_months, invalid dates, and invalid metadata shapes', () => {
      expect(() => validateCreateDevice({ branch_id: sampleBranchId, serial_number: 'SN1', device_type: 'ONT', warranty_months: -5 })).toThrow(ValidationError)
      expect(() => validateCreateDevice({ branch_id: sampleBranchId, serial_number: 'SN1', device_type: 'ONT', warranty_months: 1.5 })).toThrow(ValidationError)
      expect(() => validateCreateDevice({ branch_id: sampleBranchId, serial_number: 'SN1', device_type: 'ONT', warranty_expires_at: 'invalid-date' })).toThrow(ValidationError)
      expect(() => validateCreateDevice({ branch_id: sampleBranchId, serial_number: 'SN1', device_type: 'ONT', installed_at: 'not-iso-date' })).toThrow(ValidationError)
      expect(() => validateCreateDevice({ branch_id: sampleBranchId, serial_number: 'SN1', device_type: 'ONT', metadata: 'string-not-object' })).toThrow(ValidationError)
      expect(() => validateCreateDevice({ branch_id: sampleBranchId, serial_number: 'SN1', device_type: 'ONT', metadata: [1, 2, 3] })).toThrow(ValidationError)
    })
  })

  describe('4. Bulk Create Device Validation', () => {
    it('G2-014: validates bulk create payload with normalized serials and MACs', () => {
      const payload = {
        branch_id: sampleBranchId,
        device_type: 'ROUTER',
        product_id: sampleProductId,
        sync_inventory: true,
        items: [
          { serial_number: '  sn-r1  ', mac_address: '112233445566', notes: 'Unit 1' },
          { serial_number: 'sn-r2', mac_address: 'aa:bb:cc:dd:ee:01' }
        ]
      }

      const validated = validateBulkCreateDevice(payload)
      expect(validated.branch_id).toBe(sampleBranchId)
      expect(validated.device_type).toBe('ROUTER')
      expect(validated.sync_inventory).toBe(true)
      expect(validated.items.length).toBe(2)
      expect(validated.items[0].serial_number).toBe('SN-R1')
      expect(validated.items[0].mac_address).toBe('11:22:33:44:55:66')
      expect(validated.items[1].serial_number).toBe('SN-R2')
      expect(validated.items[1].mac_address).toBe('AA:BB:CC:DD:EE:01')
    })

    it('G2-015: rejects empty items array or batch containing duplicate serials', () => {
      expect(() => validateBulkCreateDevice({ branch_id: sampleBranchId, device_type: 'ROUTER', items: [] })).toThrow(ValidationError)
      expect(() =>
        validateBulkCreateDevice({
          branch_id: sampleBranchId,
          device_type: 'ROUTER',
          items: [{ serial_number: 'SN-DUP' }, { serial_number: 'sn-dup' }]
        })
      ).toThrow(ValidationError)
    })
  })

  describe('5. Update, Assign, and Unassign Device Validation', () => {
    it('G2-016: validates partial update payload', () => {
      const payload = {
        notes: 'Updated notes',
        mac_address: 'ff-ee-dd-cc-bb-aa',
        ownership_type: 'CUSTOMER_OWNED',
        warranty_months: 36,
        metadata: { firmware: 'v2.1.0' }
      }

      const validated = validateUpdateDevice(payload)
      expect(validated.notes).toBe('Updated notes')
      expect(validated.mac_address).toBe('FF:EE:DD:CC:BB:AA')
      expect(validated.ownership_type).toBe('CUSTOMER_OWNED')
      expect(validated.warranty_months).toBe(36)
      expect(validated.metadata).toEqual({ firmware: 'v2.1.0' })
    })

    it('G2-017: validates assign payload with valid customer UUID', () => {
      const payload = {
        customer_id: sampleCustomerId,
        installed_address: 'Tower Site 3',
        installed_at: '2026-09-05T12:00:00.000Z'
      }

      const validated = validateAssignDevice(payload)
      expect(validated.customer_id).toBe(sampleCustomerId)
      expect(validated.installed_address).toBe('Tower Site 3')
      expect(validated.installed_at).toBe('2026-09-05T12:00:00.000Z')
    })

    it('G2-018: validates unassign payload with return status', () => {
      const validated = validateUnassignDevice({ return_status: 'DEFECTIVE', notes: 'Lightning strike damage' })
      expect(validated.return_status).toBe('DEFECTIVE')
      expect(validated.notes).toBe('Lightning strike damage')

      const defaultValidated = validateUnassignDevice({})
      expect(defaultValidated.return_status).toBe('IN_STOCK')
    })
  })

  describe('6. Device Query Filter Validation', () => {
    it('G2-019: validates valid pagination and filters', () => {
      const query = {
        branch_id: sampleBranchId,
        device_type: 'CCTV_CAMERA',
        status: 'INSTALLED',
        limit: '25',
        offset: '50',
        search: 'SN-CAM'
      }

      const validated = validateDeviceQuery(query)
      expect(validated.branch_id).toBe(sampleBranchId)
      expect(validated.device_type).toBe('CCTV_CAMERA')
      expect(validated.status).toBe('INSTALLED')
      expect(validated.limit).toBe(25)
      expect(validated.offset).toBe(50)
      expect(validated.search).toBe('SN-CAM')
    })

    it('G2-020: rejects invalid limit, offset, or enum filters', () => {
      expect(() => validateDeviceQuery({ limit: '0' })).toThrow(ValidationError)
      expect(() => validateDeviceQuery({ limit: '1000' })).toThrow(ValidationError)
      expect(() => validateDeviceQuery({ offset: '-1' })).toThrow(ValidationError)
      expect(() => validateDeviceQuery({ status: 'INVALID_STATUS' })).toThrow(ValidationError)
    })
  })

  describe('7. Device Service (Work Order) Validation', () => {
    it('G2-021: validates valid create-service work order payload', () => {
      const payload = {
        device_id: sampleDeviceId,
        customer_id: sampleCustomerId,
        service_type: 'INSTALLATION',
        technician_name: 'Budi Teknisi',
        scheduled_at: '2026-09-06T09:00:00.000Z',
        notes: 'New home fiber installation',
        metadata: { fiber_core: 4 }
      }

      const validated = validateCreateDeviceService(payload)
      expect(validated.device_id).toBe(sampleDeviceId)
      expect(validated.customer_id).toBe(sampleCustomerId)
      expect(validated.service_type).toBe('INSTALLATION')
      expect(validated.status).toBe('PENDING')
      expect(validated.technician_name).toBe('Budi Teknisi')
      expect(validated.scheduled_at).toBe('2026-09-06T09:00:00.000Z')
      expect(validated.notes).toBe('New home fiber installation')
      expect(validated.metadata).toEqual({ fiber_core: 4 })
    })

    it('G2-022: rejects invalid service_type or status in create-service payload', () => {
      expect(() => validateCreateDeviceService({ device_id: sampleDeviceId, service_type: 'TELEPORTATION' })).toThrow(ValidationError)
      expect(() => validateCreateDeviceService({ device_id: sampleDeviceId, service_type: 'REPAIR', status: 'EXPLODED' })).toThrow(ValidationError)
      expect(() => validateCreateDeviceService({ device_id: 'invalid-device-uuid', service_type: 'REPAIR' })).toThrow(ValidationError)
    })

    it('G2-023: validates update-service work order payload', () => {
      const payload = {
        status: 'IN_PROGRESS',
        technician_name: 'Doni Repairman',
        findings: 'Optical connector dirty'
      }

      const validated = validateUpdateDeviceService(payload)
      expect(validated.status).toBe('IN_PROGRESS')
      expect(validated.technician_name).toBe('Doni Repairman')
      expect(validated.findings).toBe('Optical connector dirty')
    })

    it('G2-024: validates complete-service payload with replacement_device_id', () => {
      const payload = {
        action_taken: 'Replaced faulty power adapter and swapped unit',
        replacement_device_id: sampleReplacementDeviceId,
        notes: 'Customer satisfied'
      }

      const validated = validateCompleteDeviceService(payload, 'REPLACEMENT')
      expect(validated.action_taken).toBe('Replaced faulty power adapter and swapped unit')
      expect(validated.replacement_device_id).toBe(sampleReplacementDeviceId)
      expect(validated.notes).toBe('Customer satisfied')
    })

    it('G2-025: requires replacement_device_id when completing a REPLACEMENT work order', () => {
      expect(() => validateCompleteDeviceService({ action_taken: 'Swapped' }, 'REPLACEMENT')).toThrow(ValidationError)
    })

    it('G2-026: validates device-service query filters and pagination', () => {
      const query = {
        device_id: sampleDeviceId,
        service_type: 'REPAIR',
        status: 'COMPLETED',
        technician_name: 'Budi',
        limit: '10',
        offset: '0'
      }

      const validated = validateDeviceServiceQuery(query)
      expect(validated.device_id).toBe(sampleDeviceId)
      expect(validated.service_type).toBe('REPAIR')
      expect(validated.status).toBe('COMPLETED')
      expect(validated.technician_name).toBe('Budi')
      expect(validated.limit).toBe(10)
      expect(validated.offset).toBe(0)
    })
  })
})
