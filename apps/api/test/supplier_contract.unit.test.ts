/**
 * Phase 9A — Supplier Contract & Backend Foundation Test Suite
 * SUPPLIER-CONTRACT-001 through SUPPLIER-CONTRACT-022
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validateSupplierCreate,
  validateSupplierUpdate,
  isValidSupplierTerm,
  isValidSupplierStatus,
  VALID_SUPPLIER_TERMS,
  VALID_SUPPLIER_STATUSES,
  generateSupplierCode,
} from '../src/dto/supplier_dto'
import { createSupplierService } from '../src/services/supplier_service'
import { supplierRepository } from '../src/repositories/supplier_repository'
import { ValidationError } from '../src/errors/validation_error'
import { ApiError } from '../src/errors/api_error'
import { ConflictError } from '../src/errors/conflict_error'

describe('PHASE 9A — Suppliers Contract & Backend Foundation Tests', () => {
  const businessId = '11111111-1111-4111-8111-111111111111'
  const foreignBusinessId = '22222222-2222-4222-8222-222222222222'
  const supplierId = '33333333-3333-4333-8333-333333333333'
  const idempotencyKey = '44444444-4444-4444-8444-444444444444'

  let mockClient: any
  let mockPool: any
  let queryHistory: Array<{ text: string; params?: any[] }>

  beforeEach(() => {
    queryHistory = []
    mockClient = {
      query: vi.fn(async (text: string, params?: any[]) => {
        queryHistory.push({ text, params })

        if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
          return { rows: [] }
        }

        // Idempotency lookup
        if (text.includes('idempotency_keys') && text.includes('SELECT')) {
          return { rows: [] }
        }

        // Supplier findById / duplicate check
        if (text.includes('WHERE id = $1') || text.includes('WHERE s.id = $1') || text.includes('WHERE suppliers.id = $1')) {
          return { rows: [] }
        }

        // Supplier code lookup
        if (text.includes('WHERE code = $2') || text.includes('AND code = $2')) {
          return { rows: [] }
        }

        // Supplier insert
        if (text.includes('INSERT INTO suppliers')) {
          return {
            rows: [{
              id: params?.[0] || supplierId,
              business_id: params?.[1] || businessId,
              code: params?.[2] || 'UMS',
              name: params?.[3] || 'Test Supplier',
              contact: params?.[4] || null,
              phone: params?.[5] || null,
              email: params?.[6] || null,
              category: params?.[7] || null,
              term: params?.[8] || 'Tunai',
              status: params?.[9] || 'aktif',
              server_version: 1,
              created_at: new Date('2026-08-20T10:00:00Z'),
              updated_at: new Date('2026-08-20T10:00:00Z'),
              deleted_at: null,
            }]
          }
        }

        // Supplier summary
        if (text.includes('COUNT(*)') && text.includes('total_suppliers')) {
          return { rows: [{ total_suppliers: 8, active_suppliers: 7, inactive_suppliers: 1 }] }
        }

        // Supplier count for list
        if (text.includes('SELECT COUNT(*)::int AS total') && text.includes('suppliers')) {
          return { rows: [{ total: 2 }] }
        }

        // Supplier list query
        if (text.includes('FROM suppliers') && text.includes('server_version')) {
          return {
            rows: [
              {
                id: 'sup-001',
                business_id: businessId,
                code: 'UMS',
                name: 'UD Makmur Sembako',
                contact: 'Pak Darmawan',
                phone: '0812-2745-9012',
                email: 'order@makmur.id',
                category: 'Sembako',
                term: 'Tempo 14',
                status: 'aktif',
                server_version: 1,
                created_at: new Date('2026-08-20T10:00:00Z'),
                updated_at: new Date('2026-08-20T10:00:00Z'),
                deleted_at: null,
              },
              {
                id: 'sup-002',
                business_id: businessId,
                code: 'TRK',
                name: 'CV Tirta Kencana',
                contact: 'Bu Santi',
                phone: '0813-9021-4478',
                email: 'sales@tirtakencana.co.id',
                category: 'Minuman',
                term: 'Tunai',
                status: 'aktif',
                server_version: 1,
                created_at: new Date('2026-08-21T10:00:00Z'),
                updated_at: new Date('2026-08-21T10:00:00Z'),
                deleted_at: null,
              },
            ]
          }
        }

        // Supplier update
        if (text.includes('UPDATE suppliers')) {
          return {
            rows: [{
              id: supplierId,
              business_id: businessId,
              code: 'UMS',
              name: 'Updated Name',
              contact: null,
              phone: null,
              email: null,
              category: null,
              term: 'Tunai',
              status: 'aktif',
              server_version: 2,
              created_at: new Date('2026-08-20T10:00:00Z'),
              updated_at: new Date('2026-08-20T10:00:00Z'),
              deleted_at: null,
            }]
          }
        }

        // Supplier soft delete
        if (text.includes('UPDATE suppliers') && text.includes('deleted_at = now()')) {
          return {
            rows: [{
              id: supplierId,
              business_id: businessId,
              code: 'UMS',
              name: 'Test Supplier',
              contact: null,
              phone: null,
              email: null,
              category: null,
              term: 'Tunai',
              status: 'nonaktif',
              server_version: 2,
              created_at: new Date('2026-08-20T10:00:00Z'),
              updated_at: new Date('2026-08-20T10:00:00Z'),
              deleted_at: new Date('2026-08-20T10:00:00Z'),
            }]
          }
          return { rows: [] }
        }

        // Idempotency insert
        if (text.includes('INSERT INTO idempotency_keys')) {
          return { rowCount: 1 }
        }

        return { rows: [] }
      }),
      release: vi.fn(),
      begin: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
    }

    mockPool = {
      connect: vi.fn(async () => mockClient),
    }
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-001: Valid create validates cleanly
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-001 valid create validates cleanly', () => {
    const result = validateSupplierCreate({
      id: supplierId,
      business_id: businessId,
      name: 'UD Makmur Sembako',
      contact: 'Pak Darmawan',
      phone: '0812-2745-9012',
      email: 'order@makmur.id',
      category: 'Sembako',
      term: 'Tunai',
      status: 'aktif',
    })

    expect(result.name).toBe('UD Makmur Sembako')
    expect(result.term).toBe('Tunai')
    expect(result.status).toBe('aktif')
    expect(result.contact).toBe('Pak Darmawan')
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-002: Nullables default to null
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-002 nullable fields default to null', () => {
    const result = validateSupplierCreate({
      id: supplierId,
      business_id: businessId,
      name: 'Test Supplier',
    })

    expect(result.contact).toBeNull()
    expect(result.phone).toBeNull()
    expect(result.email).toBeNull()
    expect(result.category).toBeNull()
    expect(result.term).toBe('Tunai')
    expect(result.status).toBe('aktif')
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-003: term defaults to Tunai
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-003 term defaults to Tunai', () => {
    const result = validateSupplierCreate({
      id: supplierId,
      business_id: businessId,
      name: 'Test Supplier',
    })

    expect(result.term).toBe('Tunai')
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-004: status defaults to aktif
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-004 status defaults to aktif', () => {
    const result = validateSupplierCreate({
      id: supplierId,
      business_id: businessId,
      name: 'Test Supplier',
    })

    expect(result.status).toBe('aktif')
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-005: missing id rejected
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-005 missing id returns 400', () => {
    expect(() =>
      validateSupplierCreate({
        business_id: businessId,
        name: 'Test Supplier',
      })
    ).toThrow(ValidationError)
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-006: invalid id rejected
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-006 non-UUID id rejected', () => {
    expect(() =>
      validateSupplierCreate({
        id: 'not-a-uuid',
        business_id: businessId,
        name: 'Test Supplier',
      })
    ).toThrow(ValidationError)
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-007: missing business_id rejected
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-007 missing business_id returns 400', () => {
    expect(() =>
      validateSupplierCreate({
        id: supplierId,
        name: 'Test Supplier',
      })
    ).toThrow(ValidationError)
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-008: missing name rejected
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-008 missing name returns 400', () => {
    expect(() =>
      validateSupplierCreate({
        id: supplierId,
        business_id: businessId,
      })
    ).toThrow(ValidationError)
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-009: invalid email rejected
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-009 invalid email rejected', () => {
    expect(() =>
      validateSupplierCreate({
        id: supplierId,
        business_id: businessId,
        name: 'Test Supplier',
        email: 'not-an-email',
      })
    ).toThrow(ValidationError)
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-010: invalid term rejected
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-010 invalid term rejected', () => {
    expect(() =>
      validateSupplierCreate({
        id: supplierId,
        business_id: businessId,
        name: 'Test Supplier',
        term: 'COD',
      })
    ).toThrow(ValidationError)
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-011: invalid status rejected
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-011 invalid status rejected', () => {
    expect(() =>
      validateSupplierCreate({
        id: supplierId,
        business_id: businessId,
        name: 'Test Supplier',
        status: 'pending',
      })
    ).toThrow(ValidationError)
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-012: VALID_SUPPLIER_TERMS contains expected values
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-012 valid terms are Tunai, Tempo 14, Tempo 30', () => {
    expect(VALID_SUPPLIER_TERMS).toEqual(['Tunai', 'Tempo 14', 'Tempo 30'])
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-013: VALID_SUPPLIER_STATUSES contains expected values
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-013 valid statuses are aktif, nonaktif', () => {
    expect(VALID_SUPPLIER_STATUSES).toEqual(['aktif', 'nonaktif'])
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-014: isValidSupplierTerm checks enum correctly
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-014 supplier term validation function', () => {
    expect(isValidSupplierTerm('Tunai')).toBe(true)
    expect(isValidSupplierTerm('Tempo 14')).toBe(true)
    expect(isValidSupplierTerm('Tempo 30')).toBe(true)
    expect(isValidSupplierTerm('COD')).toBe(false)
    expect(isValidSupplierTerm(null)).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-015: isValidSupplierStatus checks enum correctly
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-015 supplier status validation function', () => {
    expect(isValidSupplierStatus('aktif')).toBe(true)
    expect(isValidSupplierStatus('nonaktif')).toBe(true)
    expect(isValidSupplierStatus('pending')).toBe(false)
    expect(isValidSupplierStatus(null)).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-016: update validation requires expected_server_version
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-016 update requires expected_server_version', () => {
    expect(() =>
      validateSupplierUpdate({
        business_id: businessId,
        expected_server_version: 0,
      })
    ).toThrow(ValidationError)
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-017: update requires at least one field
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-017 update requires at least one patch field', () => {
    expect(() =>
      validateSupplierUpdate({
        business_id: businessId,
        expected_server_version: 1,
      })
    ).toThrow(ValidationError)
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-018: P0 contract does NOT expose balance/rating/lastOrder
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-018 supplier DTO omits balance/rating/lastOrder', () => {
    const result = validateSupplierCreate({
      id: supplierId,
      business_id: businessId,
      name: 'Test Supplier',
    })

    // The create request type does not include balance/rating/lastOrder
    expect(result).not.toHaveProperty('balance')
    expect(result).not.toHaveProperty('rating')
    expect(result).not.toHaveProperty('lastOrder')
    expect(result).not.toHaveProperty('last_order')
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-019: tenant mismatch returns 403 BUSINESS_ACCESS_DENIED
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-019 tenant mismatch throws 403 BUSINESS_ACCESS_DENIED', () => {
    const service = createSupplierService(mockPool)

    expect(() =>
      service.list({ business_id: foreignBusinessId }, businessId)
    ).rejects.toThrow(ApiError)

    expect(() =>
      service.list({ business_id: foreignBusinessId }, businessId)
    ).rejects.toMatchObject({ code: 'BUSINESS_ACCESS_DENIED' })
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-020: service create generates deterministic code
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-020 code generated from name via generateSupplierCode', () => {
    expect(generateSupplierCode('UD Makmur Sembako')).toBe('UMS')
    expect(generateSupplierCode('CV Tirta Kencana')).toBe('CTK')
    expect(generateSupplierCode('PT Snack Nusantara')).toBe('PSN')
    expect(generateSupplierCode('UD Berkah Farm')).toBe('UBF')
    expect(generateSupplierCode('Singleword')).toBe('S')
    expect(generateSupplierCode('')).toBe('')
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-021: business_id validation on list
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-021 invalid business_id on list returns 400', () => {
    const service = createSupplierService(mockPool)

    expect(() =>
      service.list({ business_id: 'not-a-uuid' }, businessId)
    ).rejects.toThrow(ValidationError)
  })

  // ---------------------------------------------------------------------------
  // SUPPLIER-CONTRACT-022: empty string fields normalized to null
  // ---------------------------------------------------------------------------
  it('SUPPLIER-CONTRACT-022 empty strings normalized to null on create', () => {
    const result = validateSupplierCreate({
      id: supplierId,
      business_id: businessId,
      name: 'Test Supplier',
      contact: '',
      phone: '',
      email: '',
      category: '',
    })

    expect(result.contact).toBeNull()
    expect(result.phone).toBeNull()
    expect(result.email).toBeNull()
    expect(result.category).toBeNull()
  })
})
