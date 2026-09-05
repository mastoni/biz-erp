import React, { useState } from 'react';
import { X, HardDrive, Layers, CheckCircle2 } from 'lucide-react';
import { CreateDevicePayload, BulkCreateDevicePayload, DeviceType, DeviceOwnershipType } from '../types';

interface DeviceRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
  branches?: Array<{ id: string; name: string }>;
  products?: Array<{ id: string; name: string }>;
  onSubmitSingle: (payload: CreateDevicePayload) => Promise<void>;
  onSubmitBulk: (payload: BulkCreateDevicePayload) => Promise<void>;
}

export function DeviceRegisterModal({
  isOpen,
  onClose,
  branchId,
  branches = [],
  products = [],
  onSubmitSingle,
  onSubmitBulk,
}: DeviceRegisterModalProps) {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Single Form State
  const [singleForm, setSingleForm] = useState({
    branch_id: branchId,
    product_id: '',
    serial_number: '',
    mac_address: '',
    device_type: 'ROUTER' as DeviceType,
    ownership_type: 'TENANT_OWNED' as DeviceOwnershipType,
    warranty_months: 12,
    sync_inventory: true,
    notes: '',
  });

  // Bulk Form State
  const [bulkForm, setBulkForm] = useState({
    branch_id: branchId,
    product_id: '',
    device_type: 'ROUTER' as DeviceType,
    ownership_type: 'TENANT_OWNED' as DeviceOwnershipType,
    warranty_months: 12,
    sync_inventory: true,
    serials_text: '',
  });

  if (!isOpen) return null;

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!singleForm.serial_number.trim()) {
      setErrorMessage('Nomor seri wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitSingle({
        branch_id: singleForm.branch_id || branchId,
        product_id: singleForm.product_id || null,
        serial_number: singleForm.serial_number.trim(),
        mac_address: singleForm.mac_address.trim() || null,
        device_type: singleForm.device_type,
        ownership_type: singleForm.ownership_type,
        warranty_months: Number(singleForm.warranty_months) || 0,
        sync_inventory: singleForm.sync_inventory,
        notes: singleForm.notes.trim() || null,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mendaftarkan perangkat');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const lines = bulkForm.serials_text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setErrorMessage('Masukkan minimal 1 nomor seri untuk pendaftaran massal.');
      return;
    }

    const items = lines.map((line) => {
      // Support comma or tab separation for serial and MAC
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      return {
        serial_number: parts[0],
        mac_address: parts.length > 1 && parts[1] ? parts[1] : null,
      };
    });

    setIsSubmitting(true);
    try {
      await onSubmitBulk({
        branch_id: bulkForm.branch_id || branchId,
        product_id: bulkForm.product_id || null,
        device_type: bulkForm.device_type,
        ownership_type: bulkForm.ownership_type,
        warranty_months: Number(bulkForm.warranty_months) || 0,
        sync_inventory: bulkForm.sync_inventory,
        items,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mendaftarkan perangkat secara massal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-ink/10 bg-surface shadow-2xl overflow-hidden dark:border-ink/20">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-ink/10 px-6 py-4 dark:border-ink/20">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-pine/10 p-2 text-pine dark:bg-emerald-950/40 dark:text-emerald-400">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-ink">Registrasi Perangkat Hardware</h3>
              <p className="text-xs text-ink/60">Catat aset fisik hardware ke dalam sistem ERP.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink/50 hover:bg-ink/5 hover:text-ink cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-ink/10 bg-ink/[0.02] px-6 dark:border-ink/20">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              mode === 'single'
                ? 'border-pine text-pine dark:border-emerald-400 dark:text-emerald-400'
                : 'border-transparent text-ink/60 hover:text-ink'
            }`}
          >
            <HardDrive className="h-4 w-4" />
            <span>Satu Perangkat (Single)</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              mode === 'bulk'
                ? 'border-pine text-pine dark:border-emerald-400 dark:text-emerald-400'
                : 'border-transparent text-ink/60 hover:text-ink'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Massal (Bulk Input)</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-400">
            {errorMessage}
          </div>
        )}

        {/* Form Body */}
        {mode === 'single' ? (
          <form onSubmit={handleSingleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Serial Number */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-ink">
                  Nomor Seri (Serial Number) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: SN-GPON-098812"
                  value={singleForm.serial_number}
                  onChange={(e) => setSingleForm({ ...singleForm, serial_number: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs font-mono font-semibold text-ink uppercase focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
                />
              </div>

              {/* MAC Address */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-ink">MAC Address (Opsional)</label>
                <input
                  type="text"
                  placeholder="AA:BB:CC:DD:EE:FF"
                  value={singleForm.mac_address}
                  onChange={(e) => setSingleForm({ ...singleForm, mac_address: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs font-mono text-ink uppercase focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Device Type */}
              <div>
                <label className="block text-xs font-bold text-ink">Tipe Perangkat</label>
                <select
                  value={singleForm.device_type}
                  onChange={(e) => setSingleForm({ ...singleForm, device_type: e.target.value as DeviceType })}
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
                >
                  <option value="ROUTER">Router / Gateway</option>
                  <option value="ONT">ONT / GPON Modem</option>
                  <option value="ACCESS_POINT">Access Point WiFi</option>
                  <option value="POS_TERMINAL">POS Terminal</option>
                  <option value="PRINTER">Thermal Printer</option>
                  <option value="SCANNER">Barcode Scanner</option>
                  <option value="CASH_DRAWER">Cash Drawer</option>
                  <option value="CCTV_CAMERA">Kamera CCTV</option>
                  <option value="DVR_NVR">DVR / NVR Recorder</option>
                  <option value="OTHER">Lainnya (Other)</option>
                </select>
              </div>

              {/* Product SKU Selection */}
              <div>
                <label className="block text-xs font-bold text-ink">Model / Produk Katalog</label>
                <select
                  value={singleForm.product_id}
                  onChange={(e) => setSingleForm({ ...singleForm, product_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
                >
                  <option value="">-- Tanpa Relasi Produk --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Ownership Type */}
              <div>
                <label className="block text-xs font-bold text-ink">Status Kepemilikan</label>
                <select
                  value={singleForm.ownership_type}
                  onChange={(e) =>
                    setSingleForm({ ...singleForm, ownership_type: e.target.value as DeviceOwnershipType })
                  }
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
                >
                  <option value="TENANT_OWNED">Milik Usaha / Tenant</option>
                  <option value="CUSTOMER_OWNED">Milik Pelanggan</option>
                  <option value="LEASED_RENTED">Sewa / Pinjam (Leased)</option>
                </select>
              </div>

              {/* Warranty Months */}
              <div>
                <label className="block text-xs font-bold text-ink">Garansi (Bulan)</label>
                <input
                  type="number"
                  min="0"
                  value={singleForm.warranty_months}
                  onChange={(e) => setSingleForm({ ...singleForm, warranty_months: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
                />
              </div>
            </div>

            {/* Inventory Sync Toggle */}
            <div className="rounded-xl border border-ink/10 bg-ink/[0.02] p-3 dark:border-ink/20">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={singleForm.sync_inventory}
                  onChange={(e) => setSingleForm({ ...singleForm, sync_inventory: e.target.checked })}
                  className="h-4 w-4 rounded border-ink/30 text-pine focus:ring-pine cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-ink">Sinkronkan ke Inventaris (+1 Unit Stok)</div>
                  <div className="text-[11px] text-ink/60">
                    Otomatis menambah stok produk terkait di gudang cabang ini.
                  </div>
                </div>
              </label>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-ink">Catatan Perangkat</label>
              <input
                type="text"
                placeholder="Misal: Batch pengiriman PO-2026-08"
                value={singleForm.notes}
                onChange={(e) => setSingleForm({ ...singleForm, notes: e.target.value })}
                className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-ink/10 dark:border-ink/20">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg border border-ink/20 bg-paper px-4 py-2 text-xs font-semibold text-ink hover:bg-ink/5 dark:bg-slate-900/60 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-pine px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-pine-deep cursor-pointer"
              >
                {isSubmitting ? 'Mendaftarkan...' : 'Simpan Perangkat'}
              </button>
            </div>
          </form>
        ) : (
          /* Bulk Form */
          <form onSubmit={handleBulkSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink">Tipe Perangkat</label>
                <select
                  value={bulkForm.device_type}
                  onChange={(e) => setBulkForm({ ...bulkForm, device_type: e.target.value as DeviceType })}
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
                >
                  <option value="ROUTER">Router / Gateway</option>
                  <option value="ONT">ONT / GPON Modem</option>
                  <option value="ACCESS_POINT">Access Point WiFi</option>
                  <option value="POS_TERMINAL">POS Terminal</option>
                  <option value="PRINTER">Thermal Printer</option>
                  <option value="SCANNER">Barcode Scanner</option>
                  <option value="CASH_DRAWER">Cash Drawer</option>
                  <option value="CCTV_CAMERA">Kamera CCTV</option>
                  <option value="DVR_NVR">DVR / NVR Recorder</option>
                  <option value="OTHER">Lainnya (Other)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink">Model / Produk Katalog</label>
                <select
                  value={bulkForm.product_id}
                  onChange={(e) => setBulkForm({ ...bulkForm, product_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-xs text-ink focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
                >
                  <option value="">-- Tanpa Relasi Produk --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Serial Numbers List Textarea */}
            <div>
              <label className="block text-xs font-bold text-ink">
                Daftar Nomor Seri (1 per baris) <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={6}
                required
                placeholder="SN-GPON-001&#10;SN-GPON-002&#10;SN-GPON-003,AA:BB:CC:11:22:33"
                value={bulkForm.serials_text}
                onChange={(e) => setBulkForm({ ...bulkForm, serials_text: e.target.value })}
                className="mt-1 w-full rounded-lg border border-ink/15 bg-paper p-3 text-xs font-mono text-ink uppercase focus:border-pine focus:outline-none dark:border-ink/20 dark:bg-slate-900/60"
              />
              <p className="mt-1 text-[11px] text-ink/50">
                Format: <code className="font-mono font-bold">SERIAL</code> atau{' '}
                <code className="font-mono font-bold">SERIAL,MAC_ADDRESS</code> (pisahkan dengan koma).
              </p>
            </div>

            {/* Inventory Sync Toggle */}
            <div className="rounded-xl border border-ink/10 bg-ink/[0.02] p-3 dark:border-ink/20">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkForm.sync_inventory}
                  onChange={(e) => setBulkForm({ ...bulkForm, sync_inventory: e.target.checked })}
                  className="h-4 w-4 rounded border-ink/30 text-pine focus:ring-pine cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-ink">Sinkronkan ke Inventaris (+N Unit Stok)</div>
                  <div className="text-[11px] text-ink/60">
                    Otomatis menambah stok sesuai jumlah serial yang diinput ke gudang cabang.
                  </div>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-ink/10 dark:border-ink/20">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg border border-ink/20 bg-paper px-4 py-2 text-xs font-semibold text-ink hover:bg-ink/5 dark:bg-slate-900/60 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-pine px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-pine-deep cursor-pointer"
              >
                {isSubmitting ? 'Mendaftarkan Massal...' : 'Simpan Semua Serial'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
