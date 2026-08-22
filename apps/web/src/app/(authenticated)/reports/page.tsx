'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { getSalesSummary, getProductSales, getCustomerSales, SalesSummaryReport, ProductSalesReport, CustomerSalesReport } from '@/features/reports/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMinor } from '@/lib/format';
import { TrendingUp, Package, Users, DollarSign } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const today = new Date().toISOString().split('T')[0];
const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

export default function ReportsPage() {
  const { business } = useAuth();
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SalesSummaryReport | null>(null);
  const [productSales, setProductSales] = useState<ProductSalesReport[]>([]);
  const [customerSales, setCustomerSales] = useState<CustomerSalesReport[]>([]);

  const fetchReports = useCallback(async () => {
    if (!business?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, productRes, customerRes] = await Promise.all([
        getSalesSummary(from, to),
        getProductSales(from, to),
        getCustomerSales(from, to),
      ]);
      setSummary(summaryRes.sales_summary);
      setProductSales(productRes.product_sales);
      setCustomerSales(customerRes.customer_sales);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Gagal memuat laporan.');
    } finally {
      setLoading(false);
    }
  }, [business?.id, from, to]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold tracking-tight text-ink">Laporan Penjualan</h2>
        <p className="text-ink/60 mt-1">Ringkasan penjualan berdasarkan rentang tanggal.</p>
      </div>

      <Card className="border-2 border-ink/10 bg-card">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="from" className="text-ink">Dari</Label>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="border-ink/15 focus:border-ink focus:ring-marigold/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to" className="text-ink">Sampai</Label>
              <Input
                id="to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="border-ink/15 focus:border-ink focus:ring-marigold/50"
              />
            </div>
            <Button onClick={fetchReports} disabled={loading} className="bg-ink text-paper hover:bg-ink-2">
              {loading ? 'Memuat...' : 'Terapkan'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-2 border-ink/10">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-2 border-ink/10 bg-card shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-ink/60 uppercase tracking-wider">Total Pendapatan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-bold text-ink">{formatMinor(summary.total_revenue_minor)}</div>
              <p className="text-xs text-ink/50 mt-1">Total penjualan</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-ink/10 bg-card shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-ink/60 uppercase tracking-wider">Total Transaksi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-bold text-ink">{summary.total_sales.toLocaleString('id-ID')}</div>
              <p className="text-xs text-ink/50 mt-1">Transaksi pada periode ini</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-ink/10 bg-card shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-ink/60 uppercase tracking-wider">Rata-rata Order</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-bold text-ink">{formatMinor(summary.average_order_value_minor)}</div>
              <p className="text-xs text-ink/50 mt-1">Nilai transaksi rata-rata</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-ink/10 bg-card shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-ink/60 uppercase tracking-wider">Item Terjual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-bold text-ink">{summary.total_items_sold.toLocaleString('id-ID')}</div>
              <p className="text-xs text-ink/50 mt-1">Total unit terjual</p>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-2 border-ink/10 bg-card">
            <CardHeader>
              <CardTitle className="font-display font-medium text-ink flex items-center gap-2">
                <Package className="h-4 w-4" />
                Produk Terlaris
              </CardTitle>
            </CardHeader>
            <CardContent>
              {productSales.length === 0 ? (
                <p className="text-sm text-ink/40 text-center py-8">Belum ada data produk untuk periode ini.</p>
              ) : (
                <div className="rounded-md border border-ink/10 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-ink/5">
                        <TableHead className="text-ink font-medium">Produk</TableHead>
                        <TableHead className="text-ink font-medium text-right">Qty</TableHead>
                        <TableHead className="text-ink font-medium text-right">Pendapatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productSales.map((product) => (
                        <TableRow key={product.product_id} className="hover:bg-ink/5">
                          <TableCell className="font-medium text-ink">{product.product_name}</TableCell>
                          <TableCell className="text-right tabular-nums">{product.total_quantity.toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMinor(product.total_revenue_minor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-2 border-ink/10 bg-card">
            <CardHeader>
              <CardTitle className="font-display font-medium text-ink flex items-center gap-2">
                <Users className="h-4 w-4" />
                Pelanggan Terbaik
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customerSales.length === 0 ? (
                <p className="text-sm text-ink/40 text-center py-8">Belum ada data pelanggan untuk periode ini.</p>
              ) : (
                <div className="rounded-md border border-ink/10 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-ink/5">
                        <TableHead className="text-ink font-medium">Pelanggan</TableHead>
                        <TableHead className="text-ink font-medium text-right">Transaksi</TableHead>
                        <TableHead className="text-ink font-medium text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerSales.map((customer) => (
                        <TableRow key={customer.customer_id ?? 'walk-in'} className="hover:bg-ink/5">
                          <TableCell className="font-medium text-ink">
                            {customer.customer_name}
                            {!customer.customer_id && (
                              <span className="ml-2 text-xs text-ink/50">(Umum)</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{customer.total_purchases.toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMinor(customer.total_spent_minor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
