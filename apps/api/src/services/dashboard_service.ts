import { Pool, PoolClient } from 'pg'
import { withTransaction } from '../db/transaction'
import { DashboardMetrics, DateRangeQuery } from '../dto/dashboard_dto'

export function createDashboardService(pool: Pool) {
  return {
    async getMetrics(businessId: string, query: DateRangeQuery): Promise<DashboardMetrics> {
      return withTransaction(pool, async (client) => {
        const dateFilter = buildDateFilter(query)
        const dateParams = dateFilter.params

        const salesFilter = `sales.business_id = $1${dateFilter.sql ? ` AND ${dateFilter.sql}` : ''}`
        const customerFilter = `business_id = $1${dateFilter.sql ? ` AND ${dateFilter.sql.replace('sales.created_at', 'customers.created_at')}` : ''}`
        const productFilter = `business_id = $1`

        const revenueResult = await client.query(
          `SELECT COALESCE(SUM(total_minor), 0) as total_revenue
           FROM sales
           WHERE ${salesFilter}`,
          [businessId, ...dateParams]
        )

        const totalSalesResult = await client.query(
          `SELECT COUNT(*) as total_sales
           FROM sales
           WHERE ${salesFilter}`,
          [businessId, ...dateParams]
        )

        const totalCustomersResult = await client.query(
          `SELECT COUNT(*) as total_customers
           FROM customers
           WHERE ${customerFilter} AND deleted_at IS NULL`,
          [businessId, ...dateParams]
        )

        const totalProductsResult = await client.query(
          `SELECT COUNT(*) as total_products
           FROM products
           WHERE ${productFilter} AND is_active = TRUE`,
          [businessId]
        )

        const outOfStockResult = await client.query(
          `SELECT COUNT(*) as out_of_stock_count
           FROM stocks
           WHERE business_id = $1
             AND quantity = 0`,
          [businessId]
        )

        const topProductsResult = await client.query(
          `SELECT si.product_id, si.product_name, SUM(si.quantity) as quantity_sold
           FROM sale_items si
           JOIN sales s ON s.id = si.sale_id
           WHERE ${salesFilter}
           GROUP BY si.product_id, si.product_name
           ORDER BY quantity_sold DESC
           LIMIT 5`,
          [businessId, ...dateParams]
        )

        return {
          total_revenue_minor: Number(revenueResult.rows[0].total_revenue),
          total_sales: Number(totalSalesResult.rows[0].total_sales),
          total_customers: Number(totalCustomersResult.rows[0].total_customers),
          total_products: Number(totalProductsResult.rows[0].total_products),
          out_of_stock_count: Number(outOfStockResult.rows[0].out_of_stock_count),
          top_products: topProductsResult.rows.map((row) => ({
            product_id: row.product_id,
            product_name: row.product_name,
            quantity_sold: Number(row.quantity_sold),
          })),
        }
      })
    },
  }
}

function buildDateFilter(query: DateRangeQuery): { sql: string; params: string[] } {
  if (!query.from && !query.to) {
    return { sql: '', params: [] }
  }

  const conditions: string[] = []
  const params: string[] = []

  if (query.from) {
    params.push(query.from)
    conditions.push(`sales.created_at >= $${params.length}`)
  }

  if (query.to) {
    params.push(query.to)
    conditions.push(`sales.created_at <= $${params.length}`)
  }

  return { sql: conditions.join(' AND '), params }
}
