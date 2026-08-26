import { Pool } from 'pg'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'
import { ConflictError } from '../errors/conflict_error'
import {
  CustomerDto,
  CustomerSummaryDto,
  validateCustomerCreate,
  validateCustomerUpdate,
} from '../dto/customer_dto'
import { customerRepository, CustomerPatch } from '../repositories/customer_repository'
import { idempotencyRepository } from '../repositories/idempotency_repository'
import { withTransaction } from '../db/transaction'
import { isUuid } from '../utils/uuid'
import { createHash } from 'crypto'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 500

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function assertTenant(businessId: string, tenantId: string): void {
  if (tenantId.toLowerCase() !== businessId.toLowerCase()) {
    throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Business identity mismatch')
  }
}

function parseLimit(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_LIMIT
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    throw new ValidationError(`limit must be an integer between 1 and ${MAX_LIMIT}`)
  }
  return parsed
}

function parseOffset(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return 0
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ValidationError('offset must be a non-negative integer')
  }
  return parsed
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

export function createCustomerService(pool: Pool) {
  return {
    /**
     * List active customers for the authenticated tenant with joined spend, last visit, and summary KPI.
     */
    async list(
      query: unknown,
      tenantId: string
    ): Promise<{
      items: CustomerDto[]
      total: number
      limit: number
      offset: number
      has_more: boolean
      summary: CustomerSummaryDto
    }> {
      const q = query as Record<string, unknown>
      const businessId = typeof q.business_id === 'string' ? q.business_id.trim() : undefined

      if (!businessId || !isUuid(businessId)) {
        throw new ValidationError('business_id must be a valid UUID')
      }

      assertTenant(businessId, tenantId)

      const limit = parseLimit(q.limit)
      const offset = parseOffset(q.offset)

      return withTransaction(pool, async (client) => {
        const [{ rows, total }, summary] = await Promise.all([
          customerRepository.list(client, tenantId, limit, offset),
          customerRepository.getSummary(client, tenantId),
        ])

        return {
          items: rows,
          total,
          limit,
          offset,
          has_more: offset + rows.length < total,
          summary,
        }
      })
    },

    /**
     * Return customer summary metrics for KPI cards.
     */
    async getSummary(businessId: string, tenantId: string): Promise<CustomerSummaryDto> {
      if (!isUuid(businessId)) {
        throw new ValidationError('business_id must be a valid UUID')
      }
      assertTenant(businessId, tenantId)

      return withTransaction(pool, async (client) => {
        return customerRepository.getSummary(client, tenantId)
      })
    },

    /**
     * Return a single active customer belonging to the tenant.
     */
    async findById(customerId: string, tenantId: string): Promise<CustomerDto> {
      if (!isUuid(customerId)) {
        throw new ValidationError('Customer id must be a valid UUID')
      }

      return withTransaction(pool, async (client) => {
        const customer = await customerRepository.findById(client, tenantId, customerId)

        if (!customer) {
          throw new ApiError(404, 'NOT_FOUND', 'Customer not found')
        }

        return customer
      })
    },

    /**
     * Create a new customer belonging to the tenant with tier and points.
     * Idempotent: same idempotency key + same request hash returns original response.
     */
    async create(body: unknown, idempotencyKey: string, requestHash: string, tenantId: string): Promise<CustomerDto> {
      const request = validateCustomerCreate(body)
      assertTenant(request.business_id, tenantId)

      return withTransaction(pool, async (client) => {
        // Idempotency check
        const existing = await idempotencyRepository.findActive(client, request.business_id, idempotencyKey)
        if (existing) {
          if (existing.request_hash !== requestHash) {
            throw new ConflictError('IDEMPOTENCY_KEY_REUSE', 'Idempotency key was already used with a different request hash', { idempotency_key: idempotencyKey })
          }
          return existing.response_body as CustomerDto
        }

        // Check for duplicate customer id (different idempotency key)
        const duplicate = await customerRepository.findById(client, request.business_id, request.id)
        if (duplicate) {
          throw new ConflictError('CUSTOMER_ID_CONFLICT', 'Customer with this id already exists', { existing_customer_id: request.id })
        }

        const created = await customerRepository.insert(client, {
          id: request.id,
          business_id: request.business_id,
          name: request.name,
          phone: request.phone,
          email: request.email,
          tier: request.tier,
          points: request.points,
        })

        await idempotencyRepository.insert(client, request.business_id, idempotencyKey, requestHash, 201, created)
        return created
      })
    },

    /**
     * Update mutable fields on an active customer belonging to the tenant.
     * Optimistic locking via expected_server_version.
     */
    async update(
      customerId: string,
      body: unknown,
      idempotencyKey: string,
      requestHash: string,
      tenantId: string
    ): Promise<CustomerDto> {
      if (!isUuid(customerId)) {
        throw new ValidationError('Customer id must be a valid UUID')
      }

      const request = validateCustomerUpdate(body)
      assertTenant(request.business_id, tenantId)

      return withTransaction(pool, async (client) => {
        // Idempotency check
        const existing = await idempotencyRepository.findActive(client, request.business_id, idempotencyKey)
        if (existing) {
          if (existing.request_hash !== requestHash) {
            throw new ConflictError('IDEMPOTENCY_KEY_REUSE', 'Idempotency key was already used with a different request hash', { idempotency_key: idempotencyKey })
          }
          return existing.response_body as CustomerDto
        }

        const patch: CustomerPatch = {}

        if (request.name !== undefined) patch.name = request.name
        if ('phone' in request) patch.phone = request.phone ?? null
        if ('email' in request) patch.email = request.email ?? null
        if (request.tier !== undefined) patch.tier = request.tier
        if (request.points !== undefined) patch.points = request.points

        const updated = await customerRepository.update(client, tenantId, customerId, request.expected_server_version, patch)

        if (!updated) {
          // Check if it's a version conflict or not found
          const current = await customerRepository.findById(client, tenantId, customerId)
          if (current) {
            throw new ConflictError('CUSTOMER_VERSION_CONFLICT', 'Customer was modified by another device', {
              expected_server_version: request.expected_server_version,
              current_server_version: current.server_version,
              current_customer: current,
            })
          }
          throw new ApiError(404, 'NOT_FOUND', 'Customer not found')
        }

        await idempotencyRepository.insert(client, request.business_id, idempotencyKey, requestHash, 200, updated)
        return updated
      })
    },

    /**
     * Soft-delete a customer belonging to the tenant.
     */
    async softDelete(customerId: string, idempotencyKey: string, requestHash: string, tenantId: string): Promise<void> {
      if (!isUuid(customerId)) {
        throw new ValidationError('Customer id must be a valid UUID')
      }

      return withTransaction(pool, async (client) => {
        // Idempotency check
        const existing = await idempotencyRepository.findActive(client, tenantId, idempotencyKey)
        if (existing) {
          if (existing.request_hash !== requestHash) {
            throw new ConflictError('IDEMPOTENCY_KEY_REUSE', 'Idempotency key was already used with a different request hash', { idempotency_key: idempotencyKey })
          }
          return
        }

        const deleted = await customerRepository.softDelete(client, tenantId, customerId)

        if (!deleted) {
          throw new ApiError(404, 'NOT_FOUND', 'Customer not found')
        }

        await idempotencyRepository.insert(client, tenantId, idempotencyKey, requestHash, 204, null)
      })
    },
  }
}
