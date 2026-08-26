'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DailySalesPointDto,
  PaymentMethodViewModel,
  Sale,
  SalesDataState,
  SalesFilterModel,
  SalesKPIViewModel,
  SalesPaymentMethodFilter,
  SalesRangeFilter,
  SalesSummaryDto,
  SalesTransactionViewModel,
  SalesTrendPointViewModel,
} from './types';
import { getDailySales, getSales, getSalesSummary } from './api';
import {
  downloadSalesCsv,
  filterSalesTransactions,
  mapDailySalesToTrend,
  mapPaymentMethods,
  mapSalesSummaryToKPI,
  mapSaleToViewModel,
} from './sales-helpers';

export interface UseSalesViewModelOptions {
  businessId?: string;
  branchId?: string;
  initialRange?: SalesRangeFilter;
}

export function useSalesViewModel({
  businessId,
  branchId,
  initialRange = '7d',
}: UseSalesViewModelOptions) {
  const [dataState, setDataState] = useState<SalesDataState>('loading');
  const [error, setError] = useState<string | null>(null);

  const [rawSummary, setRawSummary] = useState<SalesSummaryDto | null>(null);
  const [rawDailyPoints, setRawDailyPoints] = useState<DailySalesPointDto[]>([]);
  const [rawSales, setRawSales] = useState<Sale[]>([]);
  const [freshSaleIds, setFreshSaleIds] = useState<Set<string>>(new Set());

  const [range, setRange] = useState<SalesRangeFilter>(initialRange);
  const [search, setSearch] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<SalesPaymentMethodFilter>('Semua');

  const activeBranchRef = useRef<string | undefined>(branchId);
  const activeBusinessRef = useRef<string | undefined>(businessId);

  // Compute date range for daily trend
  const getDateRangeForTrend = (r: SalesRangeFilter) => {
    const days = r === '7d' ? 7 : 30;
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - (days - 1));

    const toStr = toDate.toISOString().split('T')[0];
    const fromStr = fromDate.toISOString().split('T')[0];
    return { from: fromStr, to: toStr };
  };

  const loadData = useCallback(async () => {
    if (!businessId) {
      setDataState('empty');
      return;
    }

    setDataState('loading');
    setError(null);

    try {
      const trendRange = getDateRangeForTrend(range);

      const [summaryRes, dailyRes, salesRes] = await Promise.allSettled([
        getSalesSummary(businessId, { branchId }),
        getDailySales(businessId, { from: trendRange.from, to: trendRange.to, branchId }),
        getSales(businessId, 0, 500, branchId),
      ]);

      if (summaryRes.status === 'fulfilled') {
        setRawSummary(summaryRes.value.sales_summary);
      } else {
        setRawSummary(null);
      }

      if (dailyRes.status === 'fulfilled') {
        setRawDailyPoints(dailyRes.value.points);
      } else {
        setRawDailyPoints([]);
      }

      if (salesRes.status === 'fulfilled') {
        setRawSales(salesRes.value.sales);
        if (salesRes.value.sales.length === 0 && (!summaryRes || summaryRes.status === 'rejected' || summaryRes.value.sales_summary.total_sales === 0)) {
          setDataState('empty');
        } else {
          setDataState('ready');
        }
      } else {
        throw salesRes.reason;
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat data penjualan');
      setDataState('error');
    }
  }, [businessId, branchId, range]);

  // Handle tenant or branch change: immediately clear state and reload
  useEffect(() => {
    const branchChanged = activeBranchRef.current !== branchId;
    const businessChanged = activeBusinessRef.current !== businessId;

    if (branchChanged || businessChanged) {
      activeBranchRef.current = branchId;
      activeBusinessRef.current = businessId;

      // Clear previous states
      setRawSummary(null);
      setRawDailyPoints([]);
      setRawSales([]);
      setFreshSaleIds(new Set());
      setDataState('loading');
      setError(null);
    }

    loadData();
  }, [businessId, branchId, loadData]);

  // Transactions mapping
  const transactions: SalesTransactionViewModel[] = useMemo(() => {
    return rawSales.map((s) => mapSaleToViewModel(s, freshSaleIds.has(s.id)));
  }, [rawSales, freshSaleIds]);

  // KPI mapping
  const kpi: SalesKPIViewModel = useMemo(() => {
    return mapSalesSummaryToKPI(rawSummary, transactions);
  }, [rawSummary, transactions]);

  // Trend points mapping
  const trendPoints: SalesTrendPointViewModel[] = useMemo(() => {
    return mapDailySalesToTrend(rawDailyPoints, range);
  }, [rawDailyPoints, range]);

  // Payment methods breakdown mapping
  const paymentMethods: PaymentMethodViewModel[] = useMemo(() => {
    if (rawSummary?.payment_methods && rawSummary.payment_methods.length > 0) {
      return mapPaymentMethods(rawSummary.payment_methods, rawSummary.total_sales);
    }
    // Fallback computed from transactions
    const counts: Record<string, { count: number; total_minor: number }> = {};
    for (const t of transactions) {
      const m = t.canonical_method;
      if (!counts[m]) counts[m] = { count: 0, total_minor: 0 };
      counts[m].count += 1;
      counts[m].total_minor += t.total_minor;
    }
    const arr = Object.entries(counts).map(([payment_method, data]) => ({
      payment_method,
      count: data.count,
      total_minor: data.total_minor,
    }));
    return mapPaymentMethods(arr, transactions.length);
  }, [rawSummary, transactions]);

  // Filtered transactions
  const filter: SalesFilterModel = useMemo(
    () => ({
      search,
      payment_method: paymentMethod,
      range,
      branch_id: branchId,
    }),
    [search, paymentMethod, range, branchId]
  );

  const filteredTransactions = useMemo(() => {
    return filterSalesTransactions(transactions, filter);
  }, [transactions, filter]);

  // Push new sale (realtime/fresh simulation or POS event integration)
  const pushSale = useCallback((newSale: Sale) => {
    setRawSales((prev) => [newSale, ...prev]);
    setFreshSaleIds((prev) => new Set([...prev, newSale.id]));
  }, []);

  // Export CSV
  const handleExportCsv = useCallback(
    (filename = 'laporan-penjualan.csv') => {
      downloadSalesCsv(filename, filteredTransactions);
    },
    [filteredTransactions]
  );

  return {
    dataState,
    error,
    kpi,
    trendPoints,
    paymentMethods,
    transactions,
    filteredTransactions,
    range,
    setRange,
    search,
    setSearch,
    paymentMethod,
    setPaymentMethod,
    refresh: loadData,
    pushSale,
    exportCsv: handleExportCsv,
  };
}
