'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { getBranches, getStocks, getApiErrorMessage } from '@/features/inventory/api';
import { Branch, Stock } from '@/features/inventory/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Package } from 'lucide-react';

export default function InventoryPage() {
  const { business, isOwner } = useAuth();
  const router = useRouter();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!business?.id) return;
    let active = true;

    const load = async () => {
      setLoadingBranches(true);
      try {
        const items = await getBranches(business.id);
        if (!active) return;
        const activeBranches = items.filter((b) => b.status);
        setBranches(activeBranches);
        if (activeBranches.length > 0) setSelectedBranchId(activeBranches[0].id);
      } catch (err) {
        if (!active) return;
        setError(getApiErrorMessage(err, 'Failed to load branches'));
      } finally {
        if (active) setLoadingBranches(false);
      }
    };

    load();
    return () => { active = false; };
  }, [business?.id]);

  useEffect(() => {
    if (!business?.id || !selectedBranchId) return;
    let active = true;

    const load = async () => {
      setLoadingStocks(true);
      setError(null);
      try {
        const items = await getStocks(business.id, selectedBranchId);
        if (!active) return;
        setStocks(items);
      } catch (err) {
        if (!active) return;
        setError(getApiErrorMessage(err, 'Failed to load stocks'));
      } finally {
        if (active) setLoadingStocks(false);
      }
    };

    load();
    return () => { active = false; };
  }, [business?.id, selectedBranchId]);

  const handleRefresh = () => {
    if (!business?.id || !selectedBranchId) return;
    setLoadingStocks(true);
    setError(null);
    getStocks(business.id, selectedBranchId)
      .then(setStocks)
      .catch((err) => setError(getApiErrorMessage(err, 'Failed to load stocks')))
      .finally(() => setLoadingStocks(false));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Inventory</h2>
          <p className="text-zinc-600 mt-1">Current stock balance per branch</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loadingStocks || !selectedBranchId}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {loadingBranches ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading branches...
        </div>
      ) : branches.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-md p-8 text-center text-zinc-500">
          <Package className="h-10 w-10 mx-auto mb-3 text-zinc-300" />
          <p className="font-medium">No active branches found.</p>
          <p className="text-sm mt-1">Create a branch before managing inventory.</p>
          {isOwner() && (
            <Button
              type="button"
              className="mt-4"
              onClick={() => router.push('/inventory/branch')}
            >
              Create Branch
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <label htmlFor="branch-select" className="text-sm font-medium text-zinc-700">Branch:</label>
            <select
              id="branch-select"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="border border-zinc-200 rounded-md text-sm py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-white border border-zinc-200 rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product ID</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Version</TableHead>
                  <TableHead className="text-right">Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingStocks ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24 text-zinc-500">
                      <div className="flex justify-center items-center">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading stocks...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24 text-red-500">{error}</TableCell>
                  </TableRow>
                ) : stocks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24 text-zinc-500">
                      No stock records found for this branch.
                    </TableCell>
                  </TableRow>
                ) : (
                  stocks.map((stock) => (
                    <TableRow key={stock.id}>
                      <TableCell className="font-mono text-xs text-zinc-600">{stock.product_id}</TableCell>
                      <TableCell className="text-right font-medium">{stock.quantity}</TableCell>
                      <TableCell className="text-right text-zinc-500 text-sm">v{stock.server_version}</TableCell>
                      <TableCell className="text-right text-zinc-500 text-sm">
                        {new Date(stock.updated_at).toLocaleString('id-ID')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
