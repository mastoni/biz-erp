import { Pool } from 'pg'
import { StockAdjustmentRequest, VALID_MOVEMENT_TYPES } from '../dto/inventory_dto'
import { ApiError } from '../errors/api_error'
import { ConflictError } from '../errors/conflict_error'
import { idempotencyRepository } from '../repositories/idempotency_repository'
import { inventoryRepository } from '../repositories/inventory_repository'
import { branchRepository } from '../repositories/branch_repository'
import { productRepository } from '../repositories/product_repository'
import { withTransaction } from '../db/transaction'
import { randomUUID } from 'crypto'

function resolveMovementType(request: StockAdjustmentRequest): 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT' {
  if (request.movement_type) {
    return request.movement_type
  }
  return 'ADJUSTMENT'
}

function computeLedgerDelta(
  movementType: 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT',
  quantityChange: number
): number {
  switch (movementType) {
    case 'STOCK_IN':
      if (quantityChange <= 0) {
        throw new ApiError(400, 'BAD_REQUEST', 'STOCK_IN requires quantity_change > 0')
      }
      return quantityChange
    case 'STOCK_OUT':
      if (quantityChange <= 0) {
        throw new ApiError(400, 'BAD_REQUEST', 'STOCK_OUT requires quantity_change > 0')
      }
      return -quantityChange
    case 'ADJUSTMENT':
      return quantityChange
  }
}

export function createInventoryService(pool: Pool) {
  return {
    async adjustStock(
      request: StockAdjustmentRequest,
      actorUserId: string,
      idempotencyKey: string,
      requestHash: string
    ) {
      const movementType = resolveMovementType(request)
      const ledgerDelta = computeLedgerDelta(movementType, request.quantity_change)

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
          if (ledgerDelta < 0) {
             throw new ApiError(400, 'BAD_REQUEST', 'Negative stock is prohibited')
          }

          try {
            updatedStock = await inventoryRepository.createStock(
              client,
              randomUUID(),
              request.business_id,
              request.branch_id,
              request.product_id,
              ledgerDelta
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
           if (stock.quantity + ledgerDelta < 0) {
              throw new ApiError(400, 'BAD_REQUEST', 'Negative stock is prohibited')
           }

           updatedStock = await inventoryRepository.updateStockAtomic(
              client,
              stock.id,
              ledgerDelta,
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
          ledgerDelta,
          movementType,
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

export { VALID_MOVEMENT_TYPES }
