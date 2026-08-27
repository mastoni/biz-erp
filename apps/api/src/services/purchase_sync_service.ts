import { Pool } from 'pg'
import { PurchaseSyncListResponse } from '../dto/sync_dto'
import { ValidationError } from '../errors/validation_error'
import { purchaseRepository } from '../repositories/purchase_repository'
import { withTransaction } from '../db/transaction'
import { isUuid } from '../utils/uuid'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

function assertTenant(businessId: string, tenantId: string): void {
  if (tenantId.toLowerCase() !== businessId.toLowerCase()) {
    throw new ValidationError('Business identity mismatch')
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

export function createPurchaseSyncService(pool: Pool) {
  return {
    async list(query: unknown, tenantId: string): Promise<PurchaseSyncListResponse> {
      const q = query as Record<string, unknown>
      const businessId = typeof q.business_id === 'string' ? q.business_id.trim() : undefined

      if (!businessId || !isUuid(businessId)) {
        throw new ValidationError('business_id must be a valid UUID')
      }

      assertTenant(businessId, tenantId)

      const afterVersion = parseAfterVersion(q.after_version)
      const limit = parseLimit(q.limit)
      const fetchLimit = limit + 1

      return withTransaction(pool, async (client) => {
        const rows = await purchaseRepository.findByBusinessAfter(
          client,
          businessId,
          afterVersion,
          fetchLimit
        )

        const hasMore = rows.length > limit
        const items = hasMore ? rows.slice(0, limit) : rows
        const currentVersion =
          items.length > 0 ? Number(items[items.length - 1].server_version) : afterVersion

        return {
          items,
          current_version: currentVersion,
          has_more: hasMore,
        }
      })
    },
  }
}
