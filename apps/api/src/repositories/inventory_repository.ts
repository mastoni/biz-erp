import { PoolClient } from 'pg'
import { StockDto, StockMovementDto } from '../dto/inventory_dto'

export const inventoryRepository = {
  async getStocks(client: PoolClient, businessId: string, branchId: string): Promise<StockDto[]> {
    const sql = `
      SELECT id, business_id, branch_id, product_id, quantity, server_version, created_at, updated_at
      FROM stocks
      WHERE business_id = $1 AND branch_id = $2
      ORDER BY updated_at DESC
    `
    const result = await client.query(sql, [businessId, branchId])
    return result.rows as StockDto[]
  },

  async getMovements(client: PoolClient, businessId: string, branchId: string, productId?: string): Promise<StockMovementDto[]> {
    let sql = `
      SELECT id, business_id, branch_id, product_id, quantity, movement_type, reference, actor, timestamp
      FROM stock_movements
      WHERE business_id = $1 AND branch_id = $2
    `
    const params: any[] = [businessId, branchId]
    if (productId) {
      sql += ` AND product_id = $3`
      params.push(productId)
    }
    sql += ` ORDER BY timestamp DESC LIMIT 500`
    
    const result = await client.query(sql, params)
    return result.rows as StockMovementDto[]
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
  }
}
