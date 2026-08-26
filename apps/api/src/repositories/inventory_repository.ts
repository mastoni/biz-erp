import { PoolClient } from 'pg'
import { StockDto, StockMovementDto, StockMovementPaginatedResponse, StockWithProductDto, StockSummaryDto } from '../dto/inventory_dto'

export const LOW_STOCK_THRESHOLD = 5

export const inventoryRepository = {
  async getStocks(
    client: PoolClient,
    businessId: string,
    branchId: string,
    productIds?: string[]
  ): Promise<StockWithProductDto[]> {
    const conditions: string[] = ['stocks.business_id = $1', 'stocks.branch_id = $2']
    const params: any[] = [businessId, branchId]
    let paramIndex = 3

    if (productIds && productIds.length > 0) {
      conditions.push(`stocks.product_id IN (${productIds.map((_, i) => `$${paramIndex + i}`).join(', ')})`)
      productIds.forEach((id) => params.push(id))
      paramIndex += productIds.length
    }

    const sql = `
      SELECT
        stocks.id,
        stocks.business_id,
        stocks.branch_id,
        stocks.product_id,
        products.name AS product_name,
        products.sku,
        products.category,
        products.barcode,
        products.price_minor,
        products.cost_minor,
        stocks.quantity,
        stocks.server_version,
        stocks.created_at,
        stocks.updated_at
      FROM stocks
      JOIN products
        ON products.id = stocks.product_id
       AND products.business_id = stocks.business_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY stocks.updated_at DESC
    `

    const result = await client.query(sql, params)
    return result.rows as StockWithProductDto[]
  },

  async getMovementsPaginated(
    client: PoolClient,
    businessId: string,
    branchId: string,
    productId: string | undefined,
    limit: number,
    offset: number
  ): Promise<StockMovementPaginatedResponse> {
    const conditions: string[] = ['business_id = $1', 'branch_id = $2']
    const params: any[] = [businessId, branchId]
    let paramIndex = 3

    if (productId) {
      conditions.push(`product_id = $${paramIndex}`)
      params.push(productId)
      paramIndex++
    }

    const totalSql = `
      SELECT COUNT(*)::int AS total
      FROM stock_movements
      WHERE ${conditions.join(' AND ')}
    `
    const totalResult = await client.query(totalSql, params)
    const total = totalResult.rows[0].total as number

    const dataSql = `
      SELECT id, business_id, branch_id, product_id, quantity, movement_type, reference, actor, timestamp
      FROM stock_movements
      WHERE ${conditions.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `
    const dataResult = await client.query(dataSql, [...params, limit, offset])

    return {
      items: dataResult.rows as StockMovementDto[],
      total,
      limit,
      offset,
      has_more: offset + (dataResult.rows as StockMovementDto[]).length < total
    }
  },

  async getStock(client: PoolClient, businessId: string, branchId: string, productId: string): Promise<StockDto | null> {
    const sql = `
      SELECT id, business_id, branch_id, product_id, quantity, server_version, created_at, updated_at
      FROM stocks
      WHERE business_id = $1 AND branch_id = $2 AND product_id = $3
    `
    const result = await client.query(sql, [businessId, branchId, productId])
    return (result.rows[0] as StockDto | undefined) ?? null
  },

  async createStock(client: PoolClient, id: string, businessId: string, branchId: string, productId: string, quantity: number): Promise<StockDto> {
    const sql = `
      INSERT INTO stocks (id, business_id, branch_id, product_id, quantity, server_version, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 1, now(), now())
      RETURNING id, business_id, branch_id, product_id, quantity, server_version, created_at, updated_at
    `
    const result = await client.query(sql, [id, businessId, branchId, productId, quantity])
    return result.rows[0] as StockDto
  },

  async updateStockAtomic(
    client: PoolClient,
    id: string,
    quantityChange: number,
    expectedVersion: number
  ): Promise<StockDto | null> {
    const sql = `
      UPDATE stocks
      SET quantity = quantity + $1, server_version = server_version + 1, updated_at = now()
      WHERE id = $2 AND server_version = $3
      RETURNING id, business_id, branch_id, product_id, quantity, server_version, created_at, updated_at
    `
    const result = await client.query(sql, [quantityChange, id, expectedVersion])
    return (result.rows[0] as StockDto | undefined) ?? null
  },

  async createMovement(
    client: PoolClient,
    id: string,
    businessId: string,
    branchId: string,
    productId: string,
    quantity: number,
    movementType: string,
    reference: string | null,
    actor: string
  ): Promise<StockMovementDto> {
    const sql = `
      INSERT INTO stock_movements (id, business_id, branch_id, product_id, quantity, movement_type, reference, actor, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
      RETURNING id, business_id, branch_id, product_id, quantity, movement_type, reference, actor, timestamp
    `
    const result = await client.query(sql, [id, businessId, branchId, productId, quantity, movementType, reference, actor])
    return result.rows[0] as StockMovementDto
  },

  async getStockSummary(
    client: PoolClient,
    businessId: string,
    branchId: string
  ): Promise<StockSummaryDto> {
    const sql = `
      SELECT
        COALESCE(SUM(products.price_minor * stocks.quantity), 0) AS total_stock_value_minor,
        COUNT(*) FILTER (WHERE stocks.quantity <= $3 AND stocks.quantity > 0) AS low_stock_count,
        COUNT(*) FILTER (WHERE stocks.quantity = 0) AS out_of_stock_count,
        COUNT(*) AS total_skus
      FROM stocks
      JOIN products
        ON products.id = stocks.product_id
       AND products.business_id = stocks.business_id
       AND products.is_active = TRUE
      WHERE stocks.business_id = $1
        AND stocks.branch_id = $2
    `

    const result = await client.query(sql, [businessId, branchId, LOW_STOCK_THRESHOLD])
    const row = result.rows[0]

    return {
      total_stock_value_minor: Number(row.total_stock_value_minor) || 0,
      low_stock_count: Number(row.low_stock_count) || 0,
      out_of_stock_count: Number(row.out_of_stock_count) || 0,
      total_skus: Number(row.total_skus) || 0
    }
  }
}
