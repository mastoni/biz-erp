/**
 * React ViewModel Hook for Web POS.
 * Coordinates product catalog, active branch stock, customer selection,
 * cart state machine, parked orders queue, and checkout mutation.
 */

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  POSCartLineViewModel,
  POSCartViewModel,
  POSCustomerViewModel,
  POSDailyCounter,
  POSDataState,
  POSCheckoutState,
  POSParkedOrder,
  POSPaymentState,
  POSProductViewModel,
  POSReceiptViewModel,
  PaymentMethod,
} from './types';
import {
  getPOSProducts,
  getPOSStocks,
  getPOSCustomers,
  getPOSDailyCounter,
  submitPOSCheckout,
} from './api';
import {
  calculateCartTotals,
  canAddToCart,
  calculateChange,
  createTransactionId,
  mapPOSProductViewModel,
  mapPOSCustomerViewModel,
  buildCheckoutPayload,
  buildPOSReceiptViewModel,
  DEFAULT_TAX_RATE,
} from './pos-helpers';

export interface UsePOSViewModelOptions {
  businessId?: string | null;
  branchId?: string | null;
  businessName?: string;
  branchName?: string;
  cashierName?: string;
  cashierId?: string | null;
}

export function usePOSViewModel({
  businessId,
  branchId,
  businessName = 'SKM Mart',
  branchName = 'Cabang Utama',
  cashierName = 'Kasir',
  cashierId = null,
}: UsePOSViewModelOptions) {
  const [dataState, setDataState] = useState<POSDataState>('loading');
  const [checkoutState, setCheckoutState] = useState<POSCheckoutState>('idle');
  const [error, setError] = useState<string | null>(null);

  const [rawProducts, setRawProducts] = useState<POSProductViewModel[]>([]);
  const [customers, setCustomers] = useState<POSCustomerViewModel[]>([]);
  const [dailyCounter, setDailyCounter] = useState<POSDailyCounter>({
    total_sales: 0,
    total_revenue_minor: 0,
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');

  const [transactionId, setTransactionId] = useState<string>(createTransactionId);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [cartLines, setCartLines] = useState<POSCartLineViewModel[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  const [parkedOrders, setParkedOrders] = useState<POSParkedOrder[]>([]);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [receipt, setReceipt] = useState<POSReceiptViewModel | null>(null);

  // Track active tenant and branch to detect context switches
  const prevBusinessIdRef = useRef<string | null | undefined>(businessId);
  const prevBranchIdRef = useRef<string | null | undefined>(branchId);

  // ---------------------------------------------------------------------------
  // Load Master Data
  // ---------------------------------------------------------------------------
  const loadData = useCallback(async () => {
    if (!businessId) {
      setDataState('empty');
      return;
    }

    setDataState('loading');
    setError(null);

    try {
      const [productsData, stocksData, customersData] = await Promise.all([
        getPOSProducts(businessId),
        branchId ? getPOSStocks(businessId, branchId) : Promise.resolve({ items: [] }),
        getPOSCustomers(businessId),
      ]);

      const stockMap = new Map<string, number>();
      if (stocksData?.items) {
        for (const item of stocksData.items) {
          stockMap.set(item.product_id, item.quantity);
        }
      }

      const mappedProducts = productsData.map((p) => {
        const qty = stockMap.get(p.id) ?? 0;
        return mapPOSProductViewModel(p, qty);
      });

      const mappedCustomers = (customersData.items || []).map(mapPOSCustomerViewModel);

      setRawProducts(mappedProducts);
      setCustomers(mappedCustomers);

      // Load today's sales summary for daily shift badge
      if (branchId) {
        const todayStr = new Date().toISOString().split('T')[0];
        const counter = await getPOSDailyCounter(businessId, branchId, todayStr);
        setDailyCounter(counter);
      }

      setDataState(mappedProducts.length === 0 ? 'empty' : 'ready');
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat data produk dan stok');
      setDataState('error');
    }
  }, [businessId, branchId]);

  // Handle tenant or branch context switches
  useEffect(() => {
    const isTenantChanged = prevBusinessIdRef.current !== businessId;
    const isBranchChanged = prevBranchIdRef.current !== branchId;

    if (isTenantChanged || isBranchChanged) {
      // Clear cart, parked orders, and active transaction
      setCartLines([]);
      setParkedOrders([]);
      setDiscountPercent(0);
      setSelectedCustomerId(null);
      setTransactionId(createTransactionId());
      setIsPaymentModalOpen(false);
      setReceipt(null);
      setCheckoutState('idle');

      prevBusinessIdRef.current = businessId;
      prevBranchIdRef.current = branchId;
    }

    loadData();
  }, [businessId, branchId, loadData]);

  // ---------------------------------------------------------------------------
  // Categories & Filtering
  // ---------------------------------------------------------------------------
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of rawProducts) {
      if (p.category) set.add(p.category);
    }
    return ['Semua', ...Array.from(set)];
  }, [rawProducts]);

  const filteredProducts = useMemo(() => {
    return rawProducts.filter((p) => {
      const matchCat = selectedCategory === 'Semua' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [rawProducts, selectedCategory, searchQuery]);

  // ---------------------------------------------------------------------------
  // Customer selection helper
  // ---------------------------------------------------------------------------
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  const customerName = selectedCustomer ? selectedCustomer.name : 'Umum';

  // ---------------------------------------------------------------------------
  // Cart Calculations
  // ---------------------------------------------------------------------------
  const cart: POSCartViewModel = useMemo(() => {
    const totals = calculateCartTotals(cartLines, discountPercent, DEFAULT_TAX_RATE);
    return {
      transaction_id: transactionId,
      customer_id: selectedCustomerId,
      customer_name: customerName,
      lines: cartLines,
      subtotal_minor: totals.subtotal_minor,
      discount_percent: totals.discount_percent,
      discount_minor: totals.discount_minor,
      tax_minor: totals.tax_minor,
      total_minor: totals.total_minor,
      item_count: totals.item_count,
    };
  }, [transactionId, selectedCustomerId, customerName, cartLines, discountPercent]);

  // ---------------------------------------------------------------------------
  // Cart Actions
  // ---------------------------------------------------------------------------
  const addToCart = useCallback(
    (product: POSProductViewModel) => {
      if (product.quantity_available <= 0) return;

      setCartLines((current) => {
        const existingIndex = current.findIndex((l) => l.product_id === product.id);
        if (existingIndex >= 0) {
          const line = current[existingIndex];
          if (line.quantity >= product.quantity_available) {
            return current; // Max available stock reached
          }
          const updated = [...current];
          const newQty = line.quantity + 1;
          updated[existingIndex] = {
            ...line,
            quantity: newQty,
            line_subtotal_minor: newQty * line.unit_price_minor,
          };
          return updated;
        }

        const newLine: POSCartLineViewModel = {
          product_id: product.id,
          product_name: product.name,
          sku: product.sku,
          category: product.category,
          quantity: 1,
          unit_price_minor: product.price_minor,
          line_subtotal_minor: product.price_minor,
          quantity_available: product.quantity_available,
        };
        return [...current, newLine];
      });
    },
    []
  );

  const removeFromCart = useCallback((productId: string) => {
    setCartLines((current) => current.filter((l) => l.product_id !== productId));
  }, []);

  const incrementQuantity = useCallback((productId: string) => {
    setCartLines((current) => {
      const idx = current.findIndex((l) => l.product_id === productId);
      if (idx < 0) return current;
      const line = current[idx];
      if (line.quantity >= line.quantity_available) return current;
      const updated = [...current];
      const newQty = line.quantity + 1;
      updated[idx] = {
        ...line,
        quantity: newQty,
        line_subtotal_minor: newQty * line.unit_price_minor,
      };
      return updated;
    });
  }, []);

  const decrementQuantity = useCallback((productId: string) => {
    setCartLines((current) => {
      const idx = current.findIndex((l) => l.product_id === productId);
      if (idx < 0) return current;
      const line = current[idx];
      if (line.quantity <= 1) {
        return current.filter((l) => l.product_id !== productId);
      }
      const updated = [...current];
      const newQty = line.quantity - 1;
      updated[idx] = {
        ...line,
        quantity: newQty,
        line_subtotal_minor: newQty * line.unit_price_minor,
      };
      return updated;
    });
  }, []);

  const setQuantity = useCallback((productId: string, qty: number) => {
    setCartLines((current) => {
      const idx = current.findIndex((l) => l.product_id === productId);
      if (idx < 0) return current;
      const line = current[idx];
      if (qty <= 0) {
        return current.filter((l) => l.product_id !== productId);
      }
      const clampedQty = Math.min(qty, line.quantity_available);
      const updated = [...current];
      updated[idx] = {
        ...line,
        quantity: clampedQty,
        line_subtotal_minor: clampedQty * line.unit_price_minor,
      };
      return updated;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCartLines([]);
    setDiscountPercent(0);
    setSelectedCustomerId(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Parked Orders (Client memory queue)
  // ---------------------------------------------------------------------------
  const saveParkedOrder = useCallback(() => {
    if (cartLines.length === 0) return;

    const timeStr = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const parkedItem: POSParkedOrder = {
      transaction_id: cart.transaction_id,
      customer_id: cart.customer_id,
      customer_name: cart.customer_name,
      item_count: cart.item_count,
      saved_at: timeStr,
      cart: { ...cart },
    };

    setParkedOrders((prev) => [...prev, parkedItem]);
    clearCart();
    setTransactionId(createTransactionId());
  }, [cart, cartLines.length, clearCart]);

  const restoreParkedOrder = useCallback((order: POSParkedOrder) => {
    setCartLines(order.cart.lines);
    setSelectedCustomerId(order.cart.customer_id);
    setDiscountPercent(order.cart.discount_percent);
    setTransactionId(order.transaction_id);
    setParkedOrders((prev) => prev.filter((p) => p.transaction_id !== order.transaction_id));
  }, []);

  const deleteParkedOrder = useCallback((trxId: string) => {
    setParkedOrders((prev) => prev.filter((p) => p.transaction_id !== trxId));
  }, []);

  // ---------------------------------------------------------------------------
  // Payment & Checkout State
  // ---------------------------------------------------------------------------
  const paymentState: POSPaymentState = useMemo(() => {
    const isCash = paymentMethod === 'CASH';
    const effectivePaid = isCash ? cashReceived : cart.total_minor;
    const change = calculateChange(effectivePaid, cart.total_minor);
    const isSufficient = effectivePaid >= cart.total_minor;

    return {
      method: paymentMethod,
      paid_minor: effectivePaid,
      change_minor: isCash && change > 0 ? change : 0,
      is_sufficient: isSufficient,
      step: receipt ? 'done' : 'pay',
    };
  }, [paymentMethod, cashReceived, cart.total_minor, receipt]);

  const openPaymentModal = useCallback(() => {
    setPaymentMethod('CASH');
    setCashReceived(cart.total_minor);
    setReceipt(null);
    setCheckoutState('idle');
    setIsPaymentModalOpen(true);
  }, [cart.total_minor]);

  const closePaymentModal = useCallback(() => {
    if (receipt) {
      // If payment completed, close and start fresh transaction
      setIsPaymentModalOpen(false);
      clearCart();
      setReceipt(null);
      setTransactionId(createTransactionId());
      setCheckoutState('idle');
    } else {
      setIsPaymentModalOpen(false);
    }
  }, [receipt, clearCart]);

  const resetTransaction = useCallback(() => {
    setIsPaymentModalOpen(false);
    clearCart();
    setReceipt(null);
    setTransactionId(createTransactionId());
    setCashReceived(0);
    setPaymentMethod('CASH');
    setCheckoutState('idle');
  }, [clearCart]);

  const submitCheckout = useCallback(async () => {
    if (!businessId || !branchId || cart.lines.length === 0) return;
    if (checkoutState === 'submitting') return; // Prevent double submission

    if (!paymentState.is_sufficient) {
      setError('Jumlah pembayaran kurang dari total tagihan.');
      return;
    }

    setCheckoutState('submitting');
    setError(null);

    try {
      const payload = buildCheckoutPayload({
        businessId,
        branchId,
        cart,
        paymentMethod: paymentState.method,
        paidMinor: paymentState.paid_minor,
        changeMinor: paymentState.change_minor,
        cashierId,
      });

      const response = await submitPOSCheckout(payload);

      const result = response.results?.[0];
      if (result?.status === 'receipt_conflict') {
        setCheckoutState('conflict');
        setError('Nomor struk transaksi duplikat / konflik.');
        return;
      }

      // Build printable receipt
      const receiptVM = buildPOSReceiptViewModel({
        businessName,
        branchName,
        cart,
        paymentMethod: paymentState.method,
        paidMinor: paymentState.paid_minor,
        changeMinor: paymentState.change_minor,
        cashierName,
      });

      setReceipt(receiptVM);
      setCheckoutState('success');

      // Optimistically decrement local available stock for purchased items
      setRawProducts((prev) =>
        prev.map((p) => {
          const purchasedLine = cart.lines.find((l) => l.product_id === p.id);
          if (!purchasedLine) return p;
          const updatedQty = Math.max(0, p.quantity_available - purchasedLine.quantity);
          return mapPOSProductViewModel(
            {
              id: p.id,
              business_id: businessId,
              name: p.name,
              sku: p.sku,
              price_minor: p.price_minor,
              cost_minor: null,
              category: p.category,
              description: null,
              barcode: null,
              is_active: true,
              server_version: 1,
              created_at: '',
              updated_at: '',
            },
            updatedQty
          );
        })
      );

      // Increment daily shift counter
      setDailyCounter((prev) => ({
        total_sales: prev.total_sales + 1,
        total_revenue_minor: prev.total_revenue_minor + cart.total_minor,
      }));
    } catch (err: any) {
      const isConflict = err?.response?.status === 409 || err?.code === 'CONFLICT';
      setCheckoutState(isConflict ? 'conflict' : 'error');
      setError(err?.response?.data?.message || err?.message || 'Gagal memproses transaksi kasir');
    }
  }, [
    businessId,
    branchId,
    businessName,
    branchName,
    cashierName,
    cashierId,
    cart,
    paymentState,
    checkoutState,
  ]);

  return {
    dataState,
    checkoutState,
    error,
    searchQuery,
    selectedCategory,
    categories,
    filteredProducts,
    customers,
    selectedCustomerId,
    selectedCustomer,
    cart,
    parkedOrders,
    isPaymentModalOpen,
    paymentMethod,
    paymentState,
    cashReceived,
    receipt,
    dailyCounter,
    // Actions
    setSearchQuery,
    setSelectedCategory,
    setCustomer: setSelectedCustomerId,
    setDiscountPercent,
    addToCart,
    removeFromCart,
    incrementQuantity,
    decrementQuantity,
    setQuantity,
    clearCart,
    saveParkedOrder,
    restoreParkedOrder,
    deleteParkedOrder,
    setPaymentMethod,
    setCashReceived,
    openPaymentModal,
    closePaymentModal,
    submitCheckout,
    resetTransaction,
    refresh: loadData,
  };
}
