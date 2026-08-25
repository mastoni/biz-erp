'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { getBranches } from '@/features/inventory/api';
import type { Branch } from '@/features/inventory/types';

export interface BranchContextType {
  branches: Branch[];
  activeBranch: Branch | null;
  isLoading: boolean;
  error: string | null;
  selectBranch: (branchId: string) => void;
  refreshBranches: () => Promise<void>;
  clearBranchContext: () => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const { business, status, scope } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearBranchContext = useCallback(() => {
    setBranches([]);
    setActiveBranch(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const refreshBranches = useCallback(async () => {
    if (!business?.id || status !== 'authenticated' || scope !== 'tenant') {
      clearBranchContext();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const items = await getBranches(business.id);
      setBranches(items);
      if (items.length > 0) {
        // Default to first active branch if current selection is not in list
        setActiveBranch((curr) => {
          if (curr && items.some((b) => b.id === curr.id)) {
            return curr;
          }
          return items[0];
        });
      } else {
        setActiveBranch(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branches');
      setBranches([]);
      setActiveBranch(null);
    } finally {
      setIsLoading(false);
    }
  }, [business?.id, status, scope, clearBranchContext]);

  // Invalidate and refresh branch context whenever business context changes
  useEffect(() => {
    // Clear immediately to prevent cross-tenant branch data leakage during transition
    clearBranchContext();
    if (business?.id && status === 'authenticated' && scope === 'tenant') {
      refreshBranches();
    }
  }, [business?.id, status, scope, clearBranchContext, refreshBranches]);

  const selectBranch = useCallback((branchId: string) => {
    const target = branches.find((b) => b.id === branchId);
    if (target) {
      setActiveBranch(target);
    }
  }, [branches]);

  const value: BranchContextType = {
    branches,
    activeBranch,
    isLoading,
    error,
    selectBranch,
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
