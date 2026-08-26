'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createCustomer, getCustomers, getCustomersSummary } from './api';
import {
  filterCustomers,
  mapCustomerSummaryToViewModel,
  mapCustomerToViewModel,
} from './customer-helpers';
import type {
  Customer,
  CustomerCreateFormModel,
  CustomerFilterModel,
  CustomerSummaryKPI,
  CustomerTier,
  CustomerViewModel,
  CustomersDataState,
  CustomersMutationState,
} from './types';

export interface UseCustomersViewModelOptions {
  businessId?: string;
  limit?: number;
}

export interface UseCustomersViewModelResult {
  customers: CustomerViewModel[];
  allCustomers: CustomerViewModel[];
  summary: CustomerSummaryKPI;
  dataState: CustomersDataState;
  isLoading: boolean;
  isEmpty: boolean;
  error: string | null;
  search: string;
  setSearch: (q: string) => void;
  tier: CustomerTier | 'Semua';
  setTier: (tier: CustomerTier | 'Semua') => void;
  mutationState: CustomersMutationState;
  addCustomer: (form: CustomerCreateFormModel) => Promise<CustomerViewModel>;
  refresh: () => Promise<void>;
}

export function useCustomersViewModel({
  businessId,
  limit = 200,
}: UseCustomersViewModelOptions): UseCustomersViewModelResult {
  const [rawCustomers, setRawCustomers] = useState<Customer[]>([]);
  const [rawSummary, setRawSummary] = useState<CustomerSummaryKPI | null>(null);
  const [dataState, setDataState] = useState<CustomersDataState>('loading');
  const [mutationState, setMutationState] = useState<CustomersMutationState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState<CustomerTier | 'Semua'>('Semua');

  const activeBusinessRef = useRef<string | undefined>(businessId);

  const fetchCustomersData = useCallback(async () => {
    if (!businessId) {
      setRawCustomers([]);
      setRawSummary(null);
      setDataState('empty');
      return;
    }

    setDataState('loading');
    setError(null);

    try {
      const [listRes, summaryRes] = await Promise.allSettled([
        getCustomers(businessId, limit, 0),
        getCustomersSummary(businessId),
      ]);

      if (listRes.status === 'fulfilled') {
        const items = listRes.value.items || [];
        setRawCustomers(items);

        let summaryData: CustomerSummaryKPI | null = null;
        if (summaryRes.status === 'fulfilled') {
          summaryData = summaryRes.value;
        } else if (listRes.value.summary) {
          summaryData = listRes.value.summary;
        }
        setRawSummary(summaryData);

        setDataState(items.length === 0 ? 'empty' : 'ready');
      } else {
        const msg = listRes.reason?.message || 'Gagal memuat data pelanggan.';
        setError(msg);
        setDataState('error');
      }
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan saat memuat pelanggan.');
      setDataState('error');
    }
  }, [businessId, limit]);

  // Handle tenant switch & initial load
  useEffect(() => {
    const businessChanged = activeBusinessRef.current !== businessId;

    if (businessChanged) {
      activeBusinessRef.current = businessId;

      // Clear previous tenant data immediately
      setRawCustomers([]);
      setRawSummary(null);
      setSearch('');
      setTier('Semua');
      setDataState('loading');
      setError(null);
    }

    fetchCustomersData();
  }, [businessId, fetchCustomersData]);

  // Map raw customers to CustomerViewModels
  const allCustomers = useMemo<CustomerViewModel[]>(() => {
    return rawCustomers.map((c, i) => mapCustomerToViewModel(c, i));
  }, [rawCustomers]);

  // Compute summary KPI with safe fallbacks
  const summary = useMemo<CustomerSummaryKPI>(() => {
    return mapCustomerSummaryToViewModel(rawSummary, allCustomers);
  }, [rawSummary, allCustomers]);

  // Apply client filter (search query + tier)
  const filterModel = useMemo<CustomerFilterModel>(() => ({
    search,
    tier,
  }), [search, tier]);

  const customers = useMemo<CustomerViewModel[]>(() => {
    return filterCustomers(allCustomers, filterModel);
  }, [allCustomers, filterModel]);

  // Create customer action
  const addCustomer = useCallback(
    async (form: CustomerCreateFormModel): Promise<CustomerViewModel> => {
      if (!businessId) {
        throw new Error('Business context is required.');
      }

      setMutationState('saving');
      try {
        const newId = crypto.randomUUID();
        const created = await createCustomer({
          id: newId,
          business_id: businessId,
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          tier: form.tier,
          points: 0,
        });

        // Prepend optimistically to local list
        setRawCustomers((prev) => [created, ...prev]);
        setMutationState('saved');

        const vm = mapCustomerToViewModel(created, 0);
        return vm;
      } catch (err: any) {
        if (err?.response?.status === 409 || err?.code === 'CONFLICT') {
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
    customers,
    allCustomers,
    summary,
    dataState,
    isLoading: dataState === 'loading',
    isEmpty: dataState === 'empty' && allCustomers.length === 0,
    error,
    search,
    setSearch,
    tier,
    setTier,
    mutationState,
    addCustomer,
    refresh: fetchCustomersData,
  };
}
