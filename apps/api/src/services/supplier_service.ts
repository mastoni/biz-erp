import { Pool } from 'pg'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'
import { ConflictError } from '../errors/conflict_error'
import {
  SupplierDto,
  SupplierSummaryDto,
  SupplierCreateRequest,
  SupplierUpdateRequest,
  validateSupplierCreate,
  validateSupplierUpdate,
  generateSupplierCode,
} from '../dto/supplier_dto'
import { supplierRepository, SupplierPatch } from '../repositories/supplier_repository'
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

function computeCreateHash(body: SupplierCreateRequest): string {
  const hashStr = `create|${body.business_id}|${body.id}|${body.name}|${body.contact ?? 'null'}|${body.phone ?? 'null'}|${body.email ?? 'null'}|${body.category ?? 'null'}|${body.term}|${body.status}`
  return createHash('sha256').update(hashStr).digest('hex')
}

function computeUpdateHash(body: SupplierUpdateRequest, supplierId: string): string {
  const hashStr = `update|${body.business_id}|${supplierId}|${body.expected_server_version}|${body.name ?? 'null'}|${body.contact ?? 'null'}|${body.phone ?? 'null'}|${body.email ?? 'null'}|${body.category ?? 'null'}|${body.term ?? 'null'}|${body.status ?? 'null'}`
  return createHash('sha256').update(hashStr).digest('hex')
}

function computeDeleteHash(businessId: string, supplierId: string): string {
  const hashStr = `delete|${businessId}|${supplierId}`
  return createHash('sha256').update(hashStr).digest('hex')
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

export function createSupplierService(pool: Pool) {
  return {
    /**
     * List active suppliers for the authenticated tenant with KPI summary.
     */
    async list(
      query: unknown,
      tenantId: string
    ): Promise<{
      items: SupplierDto[]
      total: number
      limit: number
      offset: number
      has_more: boolean
      summary: SupplierSummaryDto
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
          supplierRepository.list(client, tenantId, limit, offset),
          supplierRepository.getSummary(client, tenantId),
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
     * Return supplier KPI summary metrics.
     */
    async getSummary(businessId: string, tenantId: string): Promise<SupplierSummaryDto> {
      if (!isUuid(businessId)) {
        throw new ValidationError('business_id must be a valid UUID')
      }
      assertTenant(businessId, tenantId)

      return withTransaction(pool, async (client) => {
        return supplierRepository.getSummary(client, tenantId)
      })
    },

    /**
     * Return a single active supplier belonging to the tenant.
     */
    async findById(supplierId: string, tenantId: string): Promise<SupplierDto> {
      if (!isUuid(supplierId)) {
        throw new ValidationError('Supplier id must be a valid UUID')
      }

      return withTransaction(pool, async (client) => {
        const supplier = await supplierRepository.findById(client, tenantId, supplierId)

        if (!supplier) {
          throw new ApiError(404, 'NOT_FOUND', 'Supplier not found')
        }

        return supplier
      })
    },

    /**
     * Create a new supplier belonging to the tenant.
     * Generates a deterministic code from the name.
     * Idempotent: same idempotency key + same request hash returns original response.
     *
     * Code uniqueness: if the generated code already exists for the same business,
     * returns 409 CONFLICT — does not silently overwrite.
     */
    async create(
      body: unknown,
      idempotencyKey: string,
      requestHash: string,
      tenantId: string
    ): Promise<SupplierDto> {
      const request = validateSupplierCreate(body)
      assertTenant(request.business_id, tenantId)

      // Derive code from name (deterministic)
      const generatedCode = generateSupplierCode(request.name)

      return withTransaction(pool, async (client) => {
        // Idempotency check
        const existing = await idempotencyRepository.findActive(
          client,
          request.business_id,
          idempotencyKey
        )
        if (existing) {
          if (existing.request_hash !== requestHash) {
            throw new ConflictError(
              'IDEMPOTENCY_KEY_REUSE',
              'Idempotency key was already used with a different request hash',
              { idempotency_key: idempotencyKey }
            )
          }
          return existing.response_body as SupplierDto
        }

        // Check for duplicate supplier id (different idempotency key)
        const duplicate = await supplierRepository.findById(
          client,
          request.business_id,
          request.id
        )
        if (duplicate) {
          throw new ConflictError('SUPPLIER_ID_CONFLICT', 'Supplier with this id already exists', {
            existing_supplier_id: request.id,
          })
        }

        // Check for code uniqueness per tenant
        const existingCode = await supplierRepository.findByCode(
          client,
          request.business_id,
          generatedCode
        )
        if (existingCode) {
          throw new ConflictError(
            'SUPPLIER_CODE_CONFLICT',
            `Supplier code "${generatedCode}" already exists for this business. Please use a different supplier name.`,
            { code: generatedCode, existing_supplier_name: existingCode.name }
          )
        }

        const created = await supplierRepository.insert(client, {
          id: request.id,
          business_id: request.business_id,
          code: generatedCode,
          name: request.name,
          contact: request.contact,
          phone: request.phone,
          email: request.email,
          category: request.category,
          term: request.term,
          status: request.status,
        })

        await idempotencyRepository.insert(
          client,
          request.business_id,
          idempotencyKey,
          requestHash,
          201,
          created
        )
        return created
      })
    },

    /**
     * Update mutable fields on an active supplier belonging to the tenant.
     * Optimistic locking via expected_server_version.
     * If the name changes, a new code is generated and uniqueness is enforced.
     */
    async update(
      supplierId: string,
      body: unknown,
      idempotencyKey: string,
      requestHash: string,
      tenantId: string
    ): Promise<SupplierDto> {
      if (!isUuid(supplierId)) {
        throw new ValidationError('Supplier id must be a valid UUID')
      }

      const request = validateSupplierUpdate(body)
      assertTenant(request.business_id, tenantId)

      // If name is being updated, generate new code for collision check
      const generatedCode = request.name ? generateSupplierCode(request.name) : null

      return withTransaction(pool, async (client) => {
        // Idempotency check
        const existing = await idempotencyRepository.findActive(
          client,
          request.business_id,
          idempotencyKey
        )
        if (existing) {
          if (existing.request_hash !== requestHash) {
            throw new ConflictError(
              'IDEMPOTENCY_KEY_REUSE',
              'Idempotency key was already used with a different request hash',
              { idempotency_key: idempotencyKey }
            )
          }
          return existing.response_body as SupplierDto
        }

        const patch: SupplierPatch = {}

        if (request.name !== undefined) {
          patch.name = request.name
        }
        if ('contact' in request) patch.contact = request.contact ?? null
        if ('phone' in request) patch.phone = request.phone ?? null
        if ('email' in request) patch.email = request.email ?? null
        if ('category' in request) patch.category = request.category ?? null
        if (request.term !== undefined) patch.term = request.term
        if ('status' in request) patch.status = request.status

        // If name changed, enforce code uniqueness
        if (generatedCode) {
          const existingCode = await supplierRepository.findByCode(
            client,
            request.business_id,
            generatedCode
          )
          if (existingCode && existingCode.id !== supplierId) {
            throw new ConflictError(
              'SUPPLIER_CODE_CONFLICT',
              `Supplier code "${generatedCode}" already exists for this business.`,
              { code: generatedCode, existing_supplier_name: existingCode.name }
            )
          }
        }

        const updated = await supplierRepository.update(
          client,
          tenantId,
          supplierId,
          request.expected_server_version,
          patch
        )

        if (!updated) {
          // Check if it's a version conflict or not found
          const current = await supplierRepository.findById(client, tenantId, supplierId)
          if (current) {
            throw new ConflictError('SUPPLIER_VERSION_CONFLICT', 'Supplier was modified by another device', {
              expected_server_version: request.expected_server_version,
              current_server_version: current.server_version,
              current_supplier: current,
            })
          }
          throw new ApiError(404, 'NOT_FOUND', 'Supplier not found')
        }

        await idempotencyRepository.insert(
          client,
          request.business_id,
          idempotencyKey,
          requestHash,
          200,
          updated
        )
        return updated
      })
    },

    /**
     * Soft-delete a supplier belonging to the tenant.
     * Sets deleted_at = now(), status = 'nonaktif', and increments server_version.
     */
    async softDelete(
      supplierId: string,
      idempotencyKey: string,
      requestHash: string,
      tenantId: string
    ): Promise<void> {
      if (!isUuid(supplierId)) {
        throw new ValidationError('Supplier id must be a valid UUID')
      }

      return withTransaction(pool, async (client) => {
        // Idempotency check
        const existing = await idempotencyRepository.findActive(client, tenantId, idempotencyKey)
        if (existing) {
          if (existing.request_hash !== requestHash) {
            throw new ConflictError(
              'IDEMPOTENCY_KEY_REUSE',
              'Idempotency key was already used with a different request hash',
              { idempotency_key: idempotencyKey }
            )
          }
          return
        }

        const deleted = await supplierRepository.softDelete(client, tenantId, supplierId)

        if (!deleted) {
          throw new ApiError(404, 'NOT_FOUND', 'Supplier not found')
        }

        await idempotencyRepository.insert(
          client,
          tenantId,
          idempotencyKey,
          requestHash,
          204,
          null
        )
      })
    },
  }
}
