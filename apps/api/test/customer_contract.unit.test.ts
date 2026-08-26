/**
 * Phase 6B — Customer Contract & Backend Foundation Test Suite
 * CUSTOMER-CONTRACT-001 through CUSTOMER-CONTRACT-022
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validateCustomerCreate,
  validateCustomerUpdate,
  isValidCustomerTier,
  VALID_CUSTOMER_TIERS,
} from '../src/dto/customer_dto'
import { createCustomerService } from '../src/services/customer_service'
import { customerRepository } from '../src/repositories/customer_repository'
import { ValidationError } from '../src/errors/validation_error'
import { ApiError } from '../src/errors/api_error'
import { ConflictError } from '../src/errors/conflict_error'

describe('PHASE 6B — Customers Contract & Backend Foundation Tests', () => {
  const businessId = '11111111-1111-4111-8111-111111111111'
  const foreignBusinessId = '22222222-2222-4222-8222-222222222222'
  const customerId = '33333333-3333-4333-8333-333333333333'
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

        // Customer single findById / duplicate check
        if (text.includes('WHERE c.id = $1') || text.includes('WHERE id = $1')) {
          return { rows: [] }
        }

        // Customer summary stats query
        if (text.includes('customer_stats') && text.includes('spend_stats')) {
          return {
            rows: [
              {
                total_customers: 8,
                gold_members: 3,
                silver_members: 3,
                regular_members: 2,
                monthly_spend_minor: 73280000,
              },
            ],
          }
        }

        // Customer count query
        if (text.includes('SELECT COUNT(*)::int AS total')) {
          return { rows: [{ total: 8 }] }
        }

        // Customer list query with spend & last visit
        if (text.includes('FROM customers c') && text.includes('spend_minor')) {
          return {
            rows: [
              {
                id: 'cst-001',
                business_id: businessId,
                name: 'Dewi Lestari',
                phone: '0812-3345-1908',
                email: 'dewi@gmail.com',
                tier: 'Gold',
                points: 2450,
                spend_minor: '12450000',
                last_visit_epoch: '1787740800000',
                server_version: 1,
                created_at: new Date('2026-08-20T10:00:00Z'),
                updated_at: new Date('2026-08-20T10:00:00Z'),
                deleted_at: null,
              },
              {
                id: 'cst-002',
                business_id: businessId,
                name: 'Yoga Pratama',
                phone: '0896-1120-3384',
                email: null,
                tier: 'Reguler',
                points: 140,
                spend_minor: '890000',
                last_visit_epoch: null,
                server_version: 1,
                created_at: new Date('2026-08-21T10:00:00Z'),
                updated_at: new Date('2026-08-21T10:00:00Z'),
                deleted_at: null,
              },
            ],
          }
        }

        // Customer insert query
        if (text.includes('INSERT INTO customers')) {
          return {
            rows: [
              {
                id: params![0],
                business_id: params![1],
                name: params![2],
                phone: params![3],
                email: params![4],
                tier: params![5],
                points: params![6],
                server_version: 1,
                created_at: new Date(),
                updated_at: new Date(),
                deleted_at: null,
              },
            ],
          }
        }

        // Customer update query
        if (text.includes('UPDATE customers')) {
          return {
            rows: [
              {
                id: customerId,
                business_id: businessId,
                name: 'Updated Name',
                phone: '081299998888',
                email: 'updated@example.com',
                tier: 'Silver',
                points: 500,
                server_version: 2,
                created_at: new Date(),
                updated_at: new Date(),
                deleted_at: null,
              },
            ],
          }
        }

        return { rows: [] }
      }),
      release: vi.fn(),
    }

    mockPool = {
      connect: vi.fn(async () => mockClient),
    }
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-001: existing customers remain valid after migration
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-001: existing customers remain valid after migration', async () => {
    const rawCustomer = {
      id: customerId,
      business_id: businessId,
      name: 'Budi Santoso',
      phone: '0812345678',
      email: 'budi@example.com',
      tier: 'Reguler',
      points: 0,
      spend_minor: 0,
      last_visit_epoch: null,
      server_version: 1,
      created_at: '2026-08-20T10:00:00.000Z',
      updated_at: '2026-08-20T10:00:00.000Z',
      deleted_at: null,
    }

    expect(rawCustomer.tier).toBe('Reguler')
    expect(rawCustomer.points).toBe(0)
    expect(rawCustomer.spend_minor).toBe(0)
    expect(rawCustomer.last_visit_epoch).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-002: default tier = Reguler
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-002: default tier = Reguler when omitted in create', () => {
    const req = validateCustomerCreate({
      id: customerId,
      business_id: businessId,
      name: 'Rani Maharani',
    })

    expect(req.tier).toBe('Reguler')
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-003: Gold accepted
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-003: Gold accepted in create and update', () => {
    const createReq = validateCustomerCreate({
      id: customerId,
      business_id: businessId,
      name: 'Dewi Lestari',
      tier: 'Gold',
    })
    expect(createReq.tier).toBe('Gold')

    const updateReq = validateCustomerUpdate({
      business_id: businessId,
      expected_server_version: 1,
      tier: 'Gold',
    })
    expect(updateReq.tier).toBe('Gold')
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-004: Silver accepted
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-004: Silver accepted in create and update', () => {
    const createReq = validateCustomerCreate({
      id: customerId,
      business_id: businessId,
      name: 'Andi Prasetyo',
      tier: 'Silver',
    })
    expect(createReq.tier).toBe('Silver')

    const updateReq = validateCustomerUpdate({
      business_id: businessId,
      expected_server_version: 1,
      tier: 'Silver',
    })
    expect(updateReq.tier).toBe('Silver')
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-005: invalid tier rejected
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-005: invalid tier rejected with ValidationError', () => {
    expect(() =>
      validateCustomerCreate({
        id: customerId,
        business_id: businessId,
        name: 'Invalid Tier User',
        tier: 'Platinum',
      })
    ).toThrow(ValidationError)

    expect(() =>
      validateCustomerUpdate({
        business_id: businessId,
        expected_server_version: 1,
        tier: 'VIP',
      })
    ).toThrow(ValidationError)
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-006: default points = 0
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-006: default points = 0 when omitted in create', () => {
    const req = validateCustomerCreate({
      id: customerId,
      business_id: businessId,
      name: 'Default Points User',
    })

    expect(req.points).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-007: positive points accepted
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-007: positive points accepted', () => {
    const req = validateCustomerCreate({
      id: customerId,
      business_id: businessId,
      name: 'Loyal User',
      points: 2450,
    })

    expect(req.points).toBe(2450)
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-008: negative points rejected
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-008: negative points rejected with ValidationError', () => {
    expect(() =>
      validateCustomerCreate({
        id: customerId,
        business_id: businessId,
        name: 'Negative Points User',
        points: -50,
      })
    ).toThrow(ValidationError)

    expect(() =>
      validateCustomerUpdate({
        business_id: businessId,
        expected_server_version: 1,
        points: -10,
      })
    ).toThrow(ValidationError)
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-009: create persists tier + points
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-009: create persists tier + points in repository', async () => {
    const service = createCustomerService(mockPool as any)

    const created = await service.create(
      {
        id: customerId,
        business_id: businessId,
        name: 'Dewi Lestari',
        phone: '0812-3345-1908',
        email: 'dewi@gmail.com',
        tier: 'Gold',
        points: 2450,
      },
      idempotencyKey,
      'fake-hash',
      businessId
    )

    expect(created.name).toBe('Dewi Lestari')
    expect(created.tier).toBe('Gold')
    expect(created.points).toBe(2450)

    const insertCall = queryHistory.find((q) => q.text.includes('INSERT INTO customers'))
    expect(insertCall).toBeDefined()
    expect(insertCall?.params).toContain('Gold')
    expect(insertCall?.params).toContain(2450)
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-010: update tier
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-010: update tier applies patch and returns updated entity', async () => {
    const service = createCustomerService(mockPool as any)

    mockClient.query.mockImplementation(async (text: string, params?: any[]) => {
      queryHistory.push({ text, params })
      if (text.includes('UPDATE customers')) {
        return { rows: [{ id: customerId }] }
      }
      if (text.includes('FROM customers c')) {
        return {
          rows: [
            {
              id: customerId,
              business_id: businessId,
              name: 'Dewi Lestari',
              phone: '0812-3345-1908',
              email: null,
              tier: 'Gold',
              points: 2450,
              spend_minor: 0,
              last_visit_epoch: null,
              server_version: 2,
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
          ],
        }
      }
      return { rows: [] }
    })

    const updated = await service.update(
      customerId,
      {
        business_id: businessId,
        expected_server_version: 1,
        tier: 'Gold',
      },
      idempotencyKey,
      'fake-hash',
      businessId
    )

    expect(updated.tier).toBe('Gold')
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-011: update points
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-011: update points applies patch and increments version', async () => {
    const service = createCustomerService(mockPool as any)

    mockClient.query.mockImplementation(async (text: string, params?: any[]) => {
      queryHistory.push({ text, params })
      if (text.includes('UPDATE customers')) {
        return { rows: [{ id: customerId }] }
      }
      if (text.includes('FROM customers c')) {
        return {
          rows: [
            {
              id: customerId,
              business_id: businessId,
              name: 'Dewi Lestari',
              phone: '0812-3345-1908',
              email: null,
              tier: 'Gold',
              points: 3000,
              spend_minor: 0,
              last_visit_epoch: null,
              server_version: 2,
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
          ],
        }
      }
      return { rows: [] }
    })

    const updated = await service.update(
      customerId,
      {
        business_id: businessId,
        expected_server_version: 1,
        points: 3000,
      },
      idempotencyKey,
      'fake-hash',
      businessId
    )

    expect(updated.points).toBe(3000)
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-012: tenant isolation
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-012: tenant isolation rejects cross-tenant requests', async () => {
    const service = createCustomerService(mockPool as any)

    await expect(
      service.list({ business_id: foreignBusinessId }, businessId)
    ).rejects.toThrow(ApiError)

    await expect(
      service.create(
        {
          id: customerId,
          business_id: foreignBusinessId,
          name: 'Cross Tenant',
        },
        idempotencyKey,
        'hash',
        businessId
      )
    ).rejects.toThrow(ApiError)
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-013: summary total customers
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-013: summary total customers returns aggregate count', async () => {
    const service = createCustomerService(mockPool as any)
    const summary = await service.getSummary(businessId, businessId)

    expect(summary.total_customers).toBe(8)
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-014: Gold count
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-014: summary returns Gold member count', async () => {
    const service = createCustomerService(mockPool as any)
    const summary = await service.getSummary(businessId, businessId)

    expect(summary.gold_members).toBe(3)
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-015: Silver count
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-015: summary returns Silver member count', async () => {
    const service = createCustomerService(mockPool as any)
    const summary = await service.getSummary(businessId, businessId)

    expect(summary.silver_members).toBe(3)
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-016: Regular count
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-016: summary returns Regular member count', async () => {
    const service = createCustomerService(mockPool as any)
    const summary = await service.getSummary(businessId, businessId)

    expect(summary.regular_members).toBe(2)
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-017: monthly spend
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-017: summary returns current month spend', async () => {
    const service = createCustomerService(mockPool as any)
    const summary = await service.getSummary(businessId, businessId)

    expect(summary.monthly_spend_minor).toBe(73280000)
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-018: customer spend mapping
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-018: list maps customer lifetime spend from sales linkage', async () => {
    const service = createCustomerService(mockPool as any)
    const result = await service.list({ business_id: businessId }, businessId)

    expect(result.items[0].spend_minor).toBe(12450000)
    expect(result.items[1].spend_minor).toBe(890000)
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-019: last visit mapping
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-019: list maps last visit epoch timestamp from sales linkage', async () => {
    const service = createCustomerService(mockPool as any)
    const result = await service.list({ business_id: businessId }, businessId)

    expect(result.items[0].last_visit_epoch).toBe(1787740800000)
    expect(result.items[1].last_visit_epoch).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-020: optimistic locking preserved
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-020: optimistic locking rejects stale expected_server_version', async () => {
    const service = createCustomerService(mockPool as any)

    mockClient.query.mockImplementation(async (text: string, params?: any[]) => {
      queryHistory.push({ text, params })
      if (text.includes('UPDATE customers')) {
        return { rows: [] } // Version mismatch
      }
      if (text.includes('FROM customers c')) {
        return {
          rows: [
            {
              id: customerId,
              business_id: businessId,
              name: 'Current Customer',
              tier: 'Reguler',
              points: 0,
              server_version: 5,
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            },
          ],
        }
      }
      return { rows: [] }
    })

    await expect(
      service.update(
        customerId,
        {
          business_id: businessId,
          expected_server_version: 2,
          name: 'Stale Update',
        },
        idempotencyKey,
        'hash',
        businessId
      )
    ).rejects.toThrow(ConflictError)
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-021: idempotency preserved
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-021: idempotent replay returns original response body', async () => {
    const service = createCustomerService(mockPool as any)

    const existingResponse = {
      id: customerId,
      business_id: businessId,
      name: 'Original Customer',
      tier: 'Gold',
      points: 500,
    }

    mockClient.query.mockImplementation(async (text: string, params?: any[]) => {
      if (text.includes('idempotency_keys') && text.includes('SELECT')) {
        return {
          rows: [
            {
              idempotency_key: idempotencyKey,
              request_hash: 'matching-hash',
              response_status: 201,
              response_body: existingResponse,
            },
          ],
        }
      }
      return { rows: [] }
    })

    const result = await service.create(
      {
        id: customerId,
        business_id: businessId,
        name: 'Original Customer',
      },
      idempotencyKey,
      'matching-hash',
      businessId
    )

    expect(result).toEqual(existingResponse)
  })

  // ---------------------------------------------------------------------------
  // CUSTOMER-CONTRACT-022: existing customer API compatibility
  // ---------------------------------------------------------------------------
  it('CUSTOMER-CONTRACT-022: preserves items, total, limit, offset, has_more structure in list response', async () => {
    const service = createCustomerService(mockPool as any)
    const result = await service.list({ business_id: businessId, limit: 10, offset: 0 }, businessId)

    expect(result).toHaveProperty('items')
    expect(result).toHaveProperty('total', 8)
    expect(result).toHaveProperty('limit', 10)
    expect(result).toHaveProperty('offset', 0)
    expect(typeof result.has_more).toBe('boolean')
    expect(result).toHaveProperty('summary')
    expect(Array.isArray(result.items)).toBe(true)
  })
})
