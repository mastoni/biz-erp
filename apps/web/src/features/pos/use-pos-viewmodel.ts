/**
 * React ViewModel Hook for Web POS.
 * Coordinates product catalog, active branch stock, customer selection,
 * cart state machine, parked orders queue, dynamic store settings, and checkout mutation.
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
import { getStoreSettings } from '@/features/settings/api';
import { StoreSettings } from '@/features/settings/types';
import {
  calculateCartTotalsFromBps,
  canAddToCart,
  calculateChange,
  createTransactionId,
  mapPOSProductViewModel,
  mapPOSCustomerViewModel,
  buildCheckoutPayload,
  buildPOSReceiptViewModel,
} from './pos-helpers';
import { orchestratePostSaleDevices } from './pos-device';

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
  const [settingsState, setSettingsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const [rawProducts, setRawProducts] = useState<POSProductViewModel[]>([]);
  const [customers, setCustomers] = useState<POSCustomerViewModel[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
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

  // Presentation/device orchestration state — never affects a committed sale
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [deviceNotice, setDeviceNotice] = useState<string | null>(null);
  const [lastDeviceResult, setLastDeviceResult] = useState<ReturnType<
    typeof orchestratePostSaleDevices
  > | null>(null);
  const drawerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deviceNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track active tenant and branch to detect context switches
  const prevBusinessIdRef = useRef<string | null | undefined>(businessId);
  const prevBranchIdRef = useRef<string | null | undefined>(branchId);

  // ---------------------------------------------------------------------------
  // Resolved Settings Properties
  // ---------------------------------------------------------------------------
  const effectiveTaxRateBps = settings?.tax_rate_bps ?? 1100;
  const effectiveTaxRatePercent = Number((effectiveTaxRateBps / 100).toFixed(2));

  const enabledPaymentMethods = useMemo(() => {
    if (!settings?.payment_methods) {
      return { cash: true, qris: true, debit: true };
    }
    return {
      cash: settings.payment_methods.cash ?? true,
      qris: settings.payment_methods.qris ?? true,
      debit: settings.payment_methods.debit ?? true,
    };
  }, [settings]);

  const isCheckoutAvailable = useMemo(() => {
    return enabledPaymentMethods.cash || enabledPaymentMethods.qris || enabledPaymentMethods.debit;
  }, [enabledPaymentMethods]);

  const storeIdentity = useMemo(() => {
    return {
      store_name: settings?.store_name || businessName,
      address: settings?.address || '',
      phone: settings?.phone || '',
      receipt_footer: settings?.receipt_footer || 'Barang yang sudah dibeli tidak dapat ditukar · terima kasih',
    };
  }, [settings, businessName]);

  const printerPreferences = useMemo(() => {
    return {
      autoPrint: settings?.printer_config?.autoPrint ?? true,
      paper: settings?.printer_config?.paper ?? '80mm',
      copies: settings?.printer_config?.copies ?? 1,
      printLogo: settings?.printer_config?.printLogo ?? true,
      model: settings?.printer_config?.model ?? 'Epson TM-T82',
    };
  }, [settings]);

  const drawerPreferences = useMemo(() => {
    return {
      openOnPayment: settings?.drawer_config?.openOnPayment ?? true,
      openOnShift: settings?.drawer_config?.openOnShift ?? false,
      delayMs: settings?.drawer_config?.delayMs ?? 300,
    };
  }, [settings]);

  // ---------------------------------------------------------------------------
  // Load Master Data & Store Settings
  // ---------------------------------------------------------------------------
  const loadData = useCallback(async () => {
    if (!businessId) {
      setDataState('empty');
      return;
    }

    setDataState('loading');
    setSettingsState('loading');
    setError(null);

    try {
      const [productsData, stocksData, customersData, storeSettingsData] = await Promise.all([
        getPOSProducts(businessId),
        branchId ? getPOSStocks(businessId, branchId) : Promise.resolve({ items: [] }),
        getPOSCustomers(businessId),
        getStoreSettings(businessId, branchId).catch((err) => {
          console.warn('Failed to load store settings in POS:', err);
          return null;
        }),
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

      if (storeSettingsData) {
        setSettings(storeSettingsData);
        setSettingsState('ready');
      } else {
        setSettingsState('error');
      }

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
      // Clear cart, parked orders, active settings, and active transaction.
      // Resolved store settings are dropped so no stale branch/tenant config remains.
      setCartLines([]);
      setParkedOrders([]);
      setDiscountPercent(0);
      setSelectedCustomerId(null);
      setTransactionId(createTransactionId());
      setIsPaymentModalOpen(false);
      setReceipt(null);
      setCheckoutState('idle');
      setSettings(null);
      setDrawerOpen(false);
      setDeviceNotice(null);
      setLastDeviceResult(null);
      if (drawerTimerRef.current) clearTimeout(drawerTimerRef.current);
      if (deviceNoticeTimerRef.current) clearTimeout(deviceNoticeTimerRef.current);

      prevBusinessIdRef.current = businessId;
      prevBranchIdRef.current = branchId;
    }

    loadData();
  }, [businessId, branchId, loadData]);

  // Clear pending device timers on unmount
  useEffect(() => {
    return () => {
      if (drawerTimerRef.current) clearTimeout(drawerTimerRef.current);
      if (deviceNoticeTimerRef.current) clearTimeout(deviceNoticeTimerRef.current);
    };
  }, []);

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
  // Cart Calculations with Dynamic Tax Rate
  // ---------------------------------------------------------------------------
  const cart: POSCartViewModel = useMemo(() => {
    const totals = calculateCartTotalsFromBps(cartLines, discountPercent, effectiveTaxRateBps);
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
  }, [
    transactionId,
    selectedCustomerId,
    customerName,
    cartLines,
    discountPercent,
    effectiveTaxRateBps,
  ]);

  // ---------------------------------------------------------------------------
  // Cart Line Actions
  // ---------------------------------------------------------------------------
  const addToCart = useCallback(
    (product: POSProductViewModel, qtyToAdd: number = 1) => {
      if (qtyToAdd <= 0) return;

      setCartLines((prevLines) => {
        const existing = prevLines.find((l) => l.product_id === product.id);
        const currentCartQty = existing ? existing.quantity : 0;

        if (!canAddToCart(product, currentCartQty)) {
          return prevLines;
        }

        const newQty = currentCartQty + qtyToAdd;
        const lineSubtotal = newQty * product.price_minor;

        if (existing) {
          return prevLines.map((l) =>
            l.product_id === product.id
              ? {
                  ...l,
                  quantity: newQty,
                  line_subtotal_minor: lineSubtotal,
                }
              : l
          );
        } else {
          const newLine: POSCartLineViewModel = {
            product_id: product.id,
            product_name: product.name,
            sku: product.sku,
            category: product.category,
            quantity: newQty,
            unit_price_minor: product.price_minor,
            line_subtotal_minor: lineSubtotal,
            quantity_available: product.quantity_available,
          };
          return [...prevLines, newLine];
        }
      });
    },
    []
  );

  const removeFromCart = useCallback((productId: string) => {
    setCartLines((prev) => prev.filter((l) => l.product_id !== productId));
  }, []);

  const incrementQuantity = useCallback((productId: string) => {
    setCartLines((prev) =>
      prev.map((l) => {
        if (l.product_id !== productId) return l;
        if (l.quantity + 1 > l.quantity_available) return l;
        const newQty = l.quantity + 1;
        return {
          ...l,
          quantity: newQty,
          line_subtotal_minor: newQty * l.unit_price_minor,
        };
      })
    );
  }, []);

  const decrementQuantity = useCallback((productId: string) => {
    setCartLines((prev) => {
      const line = prev.find((l) => l.product_id === productId);
      if (!line) return prev;
      if (line.quantity <= 1) {
        return prev.filter((l) => l.product_id !== productId);
      }
      const newQty = line.quantity - 1;
      return prev.map((l) =>
        l.product_id === productId
          ? {
              ...l,
              quantity: newQty,
              line_subtotal_minor: newQty * l.unit_price_minor,
            }
          : l
      );
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCartLines((prev) => prev.filter((l) => l.product_id !== productId));
      return;
    }
    setCartLines((prev) =>
      prev.map((l) => {
        if (l.product_id !== productId) return l;
        const targetQty = Math.min(quantity, l.quantity_available);
        return {
          ...l,
          quantity: targetQty,
          line_subtotal_minor: targetQty * l.unit_price_minor,
        };
      })
    );
  }, []);

  const clearCart = useCallback(() => {
    setCartLines([]);
    setDiscountPercent(0);
    setSelectedCustomerId(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Parked Orders Actions
  // ---------------------------------------------------------------------------
  const saveParkedOrder = useCallback(() => {
    if (cart.lines.length === 0) return;

    const parked: POSParkedOrder = {
      transaction_id: cart.transaction_id,
      customer_id: cart.customer_id,
      customer_name: cart.customer_name,
      item_count: cart.item_count,
      saved_at: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      cart: { ...cart },
    };

    setParkedOrders((prev) => [parked, ...prev]);

    // Reset current active transaction to a fresh cart
    clearCart();
    setTransactionId(createTransactionId());
  }, [cart, clearCart]);

  const restoreParkedOrder = useCallback(
    (order: POSParkedOrder) => {
      // Restore selected order into active cart
      setTransactionId(order.cart.transaction_id);
      setSelectedCustomerId(order.cart.customer_id);
      setCartLines(order.cart.lines);
      setDiscountPercent(order.cart.discount_percent);

      // Remove from parked queue
      setParkedOrders((prev) => prev.filter((o) => o.transaction_id !== order.transaction_id));
    },
    []
  );

  const deleteParkedOrder = useCallback((transactionIdToDelete: string) => {
    setParkedOrders((prev) => prev.filter((o) => o.transaction_id !== transactionIdToDelete));
  }, []);

  // ---------------------------------------------------------------------------
  // Payment & Checkout State Machine
  // ---------------------------------------------------------------------------
  const paymentState: POSPaymentState = useMemo(() => {
    const totalMinor = cart.total_minor;
    const paidMinor = paymentMethod === 'CASH' ? cashReceived : totalMinor;
    const change = calculateChange(paidMinor, totalMinor);

    return {
      method: paymentMethod,
      paid_minor: paidMinor,
      change_minor: Math.max(0, change),
      is_sufficient: paymentMethod === 'CASH' ? paidMinor >= totalMinor : true,
      step: receipt ? 'done' : 'pay',
    };
  }, [cart.total_minor, paymentMethod, cashReceived, receipt]);

  const openPaymentModal = useCallback(() => {
    if (cart.lines.length === 0) return;

    if (settingsState === 'error') {
      setError('Pengaturan toko belum tersedia — pembayaran tidak dapat diproses.');
      return;
    }

    if (!isCheckoutAvailable) {
      setError('Semua metode pembayaran kasir non-aktif di pengaturan toko.');
      return;
    }

    // Auto-select first available method if current is disabled
    if (paymentMethod === 'CASH' && !enabledPaymentMethods.cash) {
      if (enabledPaymentMethods.qris) setPaymentMethod('QRIS');
      else if (enabledPaymentMethods.debit) setPaymentMethod('DEBIT');
    } else if (paymentMethod === 'QRIS' && !enabledPaymentMethods.qris) {
      if (enabledPaymentMethods.cash) setPaymentMethod('CASH');
      else if (enabledPaymentMethods.debit) setPaymentMethod('DEBIT');
    } else if (paymentMethod === 'DEBIT' && !enabledPaymentMethods.debit) {
      if (enabledPaymentMethods.cash) setPaymentMethod('CASH');
      else if (enabledPaymentMethods.qris) setPaymentMethod('QRIS');
    }

    setCashReceived(cart.total_minor);
    setReceipt(null);
    setIsPaymentModalOpen(true);
    setError(null);
  }, [cart.lines.length, cart.total_minor, isCheckoutAvailable, enabledPaymentMethods, paymentMethod]);

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
    setPaymentMethod(enabledPaymentMethods.cash ? 'CASH' : enabledPaymentMethods.qris ? 'QRIS' : 'DEBIT');
    setCheckoutState('idle');
    setDrawerOpen(false);
    setDeviceNotice(null);
    setLastDeviceResult(null);
    if (drawerTimerRef.current) clearTimeout(drawerTimerRef.current);
    if (deviceNoticeTimerRef.current) clearTimeout(deviceNoticeTimerRef.current);
  }, [clearCart, enabledPaymentMethods]);

  // ---------------------------------------------------------------------------
  // Presentation/Device Orchestration (printer + cash drawer)
  //
  // These are driver-free. A failure in either MUST NOT mutate the already
  // committed sale: each trigger runs inside orchestratePostSaleDevices which
  // isolates per-device errors.
  // ---------------------------------------------------------------------------
  const triggerCashDrawer = useCallback(() => {
    setDrawerOpen(true);
    if (drawerTimerRef.current) clearTimeout(drawerTimerRef.current);
    drawerTimerRef.current = setTimeout(() => setDrawerOpen(false), drawerPreferences.delayMs);
  }, [drawerPreferences.delayMs]);

  const triggerPrint = useCallback(() => {
    // Browser-native print is presentation only (no WebUSB/WebSerial driver).
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  }, []);

  const runDeviceOrchestration = useCallback(() => {
    const outcome = orchestratePostSaleDevices({
      drawer: drawerPreferences,
      printer: printerPreferences,
      triggerDrawer: triggerCashDrawer,
      triggerPrint,
    });
    setLastDeviceResult(outcome);

    const parts: string[] = [];
    if (outcome.drawerTriggered) parts.push('Laci kasir terbuka');
    if (outcome.printTriggered) parts.push('Struk otomatis dicetak');
    // Device failures are non-blocking: the sale is already committed.
    if (outcome.drawerError) parts.push(`Laci: ${outcome.drawerError}`);
    if (outcome.printError) parts.push(`Printer: ${outcome.printError}`);
    setDeviceNotice(parts.length ? parts.join(' · ') : null);

    if (deviceNoticeTimerRef.current) clearTimeout(deviceNoticeTimerRef.current);
    if (parts.length) {
      deviceNoticeTimerRef.current = setTimeout(() => setDeviceNotice(null), 5000);
    }
  }, [drawerPreferences, printerPreferences, triggerCashDrawer, triggerPrint]);

  const submitCheckout = useCallback(async () => {
    if (!businessId || !branchId || cart.lines.length === 0) return;
    if (checkoutState === 'submitting') return; // Prevent double submission

    if (!paymentState.is_sufficient) {
      setError('Jumlah pembayaran kurang dari total tagihan.');
      return;
    }

    // Prevent a stale/disabled payment method from bypassing resolved settings
    const methodKey =
      paymentState.method === 'CASH' ? 'cash' : paymentState.method === 'QRIS' ? 'qris' : 'debit';
    if (!enabledPaymentMethods[methodKey]) {
      setError('Metode pembayaran tidak aktif di pengaturan toko.');
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

      // Build printable receipt with dynamic store settings
      const receiptVM = buildPOSReceiptViewModel({
        businessName: storeIdentity.store_name,
        branchName,
        address: storeIdentity.address,
        phone: storeIdentity.phone,
        taxRatePercent: effectiveTaxRatePercent,
        cart,
        paymentMethod: paymentState.method,
        paidMinor: paymentState.paid_minor,
        changeMinor: paymentState.change_minor,
        cashierName,
        footer: storeIdentity.receipt_footer,
      });

      setReceipt(receiptVM);
      setCheckoutState('success');

      // Device orchestration is presentation-only and failure-isolated;
      // the sale above is already committed independently of any printer/drawer outcome.
      runDeviceOrchestration();

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
    storeIdentity,
    effectiveTaxRatePercent,
    branchName,
    cashierName,
    cashierId,
    cart,
    paymentState,
    checkoutState,
    enabledPaymentMethods,
    runDeviceOrchestration,
  ]);

  return {
    dataState,
    checkoutState,
    settingsState,
    settings,
    effectiveTaxRateBps,
    effectiveTaxRatePercent,
    enabledPaymentMethods,
    isCheckoutAvailable,
    storeIdentity,
    printerPreferences,
    drawerPreferences,
    drawerOpen,
    deviceNotice,
    lastDeviceResult,
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
