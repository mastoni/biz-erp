import { Pool } from 'pg'
import { SalesBatchRequest, validateSalesBatch } from '../dto/sale_dto'
import { SalesBatchResponse, SaleSyncResult, SaleSyncListResponse } from '../dto/sync_dto'
import { ApiError } from '../errors/api_error'
import { ConflictError } from '../errors/conflict_error'
import { ValidationError } from '../errors/validation_error'
import { idempotencyRepository } from '../repositories/idempotency_repository'
import { productRepository } from '../repositories/product_repository'
import { saleRepository } from '../repositories/sale_repository'
import { withTransaction } from '../db/transaction'

function assertTenant(businessId: string, demoBusinessId?: string): void {
  if (demoBusinessId && demoBusinessId.toLowerCase() !== businessId.toLowerCase()) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Business identity mismatch')
  }
}

export function createSalesSyncService(pool: Pool) {
  return {
    async syncBatch(body: unknown, demoBusinessId?: string): Promise<SalesBatchResponse> {
      const request: SalesBatchRequest = validateSalesBatch(body)
      assertTenant(request.business_id, demoBusinessId)

      return withTransaction(pool, async (client) => {
        const results: SaleSyncResult[] = []

        for (const [index, item] of request.items.entries()) {
          const existing = await idempotencyRepository.findActive(client, request.business_id, item.idempotency_key)

          if (existing) {
            if (existing.request_hash !== item.request_hash) {
              throw new ConflictError('IDEMPOTENCY_KEY_REUSE', 'Idempotency key was already used with a different request hash', {
                idempotency_key: item.idempotency_key,
                item_index: index
              })
            }

            const stored = existing.response_body as Record<string, unknown>

            results.push({
              idempotency_key: item.idempotency_key,
              status: 'replayed',
              sale_id: String(stored?.sale_id ?? ''),
              receipt_number: String(stored?.receipt_number ?? ''),
              server_created_at: String(stored?.server_created_at ?? '')
            })

            continue
          }

          for (const [itemIndex, saleItem] of item.sale_items.entries()) {
            if (saleItem.product_id) {
              const product = await productRepository.findById(client, request.business_id, saleItem.product_id)

              if (!product) {
                throw new ValidationError('Sale item references product outside this business', {
                  item_index: index,
                })
              }
            }
          }

          const created = await saleRepository.createSaleWithItems(client, request.business_id, item.sale, item.sale_items)

          const responseBody = {
            sale_id: created.sale_id,
            receipt_number: created.receipt_number,
            server_created_at: created.server_created_at
          }

          await idempotencyRepository.deleteExpiredForKey(client, request.business_id, item.idempotency_key)

          const inserted = await idempotencyRepository.insert(client, request.business_id, item.idempotency_key, item.request_hash, 201, responseBody)

          if (!inserted) {
            throw new ConflictError('IDEMPOTENCY_KEY_REUSE', 'Idempotency key conflict occurred while processing this request', {
              idempotency_key: item.idempotency_key,
              item_index: index
            })
          }

          results.push({
            idempotency_key: item.idempotency_key,
            status: 'created',
            sale_id: created.sale_id,
            receipt_number: created.receipt_number,
            server_created_at: created.server_created_at
          })
        }

        const createdCount = results.filter((result) => result.status === 'created').length

        return {
          results,
          created_count: createdCount,
          replayed_count: results.length - createdCount
        }
      })
    },

    async pullSales(businessId: string, sinceMs: number, limit: number): Promise<SaleSyncListResponse> {
      return withTransaction(pool, async (client) => {
        return saleRepository.findSalesSince(client, businessId, sinceMs, limit)
      })
    }
  }
}