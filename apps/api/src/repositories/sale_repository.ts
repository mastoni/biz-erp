import { PoolClient } from 'pg'
import { SaleItemPayload, SalePayload } from '../dto/sale_dto'
import { newUuid } from '../utils/uuid'
import { ConflictError } from '../errors/conflict_error'

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
          branch_id,
          receipt_number,
          subtotal_minor,
          discount_minor,
          tax_minor,
          total_minor,
          payment_method,
          paid_minor,
          change_minor,
          cashier_id,
          customer_id,
          created_at,
          client_created_at,
          server_created_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        )
        RETURNING id, receipt_number, server_created_at
      `

      let saleResult: any
      try {
        saleResult = await client.query(saleSql, [
          sale.id,
          businessId,
          sale.branch_id ?? null,
          sale.receipt_number,
          sale.subtotal_minor,
          sale.discount_minor,
          sale.tax_minor,
          sale.total_minor,
          sale.payment_method,
          sale.paid_minor,
          sale.change_minor,
          sale.cashier_id,
          sale.customer_id,
          createdAt,
          clientCreatedAt, createdAt
        ])
      } catch (err: any) {
        if (err.code === '23505' && err.constraint === 'idx_sales_business_receipt') {
          throw new ConflictError('RECEIPT_NUMBER_CONFLICT', 'Receipt number already used for this business', {
            receipt_number: sale.receipt_number,
            business_id: businessId
          })
        }
        throw err
      }

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
  },

    async findSalesSince(client: PoolClient, businessId: string, sinceMs: number, limit: number, branchId?: string) {
      const sinceTimestamp = new Date(sinceMs)

      const branchCondition = branchId ? ` AND s.branch_id = $4` : ''
      const params = branchId
        ? [businessId, sinceTimestamp, limit + 1, branchId]
        : [businessId, sinceTimestamp, limit + 1]

      const salesSql = `
        SELECT
          s.id,
          s.branch_id,
          s.receipt_number,
          s.subtotal_minor,
          s.discount_minor,
          s.tax_minor,
          s.total_minor,
          s.payment_method,
          s.paid_minor,
          s.change_minor,
          s.cashier_id,
          s.customer_id,
          s.client_created_at,
          s.server_created_at,
          COALESCE(ik.idempotency_key, s.id::text) as idempotency_key
        FROM sales s
        LEFT JOIN idempotency_keys ik
          ON ik.business_id = s.business_id
          AND (ik.response_body->>'sale_id') = s.id::text
        WHERE s.business_id = $1
          AND s.server_created_at > $2${branchCondition}
        ORDER BY s.server_created_at ASC
        LIMIT $3
      `
      const salesResult = await client.query(salesSql, params)

      const hasMore = salesResult.rows.length > limit
      const salesRows = hasMore ? salesResult.rows.slice(0, limit) : salesResult.rows

      if (salesRows.length === 0) {
        return { sales: [], has_more: false }
      }

      const saleIds = salesRows.map((r: any) => r.id)

      const itemsSql = `
        SELECT
          sale_id,
          product_id,
          product_name,
          quantity,
          unit_price_minor
        FROM sale_items
        WHERE sale_id = ANY($1::uuid[])
      `
      const itemsResult = await client.query(itemsSql, [saleIds])

      const itemsBySaleId = new Map<string, any[]>()
      for (const item of itemsResult.rows) {
        if (!itemsBySaleId.has(item.sale_id)) {
          itemsBySaleId.set(item.sale_id, [])
        }
        itemsBySaleId.get(item.sale_id)!.push(item)
      }

      const sales = salesRows.map((row: any) => ({
        id: row.id,
        idempotency_key: row.idempotency_key,
        branch_id: row.branch_id ?? null,
        receipt_number: row.receipt_number,
        subtotal_minor: row.subtotal_minor ? Number(row.subtotal_minor) : 0,
        discount_minor: row.discount_minor ? Number(row.discount_minor) : 0,
        tax_minor: row.tax_minor ? Number(row.tax_minor) : 0,
        grand_total_minor: Number(row.total_minor),
        payment_method: row.payment_method,
        cash_received_minor: row.paid_minor ? Number(row.paid_minor) : 0,
        change_minor: row.change_minor ? Number(row.change_minor) : 0,
        cashier_id: row.cashier_id,
        customer_id: row.customer_id,
        client_created_at: new Date(row.client_created_at || row.server_created_at).getTime(),
        server_created_at: new Date(row.server_created_at).getTime(),
        items: (itemsBySaleId.get(row.id) || []).map((item: any) => ({
          product_id: item.product_id ?? null,
          product_name_snapshot: item.product_name,
          quantity: Number(item.quantity),
          unit_price_minor: Number(item.unit_price_minor)
        }))
      }))

      return { sales, has_more: hasMore }
    }
}