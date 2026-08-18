'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { createProduct } from '@/features/products/api';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { AxiosError } from 'axios';

export default function NewProductPage() {
  const router = useRouter();
  const { business } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    price_minor: '',
    description: '',
    category: '',
    barcode: '',
    is_active: true
  });

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
      setLoading(true);
      setError(null);

      const id = crypto.randomUUID();
      const idempotencyKey = crypto.randomUUID();

      await createProduct({
        id,
        business_id: business.id,
        name: formData.name.trim(),
        price_minor: price,
        description: formData.description.trim() || null,
        category: formData.category.trim() || null,
        barcode: formData.barcode.trim() || null,
        is_active: formData.is_active
      }, idempotencyKey);

      router.push('/products');
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.message || err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create product');
      }
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" type="button" onClick={() => router.push('/products')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Add New Product</h2>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md border border-red-200">
          {error}
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
            placeholder="e.g. Kopi Susu Aren"
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
            placeholder="0"
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
            placeholder="e.g. Beverages"
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
            placeholder="Scan or type barcode"
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
          />
          <label htmlFor="is_active" className="text-sm font-medium text-zinc-700">
            Active (Available for sale)
          </label>
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <Button variant="outline" type="button" onClick={() => router.push('/products')} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Product
          </Button>
        </div>
      </form>
    </div>
  );
}
