import { Pool, PoolClient } from 'pg'
import { SalesBatchRequest, validateSalesBatch } from '../dto/sale_dto'
import { SalesBatchResponse, SaleSyncResult, SaleSyncListResponse } from '../dto/sync_dto'
import { ApiError } from '../errors/api_error'
import { ConflictError } from '../errors/conflict_error'
import { ValidationError } from '../errors/validation_error'
import { idempotencyRepository } from '../repositories/idempotency_repository'
import { productRepository } from '../repositories/product_repository'
import { saleRepository } from '../repositories/sale_repository'
import { inventoryRepository } from '../repositories/inventory_repository'
import { branchRepository } from '../repositories/branch_repository'
import { withTransaction } from '../db/transaction'
import { randomUUID } from 'crypto'
import { createHash } from 'crypto'

function assertTenant(businessId: string, tenantId: string): void {
  if (tenantId.toLowerCase() !== businessId.toLowerCase()) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Business identity mismatch')
  }
}

function buildStockIdempotencyKey(saleIdempotencyKey: string, productId: string): string {
  return `${saleIdempotencyKey}_stock_${productId}`
}

function buildStockRequestHash(saleIdempotencyKey: string, productId: string, quantity: number, branchId: string, businessId: string): string {
  const hashStr = `${saleIdempotencyKey}|${productId}|${quantity}|${branchId}|${businessId}`
  return createHash('sha256').update(hashStr).digest('hex')
}

export function createSalesSyncService(pool: Pool) {
  return {
    async syncBatch(body: unknown, tenantId: string): Promise<SalesBatchResponse> {
      const request: SalesBatchRequest = validateSalesBatch(body)
      assertTenant(request.business_id, tenantId)

      return withTransaction(pool, async (client) => {
        const results: SaleSyncResult[] = []

        for (const [index, item] of request.items.entries()) {
          const savepointName = `sp_item_${index}`
          await client.query(`SAVEPOINT ${savepointName}`)

          try {
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

              await client.query(`RELEASE SAVEPOINT ${savepointName}`)
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

            // Deduct stock for each sale item in the sale's branch
            const branchId = item.sale.branch_id
            for (const saleItem of item.sale_items) {
              if (saleItem.product_id && saleItem.quantity > 0) {
                // Check current stock
                const stock = await inventoryRepository.getStock(client, request.business_id, branchId, saleItem.product_id)

                if (!stock) {
                  // No stock record exists - create with negative quantity would fail, so we must reject
                  throw new ValidationError('Insufficient stock: no stock record exists for product', {
                    item_index: index,
                    product_id: saleItem.product_id,
                    branch_id: branchId
                  })
                }

                // Check if sufficient stock
                if (stock.quantity < saleItem.quantity) {
                  throw new ValidationError('Insufficient stock for product', {
                    item_index: index,
                    product_id: saleItem.product_id,
                    branch_id: branchId,
                    available: stock.quantity,
                    requested: saleItem.quantity
                  })
                }

                // Update stock atomically with optimistic locking
                const updatedStock = await inventoryRepository.updateStockAtomic(
                  client,
                  stock.id,
                  -saleItem.quantity,
                  stock.server_version
                )

                if (!updatedStock) {
                  throw new ConflictError('CONFLICT', 'Failed to update stock due to concurrent modification', {
                    item_index: index,
                    product_id: saleItem.product_id
                  })
                }

                // Create stock movement for the sale
                const stockIdempotencyKey = buildStockIdempotencyKey(item.idempotency_key, saleItem.product_id)
                const stockRequestHash = buildStockRequestHash(
                  item.idempotency_key,
                  saleItem.product_id,
                  -saleItem.quantity,
                  branchId,
                  request.business_id
                )

                // Check idempotency for stock movement
                const existingStockIdem = await idempotencyRepository.findActive(client, request.business_id, stockIdempotencyKey)
                if (existingStockIdem) {
                  if (existingStockIdem.request_hash !== stockRequestHash) {
                    throw new ConflictError('IDEMPOTENCY_KEY_REUSE', 'Stock idempotency key was already used with a different request hash', {
                      item_index: index,
                      product_id: saleItem.product_id
                    })
                  }
                  // Already processed - skip creating duplicate movement
                  continue
                }

                const movement = await inventoryRepository.createMovement(
                  client,
                  randomUUID(),
                  request.business_id,
                  branchId,
                  saleItem.product_id,
                  -saleItem.quantity,
                  'SALE',
                  created.receipt_number,
                  item.sale.cashier_id ?? 'SYSTEM'
                )

                // Record idempotency for stock movement
                await idempotencyRepository.insert(client, request.business_id, stockIdempotencyKey, stockRequestHash, 201, {
                  stock: updatedStock,
                  movement: movement
                })
              }
            }

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

            await client.query(`RELEASE SAVEPOINT ${savepointName}`)
          } catch (err: any) {
            await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`)

            if (err.status === 409 && err.code === 'RECEIPT_NUMBER_CONFLICT') {
              results.push({
                idempotency_key: item.idempotency_key,
                status: 'receipt_conflict',
                sale_id: '',
                receipt_number: item.sale.receipt_number,
                server_created_at: ''
              })
              continue
            }
            throw err
          }
        }

        const createdCount = results.filter((result) => result.status === 'created').length

        return {
          results,
          created_count: createdCount,
          replayed_count: results.length - createdCount
        }
      })
    },

    async pullSales(businessId: string, sinceMs: number, limit: number, branchId?: string): Promise<SaleSyncListResponse> {
      return withTransaction(pool, async (client) => {
        if (branchId) {
          const branch = await branchRepository.findById(client, businessId, branchId)
          if (!branch) {
            throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Branch not found or access denied')
          }
        }
        return saleRepository.findSalesSince(client, businessId, sinceMs, limit, branchId)
      })
    }
  }
}