import { Pool } from 'pg'
import { ProductDto, validateProductUpdate } from '../dto/product_dto'
import { ProductSyncListResponse } from '../dto/sync_dto'
import { ApiError } from '../errors/api_error'
import { ConflictError } from '../errors/conflict_error'
import { ValidationError } from '../errors/validation_error'
import { productRepository, ProductPatch } from '../repositories/product_repository'
import { withTransaction } from '../db/transaction'
import { isUuid } from '../utils/uuid'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

function assertTenant(businessId: string, demoBusinessId?: string): void {
  if (demoBusinessId && demoBusinessId.toLowerCase() !== businessId.toLowerCase()) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Business identity mismatch')
  }
}

function parseAfterVersion(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return 0
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ValidationError('after_version must be an integer >= 0')
  }

  return parsed
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

export function createProductSyncService(pool: Pool) {
  return {
    async list(query: unknown, demoBusinessId?: string): Promise<ProductSyncListResponse> {
      const q = query as Record<string, unknown>
      const businessId = typeof q.business_id === 'string' ? q.business_id.trim() : undefined

      if (!businessId || !isUuid(businessId)) {
        throw new ValidationError('business_id must be a valid UUID')
      }

      assertTenant(businessId, demoBusinessId)

      const afterVersion = parseAfterVersion(q.after_version)
      const limit = parseLimit(q.limit)
      const fetchLimit = limit + 1

      return withTransaction(pool, async (client) => {
        const rows = await productRepository.findByBusinessAfter(client, businessId, afterVersion, fetchLimit)

        const hasMore = rows.length > limit
        const items = hasMore ? rows.slice(0, limit) : rows
        const nextVersion = items.length > 0 ? Number(items[items.length - 1].server_version) : afterVersion

        return {
          items,
          next_version: nextVersion,
          has_more: hasMore
        }
      })
    },

    async update(productId: string, body: unknown, demoBusinessId?: string): Promise<ProductDto> {
      if (!isUuid(productId)) {
        throw new ValidationError('Product id must be a valid UUID')
      }

      const request = validateProductUpdate(body)
      assertTenant(request.business_id, demoBusinessId)

      return withTransaction(pool, async (client) => {
        const existing = await productRepository.findById(client, request.business_id, productId)

        if (!existing) {
          throw new ApiError(404, 'NOT_FOUND', 'Product not found')
        }

        if (Number(existing.server_version) !== request.expected_server_version) {
          throw new ConflictError('VERSION_CONFLICT', 'Product was modified by another device', {
            expected_server_version: request.expected_server_version,
            current_server_version: existing.server_version
          })
        }

        const patch: ProductPatch = {}

        if (request.name !== undefined) patch.name = request.name
        if (request.description !== undefined) patch.description = request.description
        if (request.price_minor !== undefined) patch.price_minor = request.price_minor
        if (request.category !== undefined) patch.category = request.category
        if (request.barcode !== undefined) patch.barcode = request.barcode
        if (request.is_active !== undefined) patch.is_active = request.is_active

        const updated = await productRepository.update(client, request.business_id, productId, request.expected_server_version, patch)

        if (!updated) {
          throw new ConflictError('VERSION_CONFLICT', 'Product was modified by another device')
        }

        return updated
      })
    }
  }
}
