'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StoreSettingsViewModel,
  SettingsDataState,
  SettingsSaveState,
  PaymentMethodsConfig,
  PrinterConfig,
  DrawerConfig,
  ScannerConfig,
  BarcodeConfig,
} from './types';
import { getStoreSettings, updateStoreSettings } from './api';
import {
  mapSettingsToViewModel,
  mapViewModelToUpdatePayload,
  CANONICAL_SETTINGS_DEFAULTS,
} from './settings-helpers';

export interface UseSettingsViewModelOptions {
  businessId?: string | null;
  branchId?: string | null;
  role?: string | null;
}

export function useSettingsViewModel(options: UseSettingsViewModelOptions) {
  const { businessId, branchId, role } = options;

  const isReadOnly = role !== 'OWNER';

  const [dataState, setDataState] = useState<SettingsDataState>('loading');
  const [saveState, setSaveState] = useState<SettingsSaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  const [initialSettings, setInitialSettings] = useState<StoreSettingsViewModel | null>(null);
  const [draft, setDraft] = useState<StoreSettingsViewModel>(CANONICAL_SETTINGS_DEFAULTS);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'warn' | 'info' | 'error' } | null>(null);

  const drawerTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (drawerTimerRef.current) clearTimeout(drawerTimerRef.current);
    };
  }, []);

  const pushToast = useCallback(
    (message: string, tone: 'success' | 'warn' | 'info' | 'error' = 'info') => {
      setToast({ message, tone });
      setTimeout(() => {
        setToast((current) => (current?.message === message ? null : current));
      }, 3500);
    },
    []
  );

  // Load Settings from API
  const loadSettings = useCallback(async () => {
    if (!businessId) {
      setDataState('empty');
      return;
    }

    setDataState('loading');
    setError(null);
    setSaveState('idle');

    try {
      const raw = await getStoreSettings(businessId, branchId);
      const vm = mapSettingsToViewModel(raw);
      setInitialSettings(vm);
      setDraft(vm);
      setDataState('ready');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Gagal memuat pengaturan toko';
      setError(msg);
      setDataState('error');
    }
  }, [businessId, branchId]);

  // Reload when tenant or branch switches
  useEffect(() => {
    setInitialSettings(null);
    setDraft(CANONICAL_SETTINGS_DEFAULTS);
    loadSettings();
  }, [loadSettings]);

  // Dirty flag comparison
  const isDirty = useMemo(() => {
    if (!initialSettings) return false;
    return JSON.stringify(draft) !== JSON.stringify(initialSettings);
  }, [draft, initialSettings]);

  // Mutation Handlers
  const updateDraft = useCallback((patch: Partial<StoreSettingsViewModel>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateField = useCallback(
    <K extends keyof StoreSettingsViewModel>(field: K, value: StoreSettingsViewModel[K]) => {
      setDraft((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const updatePaymentMethods = useCallback((patch: Partial<PaymentMethodsConfig>) => {
    setDraft((prev) => ({
      ...prev,
      paymentMethods: { ...prev.paymentMethods, ...patch },
    }));
  }, []);

  const updatePrinter = useCallback((patch: Partial<PrinterConfig>) => {
    setDraft((prev) => ({
      ...prev,
      printer: { ...prev.printer, ...patch },
    }));
  }, []);

  const updateDrawer = useCallback((patch: Partial<DrawerConfig>) => {
    setDraft((prev) => ({
      ...prev,
      drawer: { ...prev.drawer, ...patch },
    }));
  }, []);

  const updateScanner = useCallback((patch: Partial<ScannerConfig>) => {
    setDraft((prev) => ({
      ...prev,
      scanner: { ...prev.scanner, ...patch },
    }));
  }, []);

  const updateBarcode = useCallback((patch: Partial<BarcodeConfig>) => {
    setDraft((prev) => ({
      ...prev,
      barcode: { ...prev.barcode, ...patch },
    }));
  }, []);

  // Discard changes
  const discardChanges = useCallback(() => {
    if (initialSettings) {
      setDraft(initialSettings);
      setSaveState('idle');
      pushToast('Perubahan dibuang.', 'info');
    }
  }, [initialSettings, pushToast]);

  // Save Settings
  const saveSettings = useCallback(async () => {
    if (isReadOnly) {
      setSaveState('forbidden');
      pushToast('Hanya Owner yang dapat mengubah pengaturan toko.', 'error');
      return;
    }

    if (!businessId) {
      setError('Business ID tidak ditemukan.');
      return;
    }

    setSaveState('saving');
    setError(null);

    try {
      const payload = mapViewModelToUpdatePayload(draft);
      const updatedRaw = await updateStoreSettings(businessId, branchId, payload);
      const updatedVm = mapSettingsToViewModel(updatedRaw);

      setInitialSettings(updatedVm);
      setDraft(updatedVm);
      setSaveState('saved');
      pushToast('Pengaturan toko disimpan dan diterapkan ke terminal kasir.', 'success');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Gagal menyimpan pengaturan toko';
      setError(msg);
      setSaveState('error');
      pushToast(msg, 'error');
    }
  }, [businessId, branchId, draft, isReadOnly, pushToast]);

  // Hardware Simulators
  const testPrint = useCallback(() => {
    pushToast(`Tes cetak dikirim ke ${draft.printer.model}.`, 'info');
  }, [draft.printer.model, pushToast]);

  const testDrawer = useCallback(() => {
    setDrawerOpen(true);
    if (drawerTimerRef.current) clearTimeout(drawerTimerRef.current);
    drawerTimerRef.current = setTimeout(() => {
      setDrawerOpen(false);
    }, 1500);
    pushToast(`Perintah buka laci dikirim (${draft.drawer.delayMs} ms) — laci kasir terbuka.`, 'info');
  }, [draft.drawer.delayMs, pushToast]);

  const testScan = useCallback(() => {
    const testSku = `${draft.barcode.prefix}SMB-01`;
    setLastScan(`${testSku} · Kopi Susu Gula Aren`);
    pushToast(draft.scanner.sound ? 'Pindai berhasil (bunyi aktif).' : 'Pindai berhasil.', 'info');
  }, [draft.barcode.prefix, draft.scanner.sound, pushToast]);

  return {
    dataState,
    saveState,
    isReadOnly,
    isDirty,
    error,
    toast,
    draft,
    drawerOpen,
    lastScan,
    // Actions
    loadSettings,
    updateDraft,
    updateField,
    updatePaymentMethods,
    updatePrinter,
    updateDrawer,
    updateScanner,
    updateBarcode,
    saveSettings,
    discardChanges,
    testPrint,
    testDrawer,
    testScan,
    pushToast,
  };
}
