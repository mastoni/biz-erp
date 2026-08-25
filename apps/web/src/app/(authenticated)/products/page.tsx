'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { getProducts } from '@/features/products/api';
import { Product } from '@/features/products/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';

export default function ProductsPage() {
  const router = useRouter();
  const { business } = useAuth();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const fetchProducts = async (afterVersion = 0, isLoadMore = false) => {
    if (!business?.id) return;
    
    try {
      if (isLoadMore) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      
      const res = await getProducts(business.id, afterVersion, 100);
      
      if (isLoadMore) {
        setProducts(prev => [...prev, ...res.items]);
      } else {
        setProducts(res.items);
      }
      
      setCurrentVersion(res.current_version);
      setHasMore(res.has_more);
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.message || err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load products');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (business?.id) {
      const load = async () => {
        try {
          const res = await getProducts(business.id, 0, 100);
          if (!active) return;
          setProducts(res.items);
          setCurrentVersion(res.current_version);
          setHasMore(res.has_more);
          setLoading(false);
        } catch (err: unknown) {
          if (!active) return;
          if (err instanceof AxiosError) {
            setError(err.response?.data?.message || err.message);
          } else if (err instanceof Error) {
            setError(err.message);
          } else {
            setError('Failed to load products');
          }
          setLoading(false);
        }
      };
      load();
    }
    return () => { active = false; };
  }, [business?.id]);

  const filteredProducts = products.filter(p => {
    if (filter === 'ACTIVE') return p.is_active;
    if (filter === 'INACTIVE') return !p.is_active;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Products</h2>
          <p className="text-zinc-600 mt-1">Manage your product catalog</p>
        </div>
        <Button onClick={() => router.push('/products/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="status-filter" className="text-sm font-medium text-zinc-700">Status:</label>
        <select 
          id="status-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
          className="border-zinc-200 border rounded-md text-sm py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-zinc-900"
        >
          <option value="ALL">All Products</option>
          <option value="ACTIVE">Active Only</option>
          <option value="INACTIVE">Inactive Only</option>
        </select>
        <Button variant="outline" size="sm" onClick={() => fetchProducts(0)} className="ml-auto" disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="bg-white border border-zinc-200 rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-zinc-500">
                  <div className="flex justify-center items-center">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading products...
                  </div>
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-red-500">
                  {error}
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-zinc-500">
                  {products.length === 0 ? 'No products found. Create one to get started.' : 'No products match the selected filter.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map(product => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.category || '-'}</TableCell>
                  <TableCell>{product.price_minor}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-700'}`}>
                      {product.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/products/${product.id}`)}>Edit</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {hasMore && (
        <div className="flex justify-center mt-4">
          <Button variant="outline" onClick={() => fetchProducts(currentVersion, true)} disabled={loadingMore}>
            {loadingMore ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</> : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}
