import { Pool, PoolClient } from 'pg'
import { withTransaction } from '../db/transaction'
import { ReportDateRange, ReportResponse, SalesSummaryReport, ProductSalesReport, CustomerSalesReport } from '../dto/report_dto'

export function createReportService(pool: Pool) {
  return {
    async getSalesSummary(businessId: string, dateRange: ReportDateRange): Promise<SalesSummaryReport> {
      return withTransaction(pool, async (client) => {
        const summaryResult = await client.query(
          `SELECT
            COUNT(*) as total_sales,
            COALESCE(SUM(total_minor), 0) as total_revenue_minor,
            COALESCE(SUM(
              (SELECT SUM(quantity) FROM sale_items WHERE sale_id = sales.id)
            ), 0) as total_items_sold,
            COALESCE(AVG(total_minor), 0) as average_order_value_minor
           FROM sales
           WHERE business_id = $1
             AND created_at >= $2
             AND created_at <= $3`,
          [businessId, dateRange.from, dateRange.to]
        )

        const paymentMethodsResult = await client.query(
          `SELECT
            payment_method,
            COUNT(*) as count,
            COALESCE(SUM(total_minor), 0) as total_minor
           FROM sales
           WHERE business_id = $1
             AND created_at >= $2
             AND created_at <= $3
             AND payment_method IS NOT NULL
           GROUP BY payment_method
           ORDER BY total_minor DESC`,
          [businessId, dateRange.from, dateRange.to]
        )

        const row = summaryResult.rows[0]

        return {
          total_sales: Number(row.total_sales),
          total_revenue_minor: Number(row.total_revenue_minor),
          total_items_sold: Number(row.total_items_sold),
          average_order_value_minor: Number(row.average_order_value_minor),
          payment_methods: paymentMethodsResult.rows.map((pm) => ({
            payment_method: pm.payment_method,
            count: Number(pm.count),
            total_minor: Number(pm.total_minor),
          })),
        }
      })
    },

    async getProductSales(businessId: string, dateRange: ReportDateRange): Promise<ProductSalesReport[]> {
      return withTransaction(pool, async (client) => {
        const result = await client.query(
          `SELECT
            si.product_id,
            si.product_name,
            SUM(si.quantity) as total_quantity,
            COALESCE(SUM(si.subtotal_minor), 0) as total_revenue_minor
           FROM sale_items si
           JOIN sales s ON s.id = si.sale_id
           WHERE s.business_id = $1
             AND s.created_at >= $2
             AND s.created_at <= $3
           GROUP BY si.product_id, si.product_name
           ORDER BY total_quantity DESC`,
          [businessId, dateRange.from, dateRange.to]
        )

        return result.rows.map((row) => ({
          product_id: row.product_id,
          product_name: row.product_name,
          total_quantity: Number(row.total_quantity),
          total_revenue_minor: Number(row.total_revenue_minor),
        }))
      })
    },

    async getCustomerSales(businessId: string, dateRange: ReportDateRange): Promise<CustomerSalesReport[]> {
      return withTransaction(pool, async (client) => {
        const result = await client.query(
          `SELECT
            s.customer_id,
            c.name as customer_name,
            COUNT(*) as total_purchases,
            COALESCE(SUM(s.total_minor), 0) as total_spent_minor
           FROM sales s
           LEFT JOIN customers c ON c.id = s.customer_id
           WHERE s.business_id = $1
             AND s.created_at >= $2
             AND s.created_at <= $3
           GROUP BY s.customer_id, c.name
           ORDER BY total_spent_minor DESC`,
          [businessId, dateRange.from, dateRange.to]
        )

        return result.rows.map((row) => ({
          customer_id: row.customer_id,
          customer_name: row.customer_name,
          total_purchases: Number(row.total_purchases),
          total_spent_minor: Number(row.total_spent_minor),
        }))
      })
    },
  }
}
