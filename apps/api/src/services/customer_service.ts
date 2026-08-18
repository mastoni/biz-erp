import { Pool } from 'pg'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'
import {
  CustomerDto,
  validateCustomerCreate,
  validateCustomerUpdate,
} from '../dto/customer_dto'
import { customerRepository, CustomerPatch } from '../repositories/customer_repository'
import { withTransaction } from '../db/transaction'
import { isUuid, newUuid } from '../utils/uuid'

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
     * List active customers for the authenticated tenant.
     * If business_id is supplied in the query, it must match the JWT tenant claim.
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
        const { rows, total } = await customerRepository.list(client, tenantId, limit, offset)

        return {
          items: rows,
          total,
          limit,
          offset,
          has_more: offset + rows.length < total,
        }
      })
    },

    /**
     * Return a single active customer belonging to the tenant.
     * Treats both missing and soft-deleted as 404 to avoid tenant leakage.
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
     * Create a new customer belonging to the tenant.
     */
    async create(body: unknown, tenantId: string): Promise<CustomerDto> {
      const request = validateCustomerCreate(body)
      assertTenant(request.business_id, tenantId)

      return withTransaction(pool, async (client) => {
        const created = await customerRepository.insert(client, {
          id: newUuid(),
          business_id: tenantId,
          name: request.name,
          phone: request.phone,
          email: request.email,
        })

        return created
      })
    },

    /**
     * Update mutable fields on an active customer belonging to the tenant.
     */
    async update(
      customerId: string,
      body: unknown,
      tenantId: string
    ): Promise<CustomerDto> {
      if (!isUuid(customerId)) {
        throw new ValidationError('Customer id must be a valid UUID')
      }

      const request = validateCustomerUpdate(body)
      assertTenant(request.business_id, tenantId)

      return withTransaction(pool, async (client) => {
        const patch: CustomerPatch = {}

        if (request.name !== undefined) patch.name = request.name
        if ('phone' in request) patch.phone = request.phone ?? null
        if ('email' in request) patch.email = request.email ?? null

        const updated = await customerRepository.update(client, tenantId, customerId, patch)

        if (!updated) {
          throw new ApiError(404, 'NOT_FOUND', 'Customer not found')
        }

        return updated
      })
    },

    /**
     * Soft-delete a customer belonging to the tenant.
     * Throws 404 if not found or already deleted (tenant-safe, no existence leakage).
     */
    async softDelete(customerId: string, tenantId: string): Promise<void> {
      if (!isUuid(customerId)) {
        throw new ValidationError('Customer id must be a valid UUID')
      }

      return withTransaction(pool, async (client) => {
        const deleted = await customerRepository.softDelete(client, tenantId, customerId)

        if (!deleted) {
          throw new ApiError(404, 'NOT_FOUND', 'Customer not found')
        }
      })
    },
  }
}
