import { Pool } from 'pg'
import { withTransaction } from '../db/transaction'
import { DashboardMetrics, DateRangeQuery } from '../dto/dashboard_dto'
import { branchRepository } from '../repositories/branch_repository'
import { ApiError } from '../errors/api_error'

export function createDashboardService(pool: Pool) {
  return {
    async getMetrics(businessId: string, query: DateRangeQuery): Promise<DashboardMetrics> {
      return withTransaction(pool, async (client) => {
        if (query.branch_id) {
          const branch = await branchRepository.findById(client, businessId, query.branch_id)
          if (!branch) {
            throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Branch not found or access denied')
          }
        }

        const dateFilter = buildDateFilter(query)
        const dateParams = dateFilter.params

        const branchSalesSql = query.branch_id ? ` AND sales.branch_id = $${dateParams.length + 2}` : ''
        const salesFilter = `sales.business_id = $1${dateFilter.sql ? ` AND ${dateFilter.sql}` : ''}${branchSalesSql}`
        const salesParams = query.branch_id ? [businessId, ...dateParams, query.branch_id] : [businessId, ...dateParams]

        const customerFilter = `business_id = $1${dateFilter.sql ? ` AND ${dateFilter.sql.replace('sales.created_at', 'customers.created_at')}` : ''}`
        const productFilter = `business_id = $1`

        const revenueResult = await client.query(
          `SELECT COALESCE(SUM(total_minor), 0) as total_revenue
           FROM sales
           WHERE ${salesFilter}`,
          salesParams
        )

        const totalSalesResult = await client.query(
          `SELECT COUNT(*) as total_sales
           FROM sales
           WHERE ${salesFilter}`,
          salesParams
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
           WHERE ${productFilter} AND is_active = TRUE AND deleted_at IS NULL`,
          [businessId]
        )

        const branchStockSql = query.branch_id ? ` AND branch_id = $2` : ''
        const stockParams = query.branch_id ? [businessId, query.branch_id] : [businessId]

        const outOfStockResult = await client.query(
          `SELECT COUNT(*) as out_of_stock_count
           FROM stocks
           WHERE business_id = $1
             AND quantity = 0${branchStockSql}`,
          stockParams
        )

        const topProductsResult = await client.query(
          `SELECT si.product_id, si.product_name, SUM(si.quantity) as quantity_sold
           FROM sale_items si
           JOIN sales ON sales.id = si.sale_id
           WHERE ${salesFilter}
           GROUP BY si.product_id, si.product_name
           ORDER BY quantity_sold DESC
           LIMIT 5`,
          salesParams
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
    conditions.push(`sales.created_at >= $${params.length + 1}`)
  }

  if (query.to) {
    params.push(query.to)
    conditions.push(`sales.created_at <= $${params.length + 1}`)
  }

  return { sql: conditions.join(' AND '), params }
}
