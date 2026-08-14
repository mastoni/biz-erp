import { PoolClient } from 'pg'
import { ProductDto } from '../dto/product_dto'

const PRODUCT_COLUMNS = `
  id,
  business_id,
  name,
  description,
  price_minor,
  category,
  barcode,
  is_active,
  server_version,
  created_at,
  updated_at
`

export interface ProductPatch {
  name?: string
  description?: string | null
  price_minor?: number
  category?: string | null
  barcode?: string | null
  is_active?: boolean
}

export const productRepository = {
  async findByBusinessAfter(client: PoolClient, businessId: string, afterVersion: number, limit: number): Promise<ProductDto[]> {
    const sql = `
      SELECT ${PRODUCT_COLUMNS}
      FROM products
      WHERE business_id = $1
        AND server_version > $2
      ORDER BY server_version ASC, id ASC
      LIMIT $3
    `

    const result = await client.query(sql, [businessId, afterVersion, limit])
    return result.rows as ProductDto[]
  },

  async findById(client: PoolClient, businessId: string, productId: string): Promise<ProductDto | null> {
    const sql = `
      SELECT ${PRODUCT_COLUMNS}
      FROM products
      WHERE id = $1
        AND business_id = $2
    `

    const result = await client.query(sql, [productId, businessId])
    return (result.rows[0] as ProductDto | undefined) ?? null
  },

  async update(client: PoolClient, businessId: string, productId: string, expectedServerVersion: number, patch: ProductPatch): Promise<ProductDto | null> {
    const setClauses: string[] = []
    const values: unknown[] = [productId, businessId, expectedServerVersion]
    let paramIndex = 4

    if (patch.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`)
      values.push(patch.name)
    }

    if ('description' in patch) {
      setClauses.push(`description = $${paramIndex++}`)
      values.push(patch.description ?? null)
    }

    if (patch.price_minor !== undefined) {
      setClauses.push(`price_minor = $${paramIndex++}`)
      values.push(patch.price_minor)
    }

    if ('category' in patch) {
      setClauses.push(`category = $${paramIndex++}`)
      values.push(patch.category ?? null)
    }

    if ('barcode' in patch) {
      setClauses.push(`barcode = $${paramIndex++}`)
      values.push(patch.barcode ?? null)
    }

    if (patch.is_active !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`)
      values.push(patch.is_active)
    }

    setClauses.push('server_version = products.server_version + 1')
    setClauses.push('updated_at = now()')

    const sql = `
      UPDATE products
      SET ${setClauses.join(', ')}
      WHERE id = $1
        AND business_id = $2
        AND server_version = $3
      RETURNING ${PRODUCT_COLUMNS}
    `

    const result = await client.query(sql, values)
    return (result.rows[0] as ProductDto | undefined) ?? null
  }
}
