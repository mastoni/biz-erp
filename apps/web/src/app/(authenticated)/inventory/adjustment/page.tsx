'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import {
  getBranches,
  getStocks,
  postAdjustment,
  isConflictError,
  isClientValidationError,
  getApiErrorMessage,
} from '@/features/inventory/api';
import { getProducts } from '@/features/products/api';
import { Branch, Stock } from '@/features/inventory/types';
import { Product } from '@/features/products/types';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

type FormStatus = 'idle' | 'loading' | 'success' | 'conflict' | 'error';

export default function AdjustmentPage() {
  const { business } = useAuth();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [currentStock, setCurrentStock] = useState<Stock | null>(null);
  const [quantityChange, setQuantityChange] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadingInit, setLoadingInit] = useState(true);

  // Idempotency key is bound to the current logical submission attempt.
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());
  const generateNewIdempotencyKey = () => { idempotencyKeyRef.current = crypto.randomUUID(); };

  useEffect(() => {
    if (!business?.id) return;
    let active = true;

    const load = async () => {
      setLoadingInit(true);
      try {
        const [branchItems, productRes] = await Promise.all([
          getBranches(business.id),
          getProducts(business.id, 0, 200),
        ]);
        if (!active) return;
        const activeBranches = branchItems.filter((b) => b.status);
        const activeProducts = productRes.items.filter((p) => p.is_active);
        setBranches(activeBranches);
        setProducts(activeProducts);
        if (activeBranches.length > 0) setSelectedBranchId(activeBranches[0].id);
        if (activeProducts.length > 0) setSelectedProductId(activeProducts[0].id);
      } catch (err) {
        if (!active) return;
        setStatus('error');
        setErrorMessage(getApiErrorMessage(err, 'Failed to load initial data'));
      } finally {
        if (active) setLoadingInit(false);
      }
    };

    load();
    return () => { active = false; };
  }, [business?.id]);

  const refreshCurrentStock = useCallback(() => {
    if (!business?.id || !selectedBranchId || !selectedProductId) return;
    let active = true;

    const load = async () => {
      try {
        const items = await getStocks(business.id, selectedBranchId);
        if (!active) return;
        const found = items.find((s) => s.product_id === selectedProductId) ?? null;
        setCurrentStock(found);
      } catch {
        if (active) setCurrentStock(null);
      }
    };

    load();
    return () => { active = false; };
  }, [business, selectedBranchId, selectedProductId]);

  useEffect(() => {
    const cleanup = refreshCurrentStock();
    return cleanup;
  }, [refreshCurrentStock]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business?.id || !selectedBranchId || !selectedProductId) return;

    const qChange = parseInt(quantityChange, 10);
    if (isNaN(qChange) || qChange === 0) {
      setStatus('error');
      setErrorMessage('Quantity change must be a non-zero integer.');
      return;
    }

    const expectedVersion = currentStock?.server_version ?? 0;

    setStatus('loading');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await postAdjustment(
        {
          business_id: business.id,
          branch_id: selectedBranchId,
          product_id: selectedProductId,
          quantity_change: qChange,
          expected_server_version: expectedVersion,
          reference: reference.trim() || null,
        },
        idempotencyKeyRef.current
      );

      setStatus('success');
      setCurrentStock(result.stock);
      setSuccessMessage(
        `Adjustment successful. New quantity: ${result.stock.quantity} (v${result.stock.server_version})`
      );
      setQuantityChange('');
      setReference('');
      generateNewIdempotencyKey();
    } catch (err) {
      if (isConflictError(err)) {
        // 409 Conflict = this logical submission is definitively rejected due to stale state.
        // Generate a new idempotency key so the next adjustment attempt (after user refreshes)
        // does not hit IDEMPOTENCY_KEY_REUSE on the backend.
        // The failed request's key is abandoned; no retry of this request is possible.
        generateNewIdempotencyKey();
        setStatus('conflict');
        setErrorMessage(
          'Stock data has changed since you last loaded it. Please refresh to get the latest version before adjusting.'
        );
      } else if (isClientValidationError(err)) {
        // 400 = terminal rejection from backend validation (negative stock, invalid branch/product etc.)
        // Key is NOT regenerated: backend did not save the key, so same key can be reused
        // if the user corrects input and retries.
        setStatus('error');
        setErrorMessage(getApiErrorMessage(err, 'Adjustment rejected: would result in negative stock.'));
      } else {
        // Network failure / unknown result — outcome is uncertain.
        // Preserve idempotency key so user can retry the exact same logical submission safely.
        setStatus('error');
        setErrorMessage(getApiErrorMessage(err, 'Adjustment failed. Please try again.'));
      }
    }
  };

  if (loadingInit) {
    return (
      <div className="flex items-center gap-2 text-zinc-500 text-sm py-10">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading...
      </div>
    );
  }

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Stock Adjustment</h2>
        <p className="text-zinc-600 mt-1">Manually adjust stock balance. Each adjustment is recorded as a movement.</p>
      </div>

      {status === 'success' && successMessage && (
        <div className="flex items-start gap-3 rounded-md border border-green-200 bg-green-50 p-4 text-green-800 text-sm">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p>{successMessage}</p>
        </div>
      )}

      {status === 'conflict' && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-semibold">Stock conflict detected</p>
              <p className="mt-1">{errorMessage}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={refreshCurrentStock}>
            Load Latest Stock
          </Button>
        </div>
      )}

      {status === 'error' && errorMessage && (
        <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p>{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 rounded-md p-6 space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="adj-branch" className="block text-sm font-medium text-zinc-700">Branch</label>
          <select
            id="adj-branch"
            value={selectedBranchId}
            onChange={(e) => { setSelectedBranchId(e.target.value); setStatus('idle'); setErrorMessage(null); }}
            className="w-full border border-zinc-200 rounded-md text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            required
          >
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="adj-product" className="block text-sm font-medium text-zinc-700">Product</label>
          <select
            id="adj-product"
            value={selectedProductId}
            onChange={(e) => { setSelectedProductId(e.target.value); setStatus('idle'); setErrorMessage(null); }}
            className="w-full border border-zinc-200 rounded-md text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            required
          >
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="rounded-md bg-zinc-50 border border-zinc-100 px-4 py-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-zinc-500">Current Quantity:</span>
            <span className="font-semibold text-zinc-900">
              {currentStock !== null ? currentStock.quantity : '— (no stock record)'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Stock Version:</span>
            <span className="font-mono text-zinc-700">
              {currentStock !== null ? `v${currentStock.server_version}` : 'new'}
            </span>
          </div>
          {selectedProduct && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Price:</span>
              <span className="text-zinc-700">Rp {selectedProduct.price_minor.toLocaleString('id-ID')}</span>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="adj-qty" className="block text-sm font-medium text-zinc-700">
            Quantity Change
            <span className="ml-1 text-zinc-400 font-normal">(positive = add, negative = reduce)</span>
          </label>
          <input
            id="adj-qty"
            type="number"
            value={quantityChange}
            onChange={(e) => setQuantityChange(e.target.value)}
            placeholder="e.g. 10 or -5"
            className="w-full border border-zinc-200 rounded-md text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="adj-ref" className="block text-sm font-medium text-zinc-700">
            Reference / Reason
            <span className="ml-1 text-zinc-400 font-normal">(optional)</span>
          </label>
          <input
            id="adj-ref"
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. Stock opname correction"
            className="w-full border border-zinc-200 rounded-md text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={status === 'loading' || !selectedBranchId || !selectedProductId}>
            {status === 'loading' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {status === 'loading' ? 'Submitting...' : 'Submit Adjustment'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => { setQuantityChange(''); setReference(''); setStatus('idle'); setErrorMessage(null); setSuccessMessage(null); }}
          >
            Clear
          </Button>
        </div>
      </form>
    </div>
  );
}
