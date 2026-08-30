import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  BookkeepingTab,
  FinanceSummaryKPI,
  CashflowEntry,
  ReceivableItem,
  PayableItem,
  PaymentMethod,
} from './types';
import {
  getFinanceSummary,
  getFinanceCashflow,
  getReceivables,
  getPayables,
  createAndPostExpense,
  createAndPostIncome,
  collectReceivablePayment,
  payPurchaseOrder,
} from './api';

export interface UseBookkeepingViewModelOptions {
  businessId?: string;
  branchId?: string;
}

export function useBookkeepingViewModel({
  businessId,
  branchId,
}: UseBookkeepingViewModelOptions) {
  const [tab, setTab] = useState<BookkeepingTab>('jurnal');
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState<FinanceSummaryKPI | null>(null);
  const [cashflow, setCashflow] = useState<CashflowEntry[]>([]);
  const [receivables, setReceivables] = useState<ReceivableItem[]>([]);
  const [payables, setPayables] = useState<PayableItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [settlementModalData, setSettlementModalData] = useState<{
    open: boolean;
    kind: 'piutang' | 'hutang';
    item: ReceivableItem | PayableItem | null;
  }>({
    open: false,
    kind: 'piutang',
    item: null,
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sumData, cfData, recvData, payData] = await Promise.all([
        getFinanceSummary(),
        getFinanceCashflow({ branch_id: branchId }),
        getReceivables(branchId),
        getPayables(branchId),
      ]);
      setSummary(sumData);
      setCashflow(cfData);
      setReceivables(recvData.items || []);
      setPayables(payData.items || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Gagal memuat data pembukuan.');
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered lists
  const filteredCashflow = useMemo(() => {
    if (!search.trim()) return cashflow;
    const q = search.toLowerCase();
    return cashflow.filter(
      (c) =>
        (c.description && c.description.toLowerCase().includes(q)) ||
        c.account_name.toLowerCase().includes(q) ||
        c.account_code.toLowerCase().includes(q)
    );
  }, [cashflow, search]);

  const filteredReceivables = useMemo(() => {
    if (!search.trim()) return receivables;
    const q = search.toLowerCase();
    return receivables.filter(
      (r) =>
        (r.customer_name && r.customer_name.toLowerCase().includes(q)) ||
        (r.customer_id && r.customer_id.toLowerCase().includes(q)) ||
        r.id.toLowerCase().includes(q)
    );
  }, [receivables, search]);

  const filteredPayables = useMemo(() => {
    if (!search.trim()) return payables;
    const q = search.toLowerCase();
    return payables.filter(
      (p) =>
        (p.supplier_name && p.supplier_name.toLowerCase().includes(q)) ||
        p.code.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    );
  }, [payables, search]);

  // Actions
  const recordCashTransaction = async (
    type: 'masuk' | 'keluar',
    input: {
      description: string;
      category?: string;
      method: PaymentMethod;
      amount_minor: number;
      date?: string;
    }
  ) => {
    setIsSaving(true);
    try {
      const today = input.date || new Date().toISOString().slice(0, 10);
      if (type === 'masuk') {
        await createAndPostIncome({
          business_id: businessId,
          branch_id: branchId,
          date: today,
          amount_minor: input.amount_minor,
          method: input.method,
          category: input.category || 'Pemasukan Lainnya',
          description: input.description,
        });
      } else {
        await createAndPostExpense({
          business_id: businessId,
          branch_id: branchId,
          date: today,
          amount_minor: input.amount_minor,
          method: input.method,
          category: input.category || 'Operasional',
          description: input.description,
        });
      }
      await loadData();
      setCashModalOpen(false);
    } catch (err: any) {
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const settleReceivable = async (
    receivableId: string,
    amount_minor: number,
    method: PaymentMethod,
    reference?: string | null
  ) => {
    setIsSaving(true);
    try {
      await collectReceivablePayment(receivableId, {
        amount_minor,
        method,
        reference,
        date: new Date().toISOString().slice(0, 10),
      });
      await loadData();
      setSettlementModalData({ open: false, kind: 'piutang', item: null });
    } catch (err: any) {
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const settlePayable = async (
    purchaseId: string,
    expected_server_version: number,
    amount_minor: number,
    method: PaymentMethod,
    reference?: string | null
  ) => {
    if (!businessId) throw new Error('Business ID is required');
    setIsSaving(true);
    try {
      await payPurchaseOrder(purchaseId, {
        business_id: businessId,
        expected_server_version,
        amount_minor,
        method,
        reference,
      });
      await loadData();
      setSettlementModalData({ open: false, kind: 'hutang', item: null });
    } catch (err: any) {
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    tab,
    setTab,
    search,
    setSearch,
    summary,
    cashflow,
    receivables,
    payables,
    filteredCashflow,
    filteredReceivables,
    filteredPayables,
    isLoading,
    isSaving,
    error,
    cashModalOpen,
    setCashModalOpen,
    settlementModalData,
    setSettlementModalData,
    loadData,
    recordCashTransaction,
    settleReceivable,
    settlePayable,
  };
}
