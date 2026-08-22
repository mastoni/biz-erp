import { api } from '@/lib/api';

export interface SalesSummaryReport {
  total_sales: number;
  total_revenue_minor: number;
  total_items_sold: number;
  average_order_value_minor: number;
  payment_methods: Array<{
    payment_method: string;
    count: number;
    total_minor: number;
  }>;
}

export interface ProductSalesReport {
  product_id: string;
  product_name: string;
  total_quantity: number;
  total_revenue_minor: number;
}

export interface CustomerSalesReport {
  customer_id?: string;
  customer_name: string;
  total_purchases: number;
  total_spent_minor: number;
}

export async function getSalesSummary(from: string, to: string): Promise<{ sales_summary: SalesSummaryReport }> {
  const response = await api.get('/v1/reports/sales-summary', { params: { from, to } });
  return response.data;
}

export async function getProductSales(from: string, to: string): Promise<{ product_sales: ProductSalesReport[] }> {
  const response = await api.get('/v1/reports/product-sales', { params: { from, to } });
  return response.data;
}

export async function getCustomerSales(from: string, to: string): Promise<{ customer_sales: CustomerSalesReport[] }> {
  const response = await api.get('/v1/reports/customer-sales', { params: { from, to } });
  return response.data;
}
