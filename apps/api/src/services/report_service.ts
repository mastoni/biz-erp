import { Pool } from 'pg'
import { withTransaction } from '../db/transaction'
import {
  ReportDateRange,
  SalesSummaryReport,
  ProductSalesReport,
  CustomerSalesReport,
  HourlySalesResponse,
  HourlySalesBucket,
  RecentSalesQuery,
  RecentSalesResponse,
  RecentSaleItem,
  DailySalesResponse,
  DailySalesPoint,
} from '../dto/report_dto'
import { branchRepository } from '../repositories/branch_repository'
import { ApiError } from '../errors/api_error'

export function createReportService(pool: Pool) {
  return {
    async getSalesSummary(businessId: string, dateRange: ReportDateRange): Promise<SalesSummaryReport> {
      return withTransaction(pool, async (client) => {
        if (dateRange.branch_id) {
          const branch = await branchRepository.findById(client, businessId, dateRange.branch_id)
          if (!branch) {
            throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Branch not found or access denied')
          }
        }

        const branchCondition = dateRange.branch_id ? ` AND sales.branch_id = $4` : ''
        const params = dateRange.branch_id
          ? [businessId, dateRange.from, dateRange.to, dateRange.branch_id]
          : [businessId, dateRange.from, dateRange.to]

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
             AND created_at <= $3${branchCondition}`,
          params
        )

        const paymentMethodsResult = await client.query(
          `SELECT
            payment_method,
            COUNT(*) as count,
            COALESCE(SUM(total_minor), 0) as total_minor
           FROM sales
           WHERE business_id = $1
             AND created_at >= $2
             AND created_at <= $3${branchCondition}
             AND payment_method IS NOT NULL
           GROUP BY payment_method
           ORDER BY total_minor DESC`,
          params
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
        if (dateRange.branch_id) {
          const branch = await branchRepository.findById(client, businessId, dateRange.branch_id)
          if (!branch) {
            throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Branch not found or access denied')
          }
        }

        const branchCondition = dateRange.branch_id ? ` AND s.branch_id = $4` : ''
        const params = dateRange.branch_id
          ? [businessId, dateRange.from, dateRange.to, dateRange.branch_id]
          : [businessId, dateRange.from, dateRange.to]

        const result = await client.query(
          `SELECT
            si.product_id,
            si.product_name,
            p.category,
            SUM(si.quantity) as total_quantity,
            COALESCE(SUM(si.subtotal_minor), 0) as total_revenue_minor
           FROM sale_items si
           JOIN sales s ON s.id = si.sale_id
           LEFT JOIN products p ON p.id = si.product_id AND p.business_id = s.business_id
           WHERE s.business_id = $1
             AND s.created_at >= $2
             AND s.created_at <= $3${branchCondition}
           GROUP BY si.product_id, si.product_name, p.category
           ORDER BY total_quantity DESC, total_revenue_minor DESC, si.product_id ASC`,
          params
        )

        return result.rows.map((row) => ({
          product_id: row.product_id,
          product_name: row.product_name,
          category: row.category ?? null,
          total_quantity: Number(row.total_quantity),
          total_revenue_minor: Number(row.total_revenue_minor),
        }))
      })
    },

    async getCustomerSales(businessId: string, dateRange: ReportDateRange): Promise<CustomerSalesReport[]> {
      return withTransaction(pool, async (client) => {
        if (dateRange.branch_id) {
          const branch = await branchRepository.findById(client, businessId, dateRange.branch_id)
          if (!branch) {
            throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Branch not found or access denied')
          }
        }

        const branchCondition = dateRange.branch_id ? ` AND s.branch_id = $4` : ''
        const params = dateRange.branch_id
          ? [businessId, dateRange.from, dateRange.to, dateRange.branch_id]
          : [businessId, dateRange.from, dateRange.to]

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
             AND s.created_at <= $3${branchCondition}
           GROUP BY s.customer_id, c.name
           ORDER BY total_spent_minor DESC`,
          params
        )

        return result.rows.map((row) => ({
          customer_id: row.customer_id,
          customer_name: row.customer_name,
          total_purchases: Number(row.total_purchases),
          total_spent_minor: Number(row.total_spent_minor),
        }))
      })
    },

    async getHourlySales(businessId: string, dateRange: ReportDateRange): Promise<HourlySalesResponse> {
      return withTransaction(pool, async (client) => {
        if (dateRange.branch_id) {
          const branch = await branchRepository.findById(client, businessId, dateRange.branch_id)
          if (!branch) {
            throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Branch not found or access denied')
          }
        }

        const branchCondition = dateRange.branch_id ? ` AND sales.branch_id = $4` : ''
        const params = dateRange.branch_id
          ? [businessId, dateRange.from, dateRange.to, dateRange.branch_id]
          : [businessId, dateRange.from, dateRange.to]

        const result = await client.query(
          `SELECT
            EXTRACT(HOUR FROM created_at)::INTEGER as hour,
            COALESCE(SUM(total_minor), 0) as total_revenue_minor,
            COUNT(*) as transaction_count
           FROM sales
           WHERE business_id = $1
             AND created_at >= $2
             AND created_at <= $3${branchCondition}
           GROUP BY EXTRACT(HOUR FROM created_at)
           ORDER BY hour ASC`,
          params
        )

        const bucketMap = new Map<number, { total_revenue_minor: number; transaction_count: number }>()
        for (const row of result.rows) {
          bucketMap.set(Number(row.hour), {
            total_revenue_minor: Number(row.total_revenue_minor),
            transaction_count: Number(row.transaction_count),
          })
        }

        const buckets: HourlySalesBucket[] = []
        for (let h = 0; h < 24; h++) {
          const data = bucketMap.get(h)
          buckets.push({
            hour: h,
            total_revenue_minor: data ? data.total_revenue_minor : 0,
            transaction_count: data ? data.transaction_count : 0,
          })
        }

        return { buckets }
      })
    },

    async getRecentSales(businessId: string, query: RecentSalesQuery): Promise<RecentSalesResponse> {
      return withTransaction(pool, async (client) => {
        if (query.branch_id) {
          const branch = await branchRepository.findById(client, businessId, query.branch_id)
          if (!branch) {
            throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Branch not found or access denied')
          }
        }

        const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 50) : 10
        const branchCondition = query.branch_id ? ` AND sales.branch_id = $2` : ''
        const params = query.branch_id
          ? [businessId, query.branch_id, limit]
          : [businessId, limit]

        const limitParamIndex = query.branch_id ? '$3' : '$2'

        const result = await client.query(
          `SELECT
            id,
            receipt_number,
            total_minor,
            payment_method,
            cashier_id,
            created_at,
            branch_id
           FROM sales
           WHERE business_id = $1${branchCondition}
           ORDER BY created_at DESC, id DESC
           LIMIT ${limitParamIndex}`,
          params
        )

        const sales: RecentSaleItem[] = result.rows.map((row) => ({
          id: row.id,
          receipt_number: row.receipt_number,
          total_minor: Number(row.total_minor),
          payment_method: row.payment_method ?? null,
          cashier_id: row.cashier_id ?? null,
          created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
          branch_id: row.branch_id ?? null,
        }))

        return { sales }
      })
    },

    async getDailySales(businessId: string, dateRange: ReportDateRange): Promise<DailySalesResponse> {
      return withTransaction(pool, async (client) => {
        if (dateRange.branch_id) {
          const branch = await branchRepository.findById(client, businessId, dateRange.branch_id)
          if (!branch) {
            throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Branch not found or access denied')
          }
        }

        const branchCondition = dateRange.branch_id ? ` AND sales.branch_id = $4` : ''
        const params = dateRange.branch_id
          ? [businessId, dateRange.from, dateRange.to, dateRange.branch_id]
          : [businessId, dateRange.from, dateRange.to]

        const result = await client.query(
          `SELECT
            TO_CHAR(created_at, 'YYYY-MM-DD') as date_str,
            COALESCE(SUM(total_minor), 0) as total_revenue_minor,
            COUNT(*) as transaction_count
           FROM sales
           WHERE business_id = $1
             AND created_at >= $2
             AND created_at <= $3${branchCondition}
           GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
           ORDER BY date_str ASC`,
          params
        )

        const dateMap = new Map<string, { total_revenue_minor: number; transaction_count: number }>()
        for (const row of result.rows) {
          dateMap.set(row.date_str, {
            total_revenue_minor: Number(row.total_revenue_minor),
            transaction_count: Number(row.transaction_count),
          })
        }

        const fromDateStr = dateRange.from.split('T')[0]
        const toDateStr = dateRange.to.split('T')[0]

        const [fromY, fromM, fromD] = fromDateStr.split('-').map(Number)
        const [toY, toM, toD] = toDateStr.split('-').map(Number)

        const startUtc = new Date(Date.UTC(fromY, fromM - 1, fromD))
        const endUtc = new Date(Date.UTC(toY, toM - 1, toD))

        const points: DailySalesPoint[] = []
        const currentUtc = new Date(startUtc.getTime())

        while (currentUtc <= endUtc) {
          const dStr = currentUtc.toISOString().split('T')[0]
          const existing = dateMap.get(dStr)
          points.push({
            date: dStr,
            total_revenue_minor: existing ? existing.total_revenue_minor : 0,
            transaction_count: existing ? existing.transaction_count : 0,
          })
          currentUtc.setUTCDate(currentUtc.getUTCDate() + 1)
        }

        return { points }
      })
    },
  }
}
