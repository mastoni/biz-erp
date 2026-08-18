import { Pool } from 'pg'
import { StockAdjustmentRequest } from '../dto/inventory_dto'
import { ApiError } from '../errors/api_error'
import { ConflictError } from '../errors/conflict_error'
import { idempotencyRepository } from '../repositories/idempotency_repository'
import { inventoryRepository } from '../repositories/inventory_repository'
import { branchRepository } from '../repositories/branch_repository'
import { productRepository } from '../repositories/product_repository'
import { withTransaction } from '../db/transaction'
import { randomUUID } from 'crypto'

export function createInventoryService(pool: Pool) {
  return {
    async adjustStock(
      request: StockAdjustmentRequest,
      actorUserId: string,
      idempotencyKey: string,
      requestHash: string
    ) {
      return withTransaction(pool, async (client) => {
        // 1. Verify idempotency
        const existing = await idempotencyRepository.findActive(client, request.business_id, idempotencyKey)
        if (existing) {
          if (existing.request_hash !== requestHash) {
            throw new ConflictError('IDEMPOTENCY_KEY_REUSE', 'Idempotency key was already used with a different request hash')
          }
          return {
            status: 'replayed',
            data: existing.response_body
          }
        }

        // 2. Validate tenant and relations
        const branch = await branchRepository.findById(client, request.business_id, request.branch_id)
        if (!branch || !branch.status) {
          throw new ApiError(400, 'BAD_REQUEST', 'Branch not found or inactive')
        }

        const product = await productRepository.findById(client, request.business_id, request.product_id)
        if (!product) {
          throw new ApiError(400, 'BAD_REQUEST', 'Product not found')
        }

        // 3. Concurrency check and update/insert
        let updatedStock = null

        if (request.expected_server_version === 0) {
          // Expecting new stock. Check if quantity is negative (negative stock policy)
          if (request.quantity_change < 0) {
             throw new ApiError(400, 'BAD_REQUEST', 'Negative stock is prohibited')
          }
          
          try {
            updatedStock = await inventoryRepository.createStock(
              client,
              randomUUID(),
              request.business_id,
              request.branch_id,
              request.product_id,
              request.quantity_change
            )
          } catch (error: any) {
             if (error.code === '23505') { // unique_violation
                 throw new ConflictError('CONFLICT', 'Stock already exists. expected_server_version must be > 0')
             }
             throw error
          }
        } else {
           // Existing stock update
           const stock = await inventoryRepository.getStock(client, request.business_id, request.branch_id, request.product_id)
           if (!stock) {
              throw new ConflictError('CONFLICT', 'Stock does not exist. expected_server_version must be 0')
           }

           if (stock.server_version !== request.expected_server_version) {
              throw new ConflictError('CONFLICT', 'server_version mismatch')
           }

           // Check negative stock policy
           if (stock.quantity + request.quantity_change < 0) {
              throw new ApiError(400, 'BAD_REQUEST', 'Negative stock is prohibited')
           }

           updatedStock = await inventoryRepository.updateStockAtomic(
              client,
              stock.id,
              request.quantity_change,
              request.expected_server_version
           )

           if (!updatedStock) {
              throw new ConflictError('CONFLICT', 'Failed to update stock due to concurrent modification')
           }
        }

        // 4. Create Stock Movement
        const movement = await inventoryRepository.createMovement(
          client,
          randomUUID(),
          request.business_id,
          request.branch_id,
          request.product_id,
          request.quantity_change,
          'ADJUSTMENT',
          request.reference || null,
          actorUserId
        )

        // 5. Finalize idempotency
        const responseBody = {
           stock: updatedStock,
           movement: movement
        }

        await idempotencyRepository.deleteExpiredForKey(client, request.business_id, idempotencyKey)
        const inserted = await idempotencyRepository.insert(client, request.business_id, idempotencyKey, requestHash, 201, responseBody)
        if (!inserted) {
           throw new ConflictError('IDEMPOTENCY_KEY_REUSE', 'Idempotency key conflict occurred')
        }

        return {
           status: 'created',
           data: responseBody
        }
      })
    }
  }
}
