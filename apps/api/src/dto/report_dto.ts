export interface ReportDateRange {
  from: string
  to: string
  branch_id?: string
}

export interface SalesSummaryReport {
  total_sales: number
  total_revenue_minor: number
  total_items_sold: number
  average_order_value_minor: number
  payment_methods: Array<{
    payment_method: string
    count: number
    total_minor: number
  }>
}

export interface ProductSalesReport {
  product_id: string
  product_name: string
  category: string | null
  total_quantity: number
  total_revenue_minor: number
}

export interface CustomerSalesReport {
  customer_id?: string
  customer_name: string
  total_purchases: number
  total_spent_minor: number
}

export interface HourlySalesBucket {
  hour: number
  total_revenue_minor: number
  transaction_count: number
}

export interface HourlySalesResponse {
  buckets: HourlySalesBucket[]
}

export interface RecentSaleItem {
  id: string
  receipt_number: string
  total_minor: number
  payment_method: string | null
  cashier_id: string | null
  created_at: string
  branch_id: string | null
}

export interface RecentSalesResponse {
  sales: RecentSaleItem[]
}

export interface RecentSalesQuery {
  branch_id?: string
  limit?: number
}

export interface DailySalesPoint {
  date: string
  total_revenue_minor: number
  transaction_count: number
}

export interface DailySalesResponse {
  points: DailySalesPoint[]
}

export interface ReportResponse {
  sales_summary?: SalesSummaryReport
  product_sales?: ProductSalesReport[]
  customer_sales?: CustomerSalesReport[]
  hourly_sales?: HourlySalesResponse
  recent_sales?: RecentSalesResponse
  daily_sales?: DailySalesResponse
}
