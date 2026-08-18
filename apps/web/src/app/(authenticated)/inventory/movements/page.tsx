'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { getBranches, getMovements, getApiErrorMessage } from '@/features/inventory/api';
import { Branch, StockMovement } from '@/features/inventory/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

export default function MovementsPage() {
  const { business } = useAuth();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [loadingMovements, setLoadingMovements] = useState(false);
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

  const loadMovements = useCallback((branchId: string) => {
    if (!business?.id || !branchId) return;
    let active = true;

    const fetch = async () => {
      setLoadingMovements(true);
      setError(null);
      try {
        const res = await getMovements(business.id, branchId);
        if (!active) return;
        setMovements(res.items);
      } catch (err) {
        if (!active) return;
        setError(getApiErrorMessage(err, 'Failed to load movements'));
      } finally {
        if (active) setLoadingMovements(false);
      }
    };

    fetch();
    return () => { active = false; };
  }, [business]);

  useEffect(() => {
    if (selectedBranchId) {
      const cleanup = loadMovements(selectedBranchId);
      return cleanup;
    }
  }, [selectedBranchId, loadMovements]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Movement History</h2>
          <p className="text-zinc-600 mt-1">Immutable stock movement log</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadMovements(selectedBranchId)} disabled={loadingMovements || !selectedBranchId}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {loadingBranches ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading branches...
        </div>
      ) : branches.length > 0 && (
        <div className="flex items-center gap-3">
          <label htmlFor="branch-select-mv" className="text-sm font-medium text-zinc-700">Branch:</label>
          <select
            id="branch-select-mv"
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="border border-zinc-200 rounded-md text-sm py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="bg-white border border-zinc-200 rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Product ID</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead className="text-right">Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingMovements ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-zinc-500">
                  <div className="flex justify-center items-center">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading movements...
                  </div>
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-red-500">{error}</TableCell>
              </TableRow>
            ) : movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-zinc-500">
                  No stock movements recorded for this branch.
                </TableCell>
              </TableRow>
            ) : (
              movements.map((mv) => (
                <TableRow key={mv.id}>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700">
                      {mv.movement_type}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-zinc-600">{mv.product_id}</TableCell>
                  <TableCell className={`text-right font-medium ${mv.quantity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {mv.quantity >= 0 ? `+${mv.quantity}` : mv.quantity}
                  </TableCell>
                  <TableCell className="text-zinc-500 text-sm">{mv.reference || '-'}</TableCell>
                  <TableCell className="font-mono text-xs text-zinc-500">{mv.actor}</TableCell>
                  <TableCell className="text-right text-zinc-500 text-sm">
                    {new Date(mv.timestamp).toLocaleString('id-ID')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
