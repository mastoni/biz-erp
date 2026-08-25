export interface DashboardMetrics {
  total_revenue_minor: number
  total_sales: number
  total_customers: number
  total_products: number
  out_of_stock_count: number
  top_products: Array<{
    product_id: string
    product_name: string
    quantity_sold: number
  }>
}

export interface DateRangeQuery {
  from?: string
  to?: string
  branch_id?: string
}
