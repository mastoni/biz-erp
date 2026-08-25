'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { getBranches } from '@/features/inventory/api';
import type { Branch } from '@/features/inventory/types';

export type BranchStatus = 'loading' | 'available' | 'active' | 'switching' | 'error' | 'empty';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidBranchId(id: unknown): boolean {
  if (typeof id !== 'string' || id.trim() === '') return false;
  return UUID_REGEX.test(id);
}

export interface BranchContextType {
  branches: Branch[];
  activeBranch: Branch | null;
  branchStatus: BranchStatus;
  isLoading: boolean;
  error: string | null;
  selectBranch: (branchId: string) => void;
  switchBranch: (branchId: string) => Promise<void>;
  refreshBranches: () => Promise<void>;
  clearBranchContext: () => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const { business, status, scope } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [branchStatus, setBranchStatus] = useState<BranchStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  const clearBranchContext = useCallback(() => {
    setBranches([]);
    setActiveBranch(null);
    setError(null);
    setBranchStatus('empty');
  }, []);

  const refreshBranches = useCallback(async () => {
    if (!business?.id || status !== 'authenticated' || scope !== 'tenant') {
      clearBranchContext();
      return;
    }

    setBranchStatus('loading');
    setError(null);

    try {
      const items = await getBranches(business.id);
      setBranches(items);

      if (items.length > 0) {
        // Auto-select active branch
        setActiveBranch((curr) => {
          if (curr && items.some((b) => b.id === curr.id)) {
            return curr;
          }
          const primary = items.find((b) => b.status) || items[0];
          return primary;
        });
        setBranchStatus('active');
      } else {
        setActiveBranch(null);
        setBranchStatus('empty');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load branches';
      setError(msg);
      setBranches([]);
      setActiveBranch(null);
      setBranchStatus('error');
    }
  }, [business?.id, status, scope, clearBranchContext]);

  // Invalidate and refresh branch context whenever business/tenant context changes
  useEffect(() => {
    clearBranchContext();
    if (business?.id && status === 'authenticated' && scope === 'tenant') {
      refreshBranches();
    }
  }, [business?.id, status, scope, clearBranchContext, refreshBranches]);

  const switchBranch = useCallback(
    async (branchId: string) => {
      // 1. Strict RFC 4122 UUID validation
      if (!isValidBranchId(branchId)) {
        setBranchStatus('error');
        const err = new Error(`Invalid branch UUID: ${branchId}`);
        setError(err.message);
        throw err;
      }

      // 2. Validate branch belongs to the active tenant
      const target = branches.find((b) => b.id === branchId);
      if (!target) {
        setBranchStatus('error');
        const err = new Error('Access denied: Branch does not belong to active tenant');
        setError(err.message);
        throw err;
      }

      // 3. Clear old branch UI state during transition
      setBranchStatus('switching');
      setError(null);

      // 4. Set new active branch
      setActiveBranch(target);
      setBranchStatus('active');
    },
    [branches]
  );

  const selectBranch = useCallback(
    (branchId: string) => {
      switchBranch(branchId).catch(() => {});
    },
    [switchBranch]
  );

  const value: BranchContextType = {
    branches,
    activeBranch,
    branchStatus,
    isLoading: branchStatus === 'loading' || branchStatus === 'switching',
    error,
    selectBranch,
    switchBranch,
    refreshBranches,
    clearBranchContext,
  };

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranchContext() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranchContext must be used within a BranchProvider');
  }
  return context;
}
