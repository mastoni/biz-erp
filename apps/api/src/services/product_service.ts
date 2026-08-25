import { Pool } from 'pg'
import { ApiError } from '../errors/api_error'
import { ValidationError } from '../errors/validation_error'
import { ProductDto, validateProductListQuery, ProductListQuery } from '../dto/product_dto'
import { productRepository, ProductListParams } from '../repositories/product_repository'
import { withTransaction } from '../db/transaction'
import { isUuid } from '../utils/uuid'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 500

function assertTenant(businessId: string, tenantId: string): void {
  if (tenantId.toLowerCase() !== businessId.toLowerCase()) {
    throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Business identity mismatch')
  }
}

export function createProductService(pool: Pool) {
  return {
    async list(query: unknown, tenantId: string): Promise<{
      items: ProductDto[]
      total: number
      limit: number
      offset: number
      has_more: boolean
    }> {
      const q = validateProductListQuery(query)
      assertTenant(q.business_id, tenantId)

      const limit = q.limit
      const offset = q.offset
      const fetchLimit = limit + 1

      const params: ProductListParams = {
        search: q.search,
        category: q.category,
        barcode: q.barcode,
      }

      return withTransaction(pool, async (client) => {
        const { rows, total } = await productRepository.list(client, q.business_id, params, fetchLimit, offset)

        const hasMore = rows.length > limit
        const items = hasMore ? rows.slice(0, limit) : rows

        return {
          items,
          total,
          limit,
          offset,
          has_more: hasMore,
        }
      })
    },

    async findById(productId: string, tenantId: string): Promise<ProductDto> {
      if (!isUuid(productId)) {
        throw new ValidationError('Product id must be a valid UUID')
      }

      return withTransaction(pool, async (client) => {
        const product = await productRepository.findById(client, tenantId, productId)

        if (!product) {
          throw new ApiError(404, 'NOT_FOUND', 'Product not found')
        }

        return product
      })
    },
  }
}
