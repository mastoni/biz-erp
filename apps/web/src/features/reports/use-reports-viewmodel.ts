'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  getSalesSummary,
  getDailySales,
  getRecentSales,
  getProductSales,
} from './api';
import { getStocks, getStockSummary } from '@/features/inventory/api';
import { getProducts } from '@/features/products/api';
import {
  formatReportsDateRange,
  mapExecutiveKPI,
  mapCashFlowPoints,
  mapSalesComposition,
  mapTopProducts,
  mapInventoryReport,
  mapProfitLoss,
  generateReportsCsv,
} from './reports-helpers';
import type {
  ReportsRange,
  ReportTab,
  ReportDataState,
  ReportsExecutiveKPI,
  CashFlowPoint,
  SalesCompositionItem,
  SalesReportViewModel,
  InventoryReportViewModel,
  ProfitLossViewModel,
  SalesSummaryReport,
  RecentSaleItem,
  ProductSalesReport,
} from './types';

interface UseReportsViewModelOptions {
  businessId?: string;
  branchId?: string;
}

export function useReportsViewModel({
  businessId,
  branchId,
}: UseReportsViewModelOptions) {
  const [range, setRange] = useState<ReportsRange>('30d');
  const [activeTab, setActiveTab] = useState<ReportTab>('penjualan');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Raw fetched states
  const [salesSummary, setSalesSummary] = useState<SalesSummaryReport | null>(null);
  const [dailyPoints, setDailyPoints] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSaleItem[]>([]);
  const [productSales, setProductSales] = useState<ProductSalesReport[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);

  const currentTenantRef = useRef<string | undefined>(businessId);
  const currentBranchRef = useRef<string | undefined>(branchId);

  const fetchAllData = useCallback(async () => {
    if (!businessId) {
      setSalesSummary(null);
      setDailyPoints([]);
      setRecentSales([]);
      setProductSales([]);
      setInventoryItems([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { from, to } = formatReportsDateRange(range);

    try {
      const [summaryRes, dailyRes, recentRes, productsRes, stocksRes] = await Promise.all([
        getSalesSummary(from, to, branchId).catch(() => ({
          sales_summary: {
            total_sales: 0,
            total_revenue_minor: 0,
            total_items_sold: 0,
            average_order_value_minor: 0,
            payment_methods: [],
          },
        })),
        getDailySales(from, to, branchId).catch(() => ({ points: [] })),
        getRecentSales(branchId, 10).catch(() => ({ sales: [] })),
        getProductSales(from, to, branchId).catch(() => ({ product_sales: [] })),
        branchId ? getStocks(businessId, branchId).catch(() => []) : getProducts(businessId, 0, 100).catch(() => ({ items: [] })),
      ]);

      setSalesSummary(summaryRes.sales_summary);
      setDailyPoints(dailyRes.points || []);
      setRecentSales(recentRes.sales || []);
      setProductSales(productsRes.product_sales || []);

      if (Array.isArray(stocksRes)) {
        setInventoryItems(stocksRes);
      } else if (stocksRes && Array.isArray((stocksRes as any).items)) {
        setInventoryItems(
          (stocksRes as any).items.map((p: any) => ({
            sku: p.sku,
            name: p.name,
            category: p.category,
            price_minor: p.price_minor,
            cost_minor: p.cost_minor,
            quantity: 0,
            is_active: p.is_active,
          }))
        );
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Gagal memuat laporan');
    } finally {
      setIsLoading(false);
    }
  }, [businessId, branchId, range]);

  // Tenant / Branch switch isolation
  useEffect(() => {
    if (currentTenantRef.current !== businessId) {
      currentTenantRef.current = businessId;
      setSalesSummary(null);
      setDailyPoints([]);
      setRecentSales([]);
      setProductSales([]);
      setInventoryItems([]);
    }
    if (currentBranchRef.current !== branchId) {
      currentBranchRef.current = branchId;
      setSalesSummary(null);
      setDailyPoints([]);
      setRecentSales([]);
      setProductSales([]);
    }
    fetchAllData();
  }, [businessId, branchId, range, fetchAllData]);

  // Derived ViewModels
  const kpi: ReportsExecutiveKPI = useMemo(() => {
    return mapExecutiveKPI(salesSummary, null, null);
  }, [salesSummary]);

  const cashFlow: CashFlowPoint[] = useMemo(() => {
    return mapCashFlowPoints(dailyPoints);
  }, [dailyPoints]);

  const salesComposition: SalesCompositionItem[] = useMemo(() => {
    return mapSalesComposition(productSales);
  }, [productSales]);

  const salesReport: SalesReportViewModel = useMemo(() => {
    return {
      summary: salesSummary || {
        total_sales: 0,
        total_revenue_minor: 0,
        total_items_sold: 0,
        average_order_value_minor: 0,
        payment_methods: [],
      },
      transactions: recentSales,
      top_products: mapTopProducts(productSales),
    };
  }, [salesSummary, recentSales, productSales]);

  const inventoryReport: InventoryReportViewModel = useMemo(() => {
    return mapInventoryReport(inventoryItems);
  }, [inventoryItems]);

  const profitLoss: ProfitLossViewModel = useMemo(() => {
    return mapProfitLoss(salesSummary?.total_revenue_minor ?? 0, null, null);
  }, [salesSummary]);

  const isP1Tab = ['pembelian', 'hutangpiutang', 'digital'].includes(activeTab);

  const p1TabUnavailableMessage = useMemo(() => {
    if (activeTab === 'pembelian') {
      return 'Modul Pembelian & PO Supplier belum memiliki data canonical backend.';
    }
    if (activeTab === 'hutangpiutang') {
      return 'Buku Hutang & Piutang belum terhubung ke database canonical.';
    }
    if (activeTab === 'digital') {
      return 'Layanan Kios Digital & PPOB belum aktif pada bisnis ini.';
    }
    return null;
  }, [activeTab]);

  const state: ReportDataState = useMemo(() => {
    if (isLoading) return 'loading';
    if (error) return 'error';
    if (!salesSummary || salesSummary.total_sales === 0) return 'empty';
    return 'ready';
  }, [isLoading, error, salesSummary]);

  const exportCsv = useCallback(() => {
    return generateReportsCsv(activeTab, {
      range,
      sales: recentSales,
      profitLoss,
      inventory: inventoryReport,
      items: inventoryItems.map((it) => ({
        sku: it.sku || '—',
        name: it.name || it.product_name || '—',
        category: it.category || 'Lainnya',
        stock: it.quantity ?? 0,
        price: Math.round((it.price_minor ?? 0) / 100),
      })),
    });
  }, [activeTab, range, recentSales, profitLoss, inventoryReport, inventoryItems]);

  return {
    range,
    setRange,
    activeTab,
    setActiveTab,
    state,
    isLoading,
    error,
    kpi,
    cashFlow,
    salesComposition,
    salesReport,
    inventoryReport,
    profitLoss,
    isP1Tab,
    p1TabUnavailableMessage,
    refresh: fetchAllData,
    exportCsv,
  };
}
