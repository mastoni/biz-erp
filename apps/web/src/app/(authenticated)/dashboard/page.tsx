'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMinor } from '@/lib/format';
import { TrendingUp, Receipt, Package, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';

interface DashboardMetrics {
  total_revenue_minor: number;
  total_sales: number;
  total_customers: number;
  total_products: number;
  out_of_stock_count: number;
  top_products: Array<{
    product_id: string;
    product_name: string;
    quantity_sold: number;
  }>;
}

export default function DashboardPage() {
  const { user, business, role } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    api.get('/v1/dashboard')
      .then((response) => {
        if (active) {
          setMetrics(response.data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || 'Gagal memuat dashboard.');
        setLoading(false);
      });

    return () => { active = false; };
  }, [business?.id]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold tracking-tight text-ink">Dashboard</h2>
        <p className="text-ink/60 mt-1">
          Selamat datang kembali, <span className="font-medium text-ink">{user?.email}</span> di <span className="font-medium text-ink">{business?.name}</span>.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Gagal memuat dashboard</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-2 border-ink/10">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : metrics ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-2 border-ink/10 bg-card shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-ink/60 uppercase tracking-wider">Penjualan Hari Ini</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-display font-bold text-ink tabular-nums">{formatMinor(metrics.total_revenue_minor)}</div>
                <p className="text-xs text-ink/50 mt-1 flex items-center gap-1">
                  <Receipt className="h-3 w-3" /> {metrics.total_sales.toLocaleString('id-ID')} transaksi
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-ink/10 bg-card shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-ink/60 uppercase tracking-wider">Jumlah Transaksi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-display font-bold text-ink tabular-nums">{metrics.total_sales.toLocaleString('id-ID')}</div>
                <p className="text-xs text-ink/50 mt-1">Transaksi hari ini</p>
              </CardContent>
            </Card>

            {role === 'OWNER' && (
              <>
                <Card className="border-2 border-ink/10 bg-card shadow-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-ink/60 uppercase tracking-wider">Produk Aktif</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-display font-bold text-ink tabular-nums">{metrics.total_products.toLocaleString('id-ID')}</div>
                    <p className="text-xs text-ink/50 mt-1">Produk yang tersedia</p>
                  </CardContent>
                </Card>

                <Card className="border-2 border-ink/10 bg-card shadow-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-ink/60 uppercase tracking-wider flex items-center gap-2">
                      Stok Habis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-display font-bold text-brick tabular-nums">{metrics.out_of_stock_count.toLocaleString('id-ID')}</div>
                    <p className="text-xs text-ink/50 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Produk dengan stok 0
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {role === 'OWNER' && metrics.top_products.length > 0 && (
            <Card className="border-2 border-ink/10 bg-card">
              <CardHeader>
                <CardTitle className="font-display font-medium text-ink flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Produk Terlaris
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-ink/10 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-ink/5">
                        <TableHead className="text-ink font-medium">Produk</TableHead>
                        <TableHead className="text-ink font-medium text-right">Terjual</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.top_products.map((product) => (
                        <TableRow key={product.product_id} className="hover:bg-ink/5">
                          <TableCell className="font-medium text-ink">{product.product_name}</TableCell>
                          <TableCell className="text-right tabular-nums">{product.quantity_sold.toLocaleString('id-ID')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card className="border-2 border-ink/10 bg-card">
          <CardContent className="py-12 text-center text-ink/40">
            <p>Tidak ada data untuk ditampilkan.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
