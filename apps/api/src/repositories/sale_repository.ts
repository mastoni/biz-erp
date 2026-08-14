import { PoolClient } from 'pg'
import { SaleItemPayload, SalePayload } from '../dto/sale_dto'
import { newUuid } from '../utils/uuid'

export interface CreatedSale {
  sale_id: string
  receipt_number: string
  server_created_at: string
}

export const saleRepository = {
  async createSaleWithItems(client: PoolClient, businessId: string, sale: SalePayload, items: SaleItemPayload[]): Promise<CreatedSale> {
    const createdAt = sale.created_at ?? sale.client_created_at ?? new Date().toISOString()
    const clientCreatedAt = sale.client_created_at ?? createdAt

    const saleSql = `
      INSERT INTO sales (
        id,
        business_id,
        receipt_number,
        subtotal_minor,
        discount_minor,
        tax_minor,
        total_minor,
        payment_method,
        paid_minor,
        change_minor,
        cashier_id,
        created_at,
        client_created_at,
        server_created_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now()
      )
      RETURNING id, receipt_number, server_created_at
    `

    const saleResult = await client.query(saleSql, [
      sale.id,
      businessId,
      sale.receipt_number,
      sale.subtotal_minor,
      sale.discount_minor,
      sale.tax_minor,
      sale.total_minor,
      sale.payment_method,
      sale.paid_minor,
      sale.change_minor,
      sale.cashier_id,
      createdAt,
      clientCreatedAt
    ])

    for (const item of items) {
      const itemId = item.id ?? newUuid()

      await client.query(
        `
          INSERT INTO sale_items (
            id,
            sale_id,
            product_id,
            product_name,
            quantity,
            unit_price_minor,
            subtotal_minor
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [itemId, sale.id, item.product_id, item.product_name, item.quantity, item.unit_price_minor, item.subtotal_minor]
      )
    }

    const row = saleResult.rows[0]

    return {
      sale_id: row.id as string,
      receipt_number: row.receipt_number as string,
      server_created_at: row.server_created_at instanceof Date ? row.server_created_at.toISOString() : String(row.server_created_at)
    }
  }
}
