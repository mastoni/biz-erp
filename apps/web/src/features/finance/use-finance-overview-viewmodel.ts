import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  FinanceSummaryKPI,
  FinanceOverviewKPIs,
  MonthlyCashflowPoint,
  RecentExpenseItem,
  CashflowEntry,
} from './types';
import {
  getFinanceSummary,
  getMonthlyCashflowReport,
  getRecentExpenses,
  getReceivables,
} from './api';

export interface UseFinanceOverviewViewModelOptions {
  businessId?: string;
  branchId?: string;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function useFinanceOverviewViewModel({
  businessId,
  branchId,
}: UseFinanceOverviewViewModelOptions) {
  const [summary, setSummary] = useState<FinanceSummaryKPI | null>(null);
  const [cashflowEntries, setCashflowEntries] = useState<CashflowEntry[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<RecentExpenseItem[]>([]);
  const [receivablesTotal, setReceivablesTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverviewData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sumData, cfData, expData, recvData] = await Promise.all([
        getFinanceSummary(),
        getMonthlyCashflowReport({ branch_id: branchId }),
        getRecentExpenses(branchId, 10),
        getReceivables(branchId),
      ]);

      setSummary(sumData);
      setCashflowEntries(cfData.entries || []);
      setRecentExpenses(expData || []);
      
      const totalRecv = (recvData.items || []).reduce(
        (acc, r) => acc + (r.outstanding_minor || 0),
        0
      );
      setReceivablesTotal(totalRecv);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Gagal memuat data laporan keuangan.');
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);

  // Compute 4 Executive KPIs
  const kpis: FinanceOverviewKPIs = useMemo(() => {
    if (!summary) {
      return {
        kas_bank_minor: 0,
        piutang_minor: 0,
        hutang_minor: 0,
        laba_bersih_minor: 0,
        margin_percent: 0,
      };
    }

    const marginPercent =
      summary.total_revenue > 0
        ? Math.round((summary.net_income / summary.total_revenue) * 100)
        : 0;

    return {
      kas_bank_minor: summary.total_assets,
      piutang_minor: receivablesTotal,
      hutang_minor: summary.total_liabilities,
      laba_bersih_minor: summary.net_income,
      margin_percent: marginPercent,
    };
  }, [summary, receivablesTotal]);

  // Compute Monthly Cashflow Points (Grouping cashflow entries by month)
  const monthlyCashflow: MonthlyCashflowPoint[] = useMemo(() => {
    if (!cashflowEntries.length) return [];

    const monthMap = new Map<string, { label: string; inflow: number; outflow: number }>();

    cashflowEntries.forEach((entry) => {
      if (!entry.date) return;
      const [year, monthStr] = entry.date.split('-');
      const monthIdx = parseInt(monthStr, 10) - 1;
      const key = `${year}-${monthStr}`;
      const label = MONTH_NAMES[monthIdx] || monthStr;

      const current = monthMap.get(key) || { label, inflow: 0, outflow: 0 };
      if (entry.debit_minor > 0) {
        current.inflow += entry.debit_minor;
      }
      if (entry.credit_minor > 0) {
        current.outflow += entry.credit_minor;
      }
      monthMap.set(key, current);
    });

    const sortedKeys = Array.from(monthMap.keys()).sort();
    return sortedKeys.map((key) => {
      const item = monthMap.get(key)!;
      return {
        month: key,
        label: item.label,
        inflow_minor: item.inflow,
        outflow_minor: item.outflow,
        net_flow_minor: item.inflow - item.outflow,
      };
    });
  }, [cashflowEntries]);

  // Rekening Koran / Export Handler
  const exportRekeningKoran = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }, []);

  return {
    kpis,
    summary,
    monthlyCashflow,
    recentExpenses,
    isLoading,
    error,
    refresh: loadOverviewData,
    exportRekeningKoran,
  };
}
