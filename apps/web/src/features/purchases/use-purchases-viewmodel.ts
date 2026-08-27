'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cancelPurchase,
  classifyPurchaseError,
  createPurchase,
  deleteDraftPurchase,
  getPurchases,
  getPurchasesSummary,
  payPurchase,
  receivePurchase,
  sendPurchase,
  updateDraftPurchase,
} from './api';
import {
  filterPurchases,
  mapPurchaseSummaryToViewModel,
  mapPurchaseToViewModel,
} from './purchase-helpers';
import type {
  PaymentMethod,
  Purchase,
  PurchaseCreateInput,
  PurchaseCreateItemInput,
  PurchaseFilterModel,
  PurchaseReceiveItemInput,
  PurchaseSummaryKPI,
  PurchaseUpdateDraftInput,
  PurchaseViewModel,
  PurchasesDataState,
  PurchasesMutationState,
} from './types';

export interface UsePurchasesViewModelOptions {
  businessId?: string;
  branchId?: string;
  limit?: number;
}

export interface UsePurchasesViewModelResult {
  purchases: PurchaseViewModel[];
  allPurchases: PurchaseViewModel[];
  summary: PurchaseSummaryKPI;
  dataState: PurchasesDataState;
  isLoading: boolean;
  isEmpty: boolean;
  error: string | null;
  search: string;
  setSearch: (q: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  supplierFilter: string;
  setSupplierFilter: (supplierId: string) => void;
  termFilter: string;
  setTermFilter: (term: string) => void;
  resetFilters: () => void;
  mutationState: PurchasesMutationState;
  branchId?: string;
  createPurchase: (
    input: Omit<PurchaseCreateInput, 'business_id' | 'branch_id'> & { branch_id?: string }
  ) => Promise<PurchaseViewModel>;
  updateDraftPurchase: (
    id: string,
    input: Omit<PurchaseUpdateDraftInput, 'business_id' | 'expected_server_version'>
  ) => Promise<PurchaseViewModel>;
  sendPurchase: (id: string) => Promise<PurchaseViewModel>;
  receivePurchase: (
    id: string,
    items: PurchaseReceiveItemInput[]
  ) => Promise<PurchaseViewModel>;
  payPurchase: (
    id: string,
    amount_minor: number,
    method: PaymentMethod,
    reference?: string | null
  ) => Promise<PurchaseViewModel>;
  cancelPurchase: (id: string) => Promise<PurchaseViewModel>;
  deleteDraftPurchase: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePurchasesViewModel({
  businessId,
  branchId,
  limit = 200,
}: UsePurchasesViewModelOptions): UsePurchasesViewModelResult {
  const [rawPurchases, setRawPurchases] = useState<Purchase[]>([]);
  const [rawSummary, setRawSummary] = useState<PurchaseSummaryKPI | null>(null);
  const [dataState, setDataState] = useState<PurchasesDataState>('loading');
  const [mutationState, setMutationState] = useState<PurchasesMutationState>('idle');
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [termFilter, setTermFilter] = useState('Semua');

  const activeBusinessRef = useRef<string | undefined>(businessId);
  const activeBranchRef = useRef<string | undefined>(branchId);

  const resetFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('Semua');
    setSupplierFilter('');
    setTermFilter('Semua');
  }, []);

  const fetchPurchasesData = useCallback(async () => {
    if (!businessId) {
      setRawPurchases([]);
      setRawSummary(null);
      setDataState('empty');
      return;
    }

    setDataState('loading');
    setError(null);

    try {
      const [listRes, summaryRes] = await Promise.allSettled([
        getPurchases(businessId, branchId, limit, 0),
        getPurchasesSummary(businessId, branchId),
      ]);

      if (listRes.status === 'fulfilled') {
        const items = listRes.value.items || [];
        setRawPurchases(items);

        let summaryData: PurchaseSummaryKPI | null = null;
        if (summaryRes.status === 'fulfilled') {
          summaryData = summaryRes.value;
        } else if (listRes.value.summary) {
          summaryData = listRes.value.summary;
        }
        setRawSummary(summaryData);

        setDataState(items.length === 0 ? 'empty' : 'ready');
      } else {
        const msg = listRes.reason?.message || 'Gagal memuat data pembelian.';
        setError(msg);
        setDataState('error');
      }
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan saat memuat data pembelian.');
      setDataState('error');
    }
  }, [businessId, branchId, limit]);

  useEffect(() => {
    const businessChanged = activeBusinessRef.current !== businessId;
    const branchChanged = activeBranchRef.current !== branchId;

    if (businessChanged) {
      activeBusinessRef.current = businessId;
      activeBranchRef.current = branchId;

      // Clear previous tenant data immediately
      setRawPurchases([]);
      setRawSummary(null);
      resetFilters();
      setDataState('loading');
      setError(null);
    } else if (branchChanged) {
      activeBranchRef.current = branchId;

      // Clear previous branch data immediately
      setRawPurchases([]);
      setRawSummary(null);
      setDataState('loading');
      setError(null);
    }

    fetchPurchasesData();
  }, [businessId, branchId, fetchPurchasesData, resetFilters]);

  const allPurchases = useMemo<PurchaseViewModel[]>(() => {
    return rawPurchases.map((p) => mapPurchaseToViewModel(p));
  }, [rawPurchases]);

  const summary = useMemo<PurchaseSummaryKPI>(() => {
    return mapPurchaseSummaryToViewModel(rawSummary, allPurchases);
  }, [rawSummary, allPurchases]);

  const filterModel = useMemo<PurchaseFilterModel>(
    () => ({
      search,
      status: statusFilter,
      supplierId: supplierFilter,
      term: termFilter,
    }),
    [search, statusFilter, supplierFilter, termFilter]
  );

  const purchases = useMemo<PurchaseViewModel[]>(() => {
    return filterPurchases(allPurchases, filterModel);
  }, [allPurchases, filterModel]);

  const createPurchaseAction = useCallback(
    async (
      input: Omit<PurchaseCreateInput, 'business_id' | 'branch_id'> & { branch_id?: string }
    ): Promise<PurchaseViewModel> => {
      const effectiveBranchId = input.branch_id || branchId;
      if (!businessId || !effectiveBranchId) {
        throw new Error('Business and branch context are required.');
      }

      setMutationState('saving');
      try {
        const created = await createPurchase({
          ...input,
          id: input.id || crypto.randomUUID(),
          business_id: businessId,
          branch_id: effectiveBranchId,
        });

        setRawPurchases((prev) => [created, ...prev]);
        setMutationState('saved');

        return mapPurchaseToViewModel(created);
      } catch (err: any) {
        const errorKind = classifyPurchaseError(err);
        if (
          errorKind === 'code_conflict' ||
          errorKind === 'version_conflict' ||
          errorKind === 'stock_version_conflict' ||
          errorKind === 'conflict'
        ) {
          setMutationState('conflict');
        } else {
          setMutationState('error');
        }
        throw err;
      }
    },
    [businessId, branchId]
  );

  const updateDraftPurchaseAction = useCallback(
    async (
      id: string,
      input: Omit<PurchaseUpdateDraftInput, 'business_id' | 'expected_server_version'>
    ): Promise<PurchaseViewModel> => {
      if (!businessId) {
        throw new Error('Business context is required.');
      }

      const current = allPurchases.find((p) => p.id === id);
      if (!current) {
        throw new Error('Purchase order not found.');
      }

      setMutationState('saving');
      try {
        const updated = await updateDraftPurchase(id, {
          ...input,
          business_id: businessId,
          expected_server_version: current.server_version,
        });

        setRawPurchases((prev) => prev.map((p) => (p.id === id ? updated : p)));
        setMutationState('saved');

        return mapPurchaseToViewModel(updated);
      } catch (err: any) {
        const errorKind = classifyPurchaseError(err);
        if (
          errorKind === 'code_conflict' ||
          errorKind === 'version_conflict' ||
          errorKind === 'conflict'
        ) {
          setMutationState('conflict');
        } else {
          setMutationState('error');
        }
        throw err;
      }
    },
    [businessId, allPurchases]
  );

  const sendPurchaseAction = useCallback(
    async (id: string): Promise<PurchaseViewModel> => {
      if (!businessId) {
        throw new Error('Business context is required.');
      }

      const current = allPurchases.find((p) => p.id === id);
      if (!current) {
        throw new Error('Purchase order not found.');
      }

      setMutationState('saving');
      try {
        const updated = await sendPurchase(id, {
          business_id: businessId,
          expected_server_version: current.server_version,
        });

        setRawPurchases((prev) => prev.map((p) => (p.id === id ? updated : p)));
        setMutationState('saved');

        return mapPurchaseToViewModel(updated);
      } catch (err: any) {
        const errorKind = classifyPurchaseError(err);
        if (errorKind === 'version_conflict' || errorKind === 'conflict') {
          setMutationState('conflict');
        } else {
          setMutationState('error');
        }
        throw err;
      }
    },
    [businessId, allPurchases]
  );

  const receivePurchaseAction = useCallback(
    async (
      id: string,
      items: PurchaseReceiveItemInput[]
    ): Promise<PurchaseViewModel> => {
      if (!businessId) {
        throw new Error('Business context is required.');
      }

      const current = allPurchases.find((p) => p.id === id);
      if (!current) {
        throw new Error('Purchase order not found.');
      }

      setMutationState('saving');
      try {
        const updated = await receivePurchase(id, {
          business_id: businessId,
          expected_server_version: current.server_version,
          items,
        });

        setRawPurchases((prev) => prev.map((p) => (p.id === id ? updated : p)));
        setMutationState('saved');

        return mapPurchaseToViewModel(updated);
      } catch (err: any) {
        const errorKind = classifyPurchaseError(err);
        if (
          errorKind === 'version_conflict' ||
          errorKind === 'stock_version_conflict' ||
          errorKind === 'conflict'
        ) {
          setMutationState('conflict');
        } else {
          setMutationState('error');
        }
        throw err;
      }
    },
    [businessId, allPurchases]
  );

  const payPurchaseAction = useCallback(
    async (
      id: string,
      amount_minor: number,
      method: PaymentMethod,
      reference?: string | null
    ): Promise<PurchaseViewModel> => {
      if (!businessId) {
        throw new Error('Business context is required.');
      }

      const current = allPurchases.find((p) => p.id === id);
      if (!current) {
        throw new Error('Purchase order not found.');
      }

      setMutationState('saving');
      try {
        const updated = await payPurchase(id, {
          business_id: businessId,
          expected_server_version: current.server_version,
          amount_minor,
          method,
          reference: reference ?? null,
        });

        setRawPurchases((prev) => prev.map((p) => (p.id === id ? updated : p)));
        setMutationState('saved');

        return mapPurchaseToViewModel(updated);
      } catch (err: any) {
        const errorKind = classifyPurchaseError(err);
        if (errorKind === 'version_conflict' || errorKind === 'conflict') {
          setMutationState('conflict');
        } else {
          setMutationState('error');
        }
        throw err;
      }
    },
    [businessId, allPurchases]
  );

  const cancelPurchaseAction = useCallback(
    async (id: string): Promise<PurchaseViewModel> => {
      if (!businessId) {
        throw new Error('Business context is required.');
      }

      const current = allPurchases.find((p) => p.id === id);
      if (!current) {
        throw new Error('Purchase order not found.');
      }

      setMutationState('saving');
      try {
        const updated = await cancelPurchase(id, {
          business_id: businessId,
          expected_server_version: current.server_version,
        });

        setRawPurchases((prev) => prev.map((p) => (p.id === id ? updated : p)));
        setMutationState('saved');

        return mapPurchaseToViewModel(updated);
      } catch (err: any) {
        const errorKind = classifyPurchaseError(err);
        if (errorKind === 'version_conflict' || errorKind === 'conflict') {
          setMutationState('conflict');
        } else {
          setMutationState('error');
        }
        throw err;
      }
    },
    [businessId, allPurchases]
  );

  const deleteDraftPurchaseAction = useCallback(
    async (id: string): Promise<void> => {
      if (!businessId) {
        throw new Error('Business context is required.');
      }

      setMutationState('saving');
      try {
        await deleteDraftPurchase(businessId, id);

        setRawPurchases((prev) => prev.filter((p) => p.id !== id));
        setMutationState('saved');
      } catch (err: any) {
        const errorKind = classifyPurchaseError(err);
        if (errorKind === 'version_conflict' || errorKind === 'conflict') {
          setMutationState('conflict');
        } else {
          setMutationState('error');
        }
        throw err;
      }
    },
    [businessId]
  );

  return {
    purchases,
    allPurchases,
    summary,
    dataState,
    isLoading: dataState === 'loading',
    isEmpty: dataState === 'empty' && allPurchases.length === 0,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    supplierFilter,
    setSupplierFilter,
    termFilter,
    setTermFilter,
    resetFilters,
    mutationState,
    branchId,
    createPurchase: createPurchaseAction,
    updateDraftPurchase: updateDraftPurchaseAction,
    sendPurchase: sendPurchaseAction,
    receivePurchase: receivePurchaseAction,
    payPurchase: payPurchaseAction,
    cancelPurchase: cancelPurchaseAction,
    deleteDraftPurchase: deleteDraftPurchaseAction,
    refresh: fetchPurchasesData,
  };
}
