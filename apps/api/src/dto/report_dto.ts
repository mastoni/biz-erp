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

export interface ReportResponse {
  sales_summary?: SalesSummaryReport
  product_sales?: ProductSalesReport[]
  customer_sales?: CustomerSalesReport[]
  hourly_sales?: HourlySalesResponse
}
