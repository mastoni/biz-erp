'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { getProducts, updateProduct, getConflictDetails } from '@/features/products/api';
import { Product } from '@/features/products/types';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import { AxiosError } from 'axios';

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;
  const { business } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<{ message: string; latestVersion: number; currentProduct: Product } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    price_minor: '',
    description: '',
    category: '',
    barcode: '',
    is_active: true
  });
  
  const [expectedVersion, setExpectedVersion] = useState(1);

  const populateForm = (product: Product) => {
    setFormData({
      name: product.name,
      price_minor: product.price_minor.toString(),
      description: product.description || '',
      category: product.category || '',
      barcode: product.barcode || '',
      is_active: product.is_active
    });
    setExpectedVersion(product.server_version);
  };

  useEffect(() => {
    let active = true;
    if (business?.id && productId) {
      const fetchProduct = async () => {
        try {
          let afterVersion = 0;
          let found: Product | null = null;
          let hasMore = true;

          while (hasMore && !found) {
            const res = await getProducts(business.id, afterVersion, 500);
            found = res.items.find(p => p.id === productId) || null;
            afterVersion = res.current_version;
            hasMore = res.has_more;
          }

          if (!active) return;
          if (found) {
            populateForm(found);
          } else {
            setError('Product not found in your catalog.');
          }
        } catch (err: unknown) {
          if (!active) return;
          if (err instanceof AxiosError) {
            setError(err.response?.data?.message || err.message);
          } else if (err instanceof Error) {
            setError(err.message);
          } else {
            setError('Failed to load product');
          }
        } finally {
          if (active) setLoading(false);
        }
      };
      fetchProduct();
    }
    return () => { active = false; };
  }, [business?.id, productId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business?.id) return;

    if (!formData.name.trim()) {
      setError('Product name is required');
      return;
    }
    
    const price = parseInt(formData.price_minor, 10);
    if (isNaN(price) || price < 0) {
      setError('Price must be a valid non-negative number');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setConflictError(null);

      await updateProduct(productId, {
        business_id: business.id,
        expected_server_version: expectedVersion,
        name: formData.name.trim(),
        price_minor: price,
        description: formData.description.trim() || null,
        category: formData.category.trim() || null,
        barcode: formData.barcode.trim() || null,
        is_active: formData.is_active
      });

      router.push('/products');
      router.refresh();
    } catch (err: unknown) {
      const conflict = getConflictDetails(err);
      if (conflict) {
        setConflictError({
          message: 'Product was modified by another user/device while you were editing.',
          latestVersion: conflict.details.current_server_version,
          currentProduct: conflict.details.current_product
        });
      } else {
        if (err instanceof AxiosError) {
          setError(err.response?.data?.message || err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to update product');
        }
      }
      setSubmitting(false);
    }
  };

  const handleResolveConflict = () => {
    if (conflictError?.currentProduct) {
      populateForm(conflictError.currentProduct);
      setConflictError(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-zinc-500">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading product details...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" type="button" onClick={() => router.push('/products')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Edit Product</h2>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md border border-red-200">
          {error}
        </div>
      )}

      {conflictError && (
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md border border-yellow-200">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold">Version Conflict Detected</h3>
              <p className="mt-1 text-sm">{conflictError.message}</p>
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={handleResolveConflict} className="bg-white">
                  Load Latest Data
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 rounded-md p-6 space-y-4">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-zinc-700">Product Name *</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full border-zinc-200 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!!conflictError}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="price_minor" className="text-sm font-medium text-zinc-700">Price *</label>
          <input
            id="price_minor"
            name="price_minor"
            type="number"
            min="0"
            required
            value={formData.price_minor}
            onChange={handleChange}
            className="w-full border-zinc-200 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!!conflictError}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="category" className="text-sm font-medium text-zinc-700">Category</label>
          <input
            id="category"
            name="category"
            type="text"
            value={formData.category}
            onChange={handleChange}
            className="w-full border-zinc-200 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!!conflictError}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="barcode" className="text-sm font-medium text-zinc-700">Barcode</label>
          <input
            id="barcode"
            name="barcode"
            type="text"
            value={formData.barcode}
            onChange={handleChange}
            className="w-full border-zinc-200 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!!conflictError}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="description" className="text-sm font-medium text-zinc-700">Description</label>
          <textarea
            id="description"
            name="description"
            rows={3}
            value={formData.description}
            onChange={handleChange}
            className="w-full border-zinc-200 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!!conflictError}
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            id="is_active"
            name="is_active"
            type="checkbox"
            checked={formData.is_active}
            onChange={handleChange}
            className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
            disabled={!!conflictError}
          />
          <label htmlFor="is_active" className="text-sm font-medium text-zinc-700">
            Active (Available for sale)
          </label>
        </div>
        
        <div className="text-xs text-zinc-500 pt-2">
          Current Server Version: {expectedVersion}
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <Button variant="outline" type="button" onClick={() => router.push('/products')} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !!conflictError || !!error}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
