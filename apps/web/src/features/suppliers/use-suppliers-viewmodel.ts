'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSupplier, deleteSupplier, getSuppliers, getSuppliersSummary, updateSupplier } from './api';
import { getPurchases } from '../purchases/api';
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
  LinkedPurchaseOrder,
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
  const [linkedPOMap, setLinkedPOMap] = useState<Map<string, LinkedPurchaseOrder[]>>(new Map());
  const [outstandingMap, setOutstandingMap] = useState<Map<string, number>>(new Map());
  const [totalOutstanding, setTotalOutstanding] = useState<number>(0);
  const [poCountThisMonth, setPoCountThisMonth] = useState<number>(0);
  const [dataState, setDataState] = useState<SuppliersDataState>('loading');
  const [mutationState, setMutationState] = useState<SuppliersMutationState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const activeBusinessRef = useRef<string | undefined>(businessId);

  const fetchSuppliersData = useCallback(async () => {
    if (!businessId) {
      setRawSuppliers([]);
      setRawSummary(null);
      setLinkedPOMap(new Map());
      setOutstandingMap(new Map());
      setTotalOutstanding(0);
      setPoCountThisMonth(0);
      setDataState('empty');
      return;
    }

    setDataState('loading');
    setError(null);

    try {
      const [listRes, summaryRes, purchasesRes] = await Promise.allSettled([
        getSuppliers(businessId, limit, 0),
        getSuppliersSummary(businessId),
        getPurchases(businessId, undefined, 200, 0),
      ]);

      // Process Purchases for debt & PO history
      const poMap = new Map<string, LinkedPurchaseOrder[]>();
      const outMap = new Map<string, number>();
      let debtTotal = 0;
      let monthPoCount = 0;
      const currentMonthPrefix = new Date().toISOString().slice(0, 7);

      if (purchasesRes.status === 'fulfilled' && purchasesRes.value.items) {
        const pos = purchasesRes.value.items;
        pos.forEach((po) => {
          if (po.status !== 'cancelled') {
            if (po.date && po.date.startsWith(currentMonthPrefix)) {
              monthPoCount++;
            }
            const curDebt = outMap.get(po.supplier_id) || 0;
            outMap.set(po.supplier_id, curDebt + (po.outstanding_minor || 0));
            debtTotal += (po.outstanding_minor || 0);
          }

          const linked: LinkedPurchaseOrder = {
            id: po.id,
            code: po.code,
            date: po.date,
            due_date: po.due_date,
            status: po.status,
            total_minor: po.total_minor,
            paid_minor: po.paid_minor,
            outstanding_minor: po.outstanding_minor,
            items_count: (po.items || []).length,
            items_summary: (po.items || []).map((it) => `${it.product_name} (${it.ordered_qty})`).join(', ') || '—',
          };

          const list = poMap.get(po.supplier_id) || [];
          list.push(linked);
          poMap.set(po.supplier_id, list);
        });
      }

      setLinkedPOMap(poMap);
      setOutstandingMap(outMap);
      setTotalOutstanding(debtTotal);
      setPoCountThisMonth(monthPoCount);

      if (listRes.status === 'fulfilled') {
        const items = listRes.value.items || [];
        setRawSuppliers(items);

        let summaryData: SupplierSummaryKPI | null = null;
        if (summaryRes.status === 'fulfilled') {
          summaryData = {
            ...summaryRes.value,
            total_outstanding_minor: debtTotal,
            po_count_this_month: monthPoCount,
          };
        } else if (listRes.value.summary) {
          summaryData = {
            total_suppliers: listRes.value.summary.total_suppliers ?? items.length,
            active_suppliers: listRes.value.summary.active_suppliers ?? items.filter((s) => s.status === 'aktif').length,
            inactive_suppliers: listRes.value.summary.inactive_suppliers ?? items.filter((s) => s.status === 'nonaktif').length,
            total_outstanding_minor: debtTotal,
            po_count_this_month: monthPoCount,
          };
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
    activeBusinessRef.current = businessId;
    fetchSuppliersData();
  }, [fetchSuppliersData, businessId]);

  const allSuppliers: SupplierViewModel[] = useMemo(() => {
    return rawSuppliers.map((s) =>
      mapSupplierToViewModel(s, linkedPOMap.get(s.id) || [], outstandingMap.get(s.id) || 0)
    );
  }, [rawSuppliers, linkedPOMap, outstandingMap]);

  const suppliers: SupplierViewModel[] = useMemo(() => {
    return filterSuppliers(allSuppliers, { search });
  }, [allSuppliers, search]);

  const summary: SupplierSummaryKPI = useMemo(() => {
    return mapSupplierSummaryToViewModel(rawSummary, allSuppliers, totalOutstanding, poCountThisMonth);
  }, [rawSummary, allSuppliers, totalOutstanding, poCountThisMonth]);

  const addSupplier = useCallback(
    async (form: SupplierCreateFormModel): Promise<SupplierViewModel> => {
      if (!businessId) {
        throw new Error('Business ID is missing.');
      }

      setMutationState('saving');
      try {
        const created = await createSupplier({
          id: crypto.randomUUID(),
          business_id: businessId,
          ...form,
        });
        setRawSuppliers((prev) => [created, ...prev]);
        setMutationState('saved');
        return mapSupplierToViewModel(created, [], 0);
      } catch (err: any) {
        setMutationState('error');
        throw err;
      }
    },
    [businessId]
  );

  const updateSupplierAction = useCallback(
    async (
      id: string,
      updates: Omit<SupplierUpdateInput, 'business_id' | 'expected_server_version'>
    ): Promise<SupplierViewModel> => {
      if (!businessId) {
        throw new Error('Business ID is missing.');
      }

      const existing = rawSuppliers.find((s) => s.id === id);
      if (!existing) {
        throw new Error('Supplier tidak ditemukan.');
      }

      setMutationState('saving');
      try {
        const updated = await updateSupplier(id, {
          ...updates,
          business_id: businessId,
          expected_server_version: existing.server_version,
        });

        setRawSuppliers((prev) => prev.map((s) => (s.id === id ? updated : s)));
        setMutationState('saved');
        return mapSupplierToViewModel(
          updated,
          linkedPOMap.get(id) || [],
          outstandingMap.get(id) || 0
        );
      } catch (err: any) {
        const errType = classifySupplierError(err);
        if (errType === 'version_conflict') {
          setMutationState('conflict');
        } else {
          setMutationState('error');
        }
        throw err;
      }
    },
    [businessId, rawSuppliers, linkedPOMap, outstandingMap]
  );

  const deleteSupplierAction = useCallback(
    async (id: string): Promise<void> => {
      if (!businessId) {
        throw new Error('Business ID is missing.');
      }

      setMutationState('saving');
      try {
        await deleteSupplier(id);
        setRawSuppliers((prev) => prev.filter((s) => s.id !== id));
        setMutationState('saved');
      } catch (err: any) {
        setMutationState('error');
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
    isEmpty: dataState === 'empty',
    error,
    search,
    setSearch,
    mutationState,
    addSupplier,
    updateSupplier: updateSupplierAction,
    deleteSupplier: deleteSupplierAction,
    refresh: fetchSuppliersData,
  };
}
