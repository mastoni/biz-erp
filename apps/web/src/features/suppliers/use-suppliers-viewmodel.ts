'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSupplier, deleteSupplier, getSuppliers, getSuppliersSummary, updateSupplier } from './api';
import { classifySupplierError } from './api';
import {
  filterSuppliers,
  mapSupplierSummaryToViewModel,
  mapSupplierToViewModel,
} from './supplier-helpers';
import type {
  Supplier,
  SupplierCreateFormModel,
  SupplierFilterModel,
  SupplierSummaryKPI,
  SupplierUpdateInput,
  SupplierViewModel,
  SuppliersDataState,
  SuppliersMutationState,
} from './types';

export interface UseSuppliersViewModelOptions {
  businessId?: string;
  limit?: number;
}

export interface UseSuppliersViewModelResult {
  suppliers: SupplierViewModel[];
  allSuppliers: SupplierViewModel[];
  summary: SupplierSummaryKPI;
  dataState: SuppliersDataState;
  isLoading: boolean;
  isEmpty: boolean;
  error: string | null;
  search: string;
  setSearch: (q: string) => void;
  mutationState: SuppliersMutationState;
  addSupplier: (form: SupplierCreateFormModel) => Promise<SupplierViewModel>;
  updateSupplier: (
    id: string,
    updates: Omit<SupplierUpdateInput, 'business_id' | 'expected_server_version'>
  ) => Promise<SupplierViewModel>;
  deleteSupplier: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const SUPPLIERS_PAGE_SIZE = 20;

export function useSuppliersViewModel({
  businessId,
  limit = 200,
}: UseSuppliersViewModelOptions): UseSuppliersViewModelResult {
  const [rawSuppliers, setRawSuppliers] = useState<Supplier[]>([]);
  const [rawSummary, setRawSummary] = useState<SupplierSummaryKPI | null>(null);
  const [dataState, setDataState] = useState<SuppliersDataState>('loading');
  const [mutationState, setMutationState] = useState<SuppliersMutationState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const activeBusinessRef = useRef<string | undefined>(businessId);

  const fetchSuppliersData = useCallback(async () => {
    if (!businessId) {
      setRawSuppliers([]);
      setRawSummary(null);
      setDataState('empty');
      return;
    }

    setDataState('loading');
    setError(null);

    try {
      const [listRes, summaryRes] = await Promise.allSettled([
        getSuppliers(businessId, limit, 0),
        getSuppliersSummary(businessId),
      ]);

      if (listRes.status === 'fulfilled') {
        const items = listRes.value.items || [];
        setRawSuppliers(items);

        let summaryData: SupplierSummaryKPI | null = null;
        if (summaryRes.status === 'fulfilled') {
          summaryData = summaryRes.value;
        } else if (listRes.value.summary) {
          summaryData = listRes.value.summary;
        }
        setRawSummary(summaryData);

        setDataState(items.length === 0 ? 'empty' : 'ready');
      } else {
        const msg = listRes.reason?.message || 'Gagal memuat data supplier.';
        setError(msg);
        setDataState('error');
      }
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan saat memuat supplier.');
      setDataState('error');
    }
  }, [businessId, limit]);

  useEffect(() => {
    const businessChanged = activeBusinessRef.current !== businessId;

    if (businessChanged) {
      activeBusinessRef.current = businessId;

      // Clear previous tenant data immediately
      setRawSuppliers([]);
      setRawSummary(null);
      setSearch('');
      setDataState('loading');
      setError(null);
    }

    fetchSuppliersData();
  }, [businessId, fetchSuppliersData]);

  const allSuppliers = useMemo<SupplierViewModel[]>(() => {
    return rawSuppliers.map((s) => mapSupplierToViewModel(s));
  }, [rawSuppliers]);

  const summary = useMemo<SupplierSummaryKPI>(() => {
    return mapSupplierSummaryToViewModel(rawSummary, allSuppliers);
  }, [rawSummary, allSuppliers]);

  const filterModel = useMemo<SupplierFilterModel>(() => ({
    search,
  }), [search]);

  const suppliers = useMemo<SupplierViewModel[]>(() => {
    return filterSuppliers(allSuppliers, filterModel);
  }, [allSuppliers, filterModel]);

  const addSupplier = useCallback(
    async (form: SupplierCreateFormModel): Promise<SupplierViewModel> => {
      if (!businessId) {
        throw new Error('Business context is required.');
      }

      setMutationState('saving');
      try {
        const newId = crypto.randomUUID();
        const created = await createSupplier({
          id: newId,
          business_id: businessId,
          name: form.name.trim(),
          contact: form.contact.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          category: form.category || null,
          term: form.term,
        });

        // Prepend after server success (no optimistic insertion per spec)
        setRawSuppliers((prev) => [created, ...prev]);
        setMutationState('saved');

        return mapSupplierToViewModel(created);
      } catch (err: any) {
        const errorType = classifySupplierError(err);
        if (errorType === 'code_conflict' || errorType === 'version_conflict') {
          setMutationState('conflict');
        } else {
          setMutationState('error');
        }
        throw err;
      }
    },
    [businessId]
  );

  const updateSupplierById = useCallback(
    async (
      id: string,
      updates: Omit<SupplierUpdateInput, 'business_id' | 'expected_server_version'>
    ): Promise<SupplierViewModel> => {
      if (!businessId) {
        throw new Error('Business context is required.');
      }

      const current = allSuppliers.find((s) => s.id === id);
      if (!current) {
        throw new Error('Supplier not found.');
      }

      setMutationState('saving');
      try {
        const updated = await updateSupplier(id, {
          business_id: businessId,
          expected_server_version: current.server_version,
          ...updates,
        });

        setRawSuppliers((prev) =>
          prev.map((s) => (s.id === id ? updated : s))
        );
        setMutationState('saved');

        return mapSupplierToViewModel(updated);
      } catch (err: any) {
        const errorType = classifySupplierError(err);
        if (errorType === 'code_conflict' || errorType === 'version_conflict') {
          setMutationState('conflict');
        } else {
          setMutationState('error');
        }
        throw err;
      }
    },
    [businessId, allSuppliers]
  );

  const deleteSupplierById = useCallback(
    async (id: string): Promise<void> => {
      if (!businessId) {
        throw new Error('Business context is required.');
      }

      setMutationState('saving');
      try {
        await deleteSupplier(id);

        // Remove from local state after server success
        setRawSuppliers((prev) => prev.filter((s) => s.id !== id));
        setMutationState('saved');
      } catch (err: any) {
        const errorType = classifySupplierError(err);
        if (errorType === 'code_conflict' || errorType === 'version_conflict') {
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
    suppliers,
    allSuppliers,
    summary,
    dataState,
    isLoading: dataState === 'loading',
    isEmpty: dataState === 'empty' && allSuppliers.length === 0,
    error,
    search,
    setSearch,
    mutationState,
    addSupplier,
    updateSupplier: updateSupplierById,
    deleteSupplier: deleteSupplierById,
    refresh: fetchSuppliersData,
  };
}
