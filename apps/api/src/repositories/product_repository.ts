import { PoolClient } from 'pg'
import { ProductDto } from '../dto/product_dto'

const PRODUCT_COLUMNS = `
  id,
  business_id,
  name,
  description,
  sku,
  price_minor,
  cost_minor,
  category,
  barcode,
  image_url,
  image_enabled,
  is_active,
  server_version,
  created_at,
  updated_at
`

export interface ProductPatch {
  name?: string
  description?: string | null
  sku?: string | null
  price_minor?: number
  cost_minor?: number | null
  category?: string | null
  barcode?: string | null
  image_url?: string | null
  image_enabled?: boolean
  is_active?: boolean
}

export interface ProductListParams {
  search?: string
  category?: string
  barcode?: string
}

export const productRepository = {
  async list(
    client: PoolClient,
    businessId: string,
    params: ProductListParams,
    limit: number,
    offset: number
  ): Promise<{ rows: ProductDto[]; total: number }> {
    const conditions: string[] = ['business_id = $1']
    const values: unknown[] = [businessId]
    let paramIndex = 2

    if (params.search && params.search.trim().length > 0) {
      const searchTerm = `%${params.search.trim()}%`
      conditions.push(`(name ILIKE $${paramIndex} OR sku ILIKE $${paramIndex + 1} OR barcode ILIKE $${paramIndex + 2})`)
      values.push(searchTerm, searchTerm, searchTerm)
      paramIndex += 3
    }

    if (params.category && params.category.trim().length > 0) {
      conditions.push(`category = $${paramIndex}`)
      values.push(params.category.trim())
      paramIndex++
    }

    if (params.barcode && params.barcode.trim().length > 0) {
      conditions.push(`barcode = $${paramIndex}`)
      values.push(params.barcode.trim())
      paramIndex++
    }

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM products
      WHERE ${conditions.join(' AND ')}
    `
    const countResult = await client.query(countSql, values)
    const total = countResult.rows[0].total as number

    const rowSql = `
      SELECT ${PRODUCT_COLUMNS}
      FROM products
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at ASC, id ASC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `
    const rowResult = await client.query(rowSql, [...values, limit, offset])

    return { rows: rowResult.rows as ProductDto[], total }
  },

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

    if ('sku' in patch) {
      setClauses.push(`sku = $${paramIndex++}`)
      values.push(patch.sku ?? null)
    }

    if (patch.price_minor !== undefined) {
      setClauses.push(`price_minor = $${paramIndex++}`)
      values.push(patch.price_minor)
    }

    if ('cost_minor' in patch) {
      setClauses.push(`cost_minor = $${paramIndex++}`)
      values.push(patch.cost_minor ?? null)
    }

    if ('category' in patch) {
      setClauses.push(`category = $${paramIndex++}`)
      values.push(patch.category ?? null)
    }

    if ('barcode' in patch) {
      setClauses.push(`barcode = $${paramIndex++}`)
      values.push(patch.barcode ?? null)
    }

    if ('image_url' in patch) {
      setClauses.push(`image_url = $${paramIndex++}`)
      values.push(patch.image_url ?? null)
    }

    if (patch.image_enabled !== undefined) {
      setClauses.push(`image_enabled = $${paramIndex++}`)
      values.push(patch.image_enabled)
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
  },

  async insert(client: PoolClient, product: {
    id: string; business_id: string; name: string; description: string | null;
    sku: string | null; price_minor: number; cost_minor: number | null;
    category: string | null; barcode: string | null; image_url?: string | null;
    image_enabled?: boolean; is_active: boolean;
  }): Promise<ProductDto> {
    const sql = `
      INSERT INTO products (id, business_id, name, description, sku, price_minor, cost_minor, category, barcode, image_url, image_enabled, is_active, server_version, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, now(), now())
      RETURNING ${PRODUCT_COLUMNS}
    `
    const result = await client.query(sql, [
      product.id, product.business_id, product.name, product.description,
      product.sku, product.price_minor, product.cost_minor,
      product.category, product.barcode, product.image_url ?? null,
      product.image_enabled ?? false, product.is_active
    ])
    return result.rows[0] as ProductDto
  }
}
