'use client';

import React, { useState, ReactNode } from 'react';
import { PRINTER_MODELS } from '../settings-helpers';
import { useSettingsViewModel } from '../use-settings-viewmodel';

/* ============ Formatters ============ */
function idr(v: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v);
}
function num(v: number): string {
  return new Intl.NumberFormat('id-ID').format(v);
}
function cx(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/* ============ Deterministic Barcode SVG ============ */
export function BarcodeSvg({ value, className = '' }: { value: string; className?: string }) {
  let h = 2166136261;
  for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const rnd = () => {
    h ^= h << 13;
    h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    return h / 4294967296;
  };
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  const total = 62;
  while (x < total - 1.4) {
    const w = 0.7 + Math.round(rnd() * 2) * 0.8;
    bars.push({ x, w });
    x += w + 0.7 + rnd() * 1.1;
  }
  return (
    <svg viewBox={`0 0 ${total} 20`} preserveAspectRatio="none" className={className} aria-hidden>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y="0" width={b.w} height="20" />
      ))}
    </svg>
  );
}

/* ============ Setting Card Container ============ */
export function SettingCard({
  id,
  icon,
  title,
  desc,
  children,
  side,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  desc: string;
  children: ReactNode;
  side?: ReactNode;
}) {
  return (
    <section id={id} className="rounded-xl border border-line bg-surface scroll-mt-24 overflow-hidden shadow-xs">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-paper/50 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-pine-soft text-pine font-bold">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-[16px] font-bold leading-tight text-ink">{title}</h3>
          <p className="text-[11.5px] text-fog">{desc}</p>
        </div>
        {side && <div className="ml-auto">{side}</div>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/* ============ Toggle Row ============ */
export function ToggleRow({
  label,
  desc,
  on,
  disabled = false,
  onChange,
}: {
  label: string;
  desc: string;
  on: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface px-4 py-3 transition-colors hover:border-pine/30">
      <div>
        <p className="text-[13.5px] font-bold leading-tight text-ink">{label}</p>
        <p className="mt-0.5 text-[11.5px] text-fog">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={() => !disabled && onChange(!on)}
        className={cx(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-pine/20',
          on ? 'bg-pine' : 'bg-line',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span
          className={cx(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
            on ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}

/* ============ Navigation Sections ============ */
const SECTIONS = [
  { id: 'toko', label: 'Info Toko', icon: '🏪' },
  { id: 'printer', label: 'Struk & Printer', icon: '🖨️' },
  { id: 'barcode', label: 'Barcode & Label', icon: '🏷️' },
  { id: 'scanner', label: 'Scanner', icon: '📷' },
  { id: 'laci', label: 'Laci Kasir', icon: '🗄️' },
  { id: 'perangkat', label: 'Perangkat', icon: '🔌' },
];

export const CONTROLLED_DEVICES = [
  { id: 'printer', name: 'Printer Struk Epson TM-T82', port: 'USB001 · Port Seri', status: 'terhubung' as const },
  { id: 'scanner', name: 'Barcode Scanner Honeywell Voyager', port: 'COM3 · USB HID', status: 'terhubung' as const },
  { id: 'drawer', name: 'Laci Kasir EPSON UB-E04', port: 'RJ11 · Pin 2 Solenoid', status: 'terhubung' as const },
];

/* ============ Main SettingsView Component ============ */
export function SettingsView({
  businessId,
  branchId,
  role,
}: {
  businessId?: string | null;
  branchId?: string | null;
  role?: string | null;
}) {
  const vm = useSettingsViewModel({ businessId, branchId, role });
  const [activeSection, setActiveSection] = useState('toko');

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const paperW = vm.draft.printer.paper === '58mm' ? 'w-[190px]' : 'w-[252px]';

  return (
    <div className="space-y-6 pb-24">
      {/* Toast Notification Banner */}
      {vm.toast && (
        <div
          role="status"
          className={cx(
            'fixed top-5 right-5 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-[13px] font-bold shadow-lg transition-all animate-bounce',
            vm.toast.tone === 'success' && 'bg-pine text-[#f2efe2] border border-pine-deep',
            vm.toast.tone === 'error' && 'bg-clay text-white border border-red-700',
            vm.toast.tone === 'info' && 'bg-pine-deep text-[#f2efe2]',
            vm.toast.tone === 'warn' && 'bg-honey-soft text-[#8a5f10] border border-honey'
          )}
        >
          <span>{vm.toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Pengaturan Toko</h1>
          <p className="text-sm text-fog">Konfigurasi perangkat kasir: struk, barcode, scanner, dan laci kasir.</p>
        </div>
        <div>
          {vm.isDirty ? (
            <span className="flex items-center gap-2 rounded-lg border border-honey/50 bg-honey-soft px-3 py-2 text-[12px] font-bold text-[#8a5f10]">
              <span className="h-1.5 w-1.5 rounded-full bg-honey" /> Perubahan belum disimpan
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-lg border border-pine/25 bg-pine-soft px-3 py-2 text-[12px] font-bold text-pine">
              ✓ Tersinkron
            </span>
          )}
        </div>
      </div>

      {vm.isReadOnly && (
        <div className="rounded-lg border border-honey/50 bg-honey-soft/50 p-3 text-[12.5px] text-[#8a5f10]">
          <strong>Mode Baca Kasir:</strong> Anda melihat konfigurasi toko saat ini. Hanya Owner yang berwenang mengubah pengaturan.
        </div>
      )}

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Left Sticky Nav */}
        <nav className="lg:sticky lg:top-20 space-y-1 self-start">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              className={cx(
                'flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-left text-[13px] font-semibold transition-all cursor-pointer',
                activeSection === s.id
                  ? 'bg-pine-deep text-[#f2efe2] shadow-md -translate-y-0.5'
                  : 'bg-surface border border-line text-fog hover:border-pine/40 hover:text-ink'
              )}
            >
              <span>{s.icon}</span>
              {s.label}
            </button>
          ))}

          <div className="mt-4 rounded-xl border border-dashed border-linedark bg-white p-3.5">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-fog">Kasir Aktif</p>
            <p className="mt-1 text-[12.5px] font-bold text-ink">Terminal Kasir · Aktif</p>
            <p className="num text-[11px] text-fog">KSR-01 · online</p>
          </div>
        </nav>

        {/* Content Sections */}
        <div className="space-y-6">
          {/* SECTION 1: INFO TOKO */}
          <SettingCard
            id="toko"
            icon="🏪"
            title="Info Toko"
            desc="Identitas yang tercetak di struk dan label harga."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="store-name" className="block text-[12px] font-bold uppercase tracking-wider text-fog mb-1">
                  Nama Toko
                </label>
                <input
                  id="store-name"
                  disabled={vm.isReadOnly}
                  value={vm.draft.storeName}
                  onChange={(e) => vm.updateField('storeName', e.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-pine focus:ring-1 focus:ring-pine disabled:bg-paper/60"
                  placeholder="Nama Toko / Brand"
                />
              </div>

              <div>
                <label htmlFor="store-phone" className="block text-[12px] font-bold uppercase tracking-wider text-fog mb-1">
                  Telepon
                </label>
                <input
                  id="store-phone"
                  disabled={vm.isReadOnly}
                  value={vm.draft.phone}
                  onChange={(e) => vm.updateField('phone', e.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink num outline-none focus:border-pine focus:ring-1 focus:ring-pine disabled:bg-paper/60"
                  placeholder="0812-xxxx-xxxx"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="store-address" className="block text-[12px] font-bold uppercase tracking-wider text-fog mb-1">
                  Alamat
                </label>
                <input
                  id="store-address"
                  disabled={vm.isReadOnly}
                  value={vm.draft.address}
                  onChange={(e) => vm.updateField('address', e.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-pine focus:ring-1 focus:ring-pine disabled:bg-paper/60"
                  placeholder="Jl. Nama Jalan No. XX, Kota"
                />
              </div>

              <div>
                <label htmlFor="store-tax" className="block text-[12px] font-bold uppercase tracking-wider text-fog mb-1">
                  PPN / Pajak (%)
                </label>
                <input
                  id="store-tax"
                  type="number"
                  min={0}
                  max={30}
                  step={0.1}
                  disabled={vm.isReadOnly}
                  value={vm.draft.taxRatePercent}
                  onChange={(e) =>
                    vm.updateField('taxRatePercent', Math.max(0, Math.min(30, Number(e.target.value) || 0)))
                  }
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink num outline-none focus:border-pine focus:ring-1 focus:ring-pine disabled:bg-paper/60"
                />
              </div>

              <div>
                <label htmlFor="store-footer" className="block text-[12px] font-bold uppercase tracking-wider text-fog mb-1">
                  Pesan Footer Struk
                </label>
                <input
                  id="store-footer"
                  disabled={vm.isReadOnly}
                  value={vm.draft.receiptFooter}
                  onChange={(e) => vm.updateField('receiptFooter', e.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-pine focus:ring-1 focus:ring-pine disabled:bg-paper/60"
                  placeholder="Pesan penutup struk..."
                />
              </div>
            </div>

            {/* Payment Method Matrix */}
            <div className="mt-6 border-t border-line pt-4">
              <h4 className="text-[13px] font-bold text-ink mb-2">Metode Pembayaran Kasir</h4>
              <p className="text-[11.5px] text-fog mb-3">Aktifkan metode pembayaran yang diterima di kasir cabang ini.</p>
              <div className="grid gap-2.5 sm:grid-cols-3">
                <ToggleRow
                  label="Tunai (Cash)"
                  desc="Pembayaran uang tunai"
                  on={vm.draft.paymentMethods.cash}
                  disabled={vm.isReadOnly}
                  onChange={(v) => vm.updatePaymentMethods({ cash: v })}
                />
                <ToggleRow
                  label="QRIS"
                  desc="Pembayaran QRIS scan"
                  on={vm.draft.paymentMethods.qris}
                  disabled={vm.isReadOnly}
                  onChange={(v) => vm.updatePaymentMethods({ qris: v })}
                />
                <ToggleRow
                  label="Kartu Debit"
                  desc="Pembayaran kartu EDC"
                  on={vm.draft.paymentMethods.debit}
                  disabled={vm.isReadOnly}
                  onChange={(v) => vm.updatePaymentMethods({ debit: v })}
                />
              </div>
            </div>
          </SettingCard>

          {/* SECTION 2: STRUK & PRINTER */}
          <SettingCard
            id="printer"
            icon="🖨️"
            title="Struk & Printer"
            desc="Ukuran kertas, pemotong otomatis, dan tampilan struk."
            side={
              <button
                type="button"
                className="rounded-lg border border-line bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink hover:border-pine/50 hover:text-pine"
                onClick={vm.testPrint}
              >
                Tes Cetak
              </button>
            }
          >
            <div className="grid gap-6 md:grid-cols-[1fr_260px]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="printer-model" className="block text-[12px] font-bold uppercase tracking-wider text-fog mb-1">
                      Model Printer
                    </label>
                    <select
                      id="printer-model"
                      disabled={vm.isReadOnly}
                      value={vm.draft.printer.model}
                      onChange={(e) => vm.updatePrinter({ model: e.target.value })}
                      className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-pine disabled:bg-paper/60"
                    >
                      {PRINTER_MODELS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold uppercase tracking-wider text-fog mb-1">
                      Ukuran Kertas
                    </label>
                    <div className="flex rounded-lg border border-line bg-surface p-0.5">
                      {(['58mm', '80mm'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={vm.isReadOnly}
                          onClick={() => vm.updatePrinter({ paper: s })}
                          className={cx(
                            'flex-1 rounded-md py-1.5 text-[12px] font-bold transition-all cursor-pointer',
                            vm.draft.printer.paper === s ? 'bg-pine text-[#f2efe2] shadow-xs' : 'text-fog hover:text-ink'
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="printer-copies" className="block text-[12px] font-bold uppercase tracking-wider text-fog mb-1">
                    Jumlah Rangkap: <span className="num text-pine">{vm.draft.printer.copies}×</span>
                  </label>
                  <input
                    id="printer-copies"
                    type="range"
                    min={1}
                    max={3}
                    disabled={vm.isReadOnly}
                    value={vm.draft.printer.copies}
                    onChange={(e) => vm.updatePrinter({ copies: Number(e.target.value) })}
                    className="w-full accent-[#17593e]"
                  />
                </div>

                <div className="space-y-2">
                  <ToggleRow
                    label="Cetak logo toko"
                    desc="Logo tampil di kepala struk."
                    on={vm.draft.printer.printLogo}
                    disabled={vm.isReadOnly}
                    onChange={(v) => vm.updatePrinter({ printLogo: v })}
                  />
                  <ToggleRow
                    label="Potong kertas otomatis"
                    desc="Auto-cutter aktif setelah struk selesai."
                    on={vm.draft.printer.autoCut}
                    disabled={vm.isReadOnly}
                    onChange={(v) => vm.updatePrinter({ autoCut: v })}
                  />
                  <ToggleRow
                    label="Cetak struk otomatis"
                    desc="Struk langsung dicetak saat pembayaran sukses."
                    on={vm.draft.printer.autoPrint}
                    disabled={vm.isReadOnly}
                    onChange={(v) => vm.updatePrinter({ autoPrint: v })}
                  />
                </div>
              </div>

              {/* Struk Preview */}
              <div className="flex flex-col items-center">
                <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-fog">
                  Pratinjau · {vm.draft.printer.paper}
                </p>
                <div
                  className={cx(
                    'num rounded-sm border border-line bg-white px-3 py-3.5 text-[10px] leading-relaxed shadow-xs transition-all duration-300',
                    paperW
                  )}
                >
                  {vm.draft.printer.printLogo && (
                    <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded bg-pine-deep text-[8px] font-bold text-honey">
                      SM
                    </div>
                  )}
                  <p className="text-center text-[11px] font-bold">{(vm.draft.storeName || 'SKM MART').toUpperCase()}</p>
                  <p className="text-center text-fog">{vm.draft.address || 'Jl. Melati No. 12'}</p>
                  <p className="text-center text-fog">{vm.draft.phone || '0274-556-810'}</p>
                  <div className="my-1.5 border-t border-dashed border-linedark" />
                  <p className="flex justify-between">
                    <span>Beras Rojolele 5 kg</span>
                    <span>68.000</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Kopi Susu Aren ×2</span>
                    <span>30.000</span>
                  </p>
                  <div className="my-1.5 border-t border-dashed border-linedark" />
                  <p className="flex justify-between">
                    <span>PPN {vm.draft.taxRatePercent}%</span>
                    <span>{num(Math.round((98000 * vm.draft.taxRatePercent) / 100))}</span>
                  </p>
                  <p className="flex justify-between text-[11px] font-bold">
                    <span>TOTAL</span>
                    <span>{num(98000 + Math.round((98000 * vm.draft.taxRatePercent) / 100))}</span>
                  </p>
                  <div className="my-1.5 border-t border-dashed border-linedark" />
                  <p className="text-center text-fog">{vm.draft.receiptFooter}</p>
                  {vm.draft.printer.copies > 1 && (
                    <p className="mt-1 text-center font-bold">— rangkap {vm.draft.printer.copies} —</p>
                  )}
                </div>
              </div>
            </div>
          </SettingCard>

          {/* SECTION 3: BARCODE & LABEL */}
          <SettingCard
            id="barcode"
            icon="🏷️"
            title="Barcode & Label"
            desc="Format barcode dan tampilan label harga produk."
          >
            <div className="grid gap-6 md:grid-cols-[1fr_260px]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-bold uppercase tracking-wider text-fog mb-1">
                      Format Barcode
                    </label>
                    <div className="flex rounded-lg border border-line bg-surface p-0.5">
                      {(['EAN-13', 'CODE128'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={vm.isReadOnly}
                          onClick={() => vm.updateBarcode({ format: s })}
                          className={cx(
                            'flex-1 rounded-md py-1.5 text-[12px] font-bold transition-all cursor-pointer',
                            vm.draft.barcode.format === s ? 'bg-pine text-[#f2efe2] shadow-xs' : 'text-fog hover:text-ink'
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="barcode-prefix" className="block text-[12px] font-bold uppercase tracking-wider text-fog mb-1">
                      Prefiks Toko
                    </label>
                    <input
                      id="barcode-prefix"
                      disabled={vm.isReadOnly}
                      value={vm.draft.barcode.prefix}
                      onChange={(e) =>
                        vm.updateBarcode({ prefix: e.target.value.replace(/\D/g, '').slice(0, 6) })
                      }
                      className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink num outline-none focus:border-pine disabled:bg-paper/60"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wider text-fog mb-1">
                    Ukuran Label
                  </label>
                  <div className="flex rounded-lg border border-line bg-surface p-0.5">
                    {(['kecil', 'sedang'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={vm.isReadOnly}
                        onClick={() => vm.updateBarcode({ labelSize: s })}
                        className={cx(
                          'flex-1 rounded-md py-1.5 text-[12px] font-bold capitalize transition-all cursor-pointer',
                          vm.draft.barcode.labelSize === s ? 'bg-pine text-[#f2efe2] shadow-xs' : 'text-fog hover:text-ink'
                        )}
                      >
                        {s} · {s === 'kecil' ? '30×20' : '40×30'} mm
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <ToggleRow
                    label="Buat barcode otomatis"
                    desc="SKU baru langsung mendapat nomor barcode berprefiks."
                    on={vm.draft.barcode.autoGenerate}
                    disabled={vm.isReadOnly}
                    onChange={(v) => vm.updateBarcode({ autoGenerate: v })}
                  />
                  <ToggleRow
                    label="Tampilkan harga di label"
                    desc="Harga jual tercetak di bawah barcode."
                    on={vm.draft.barcode.showPrice}
                    disabled={vm.isReadOnly}
                    onChange={(v) => vm.updateBarcode({ showPrice: v })}
                  />
                </div>
              </div>

              {/* Label Preview */}
              <div className="flex flex-col items-center">
                <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-fog">Pratinjau Label</p>
                <div
                  className={cx(
                    'rounded-md border-[1.5px] border-ink/70 bg-white text-center shadow-xs transition-all duration-300',
                    vm.draft.barcode.labelSize === 'kecil' ? 'w-[210px] p-2.5' : 'w-[250px] p-3.5'
                  )}
                >
                  <p className="text-[8.5px] font-bold uppercase tracking-[0.2em] text-fog">
                    {vm.draft.storeName || 'SKM MART'}
                  </p>
                  <p className="mt-1 text-[12px] font-bold leading-snug text-ink">Beras Rojolele 5 kg</p>
                  <BarcodeSvg value={`${vm.draft.barcode.prefix}SMB-01`} className="mx-auto mt-2 h-10 w-[85%] fill-ink" />
                  <p className="num mt-1 text-[10px] tracking-[0.16em] text-ink">{vm.draft.barcode.prefix}SMB-01</p>
                  {vm.draft.barcode.showPrice && (
                    <p className="num mt-1.5 inline-block rounded border border-ink/60 px-2 py-0.5 text-[14px] font-bold text-ink">
                      {idr(68000)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </SettingCard>

          {/* SECTION 4: SCANNER */}
          <SettingCard
            id="scanner"
            icon="📷"
            title="Barcode Scanner"
            desc="Perangkat pemindai di meja kasir."
            side={
              <button
                type="button"
                className="rounded-lg border border-line bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink hover:border-pine/50 hover:text-pine"
                onClick={vm.testScan}
              >
                Uji Pindai
              </button>
            }
          >
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-fog mb-1">
                  Tipe Koneksi
                </label>
                <div className="flex max-w-xs rounded-lg border border-line bg-surface p-0.5">
                  {(['USB HID', 'Bluetooth'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={vm.isReadOnly}
                      onClick={() => vm.updateScanner({ type: s })}
                      className={cx(
                        'flex-1 rounded-md py-1.5 text-[12px] font-bold transition-all cursor-pointer',
                        vm.draft.scanner.type === s ? 'bg-pine text-[#f2efe2] shadow-xs' : 'text-fog hover:text-ink'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <ToggleRow
                  label="Enter otomatis setelah pindai"
                  desc="Produk langsung masuk keranjang tanpa tekan Enter."
                  on={vm.draft.scanner.autoEnter}
                  disabled={vm.isReadOnly}
                  onChange={(v) => vm.updateScanner({ autoEnter: v })}
                />
                <ToggleRow
                  label="Bunyi beep"
                  desc="Umpan balik suara saat barcode terbaca."
                  on={vm.draft.scanner.sound}
                  disabled={vm.isReadOnly}
                  onChange={(v) => vm.updateScanner({ sound: v })}
                />
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-dashed border-linedark bg-white px-4 py-3">
                <span
                  className={cx(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                    vm.lastScan ? 'bg-pine text-[#f2efe2]' : 'bg-ink/6 text-fog'
                  )}
                >
                  📷
                </span>
                {vm.lastScan ? (
                  <p key={vm.lastScan} className="num text-[13px] font-bold text-ink">
                    {vm.lastScan}
                  </p>
                ) : (
                  <p className="text-[12.5px] text-fog">Belum ada pindai pada sesi ini — tekan "Uji Pindai".</p>
                )}
              </div>
            </div>
          </SettingCard>

          {/* SECTION 5: LACI KASIR */}
          <SettingCard
            id="laci"
            icon="🗄️"
            title="Laci Kasir (Cash Drawer)"
            desc="Kapan laci terbuka dan delay solenoid."
            side={
              <button
                type="button"
                className="rounded-lg border border-honey/50 bg-honey-soft px-3.5 py-1.5 text-[12px] font-bold text-[#8a5f10] hover:bg-honey/20"
                onClick={vm.testDrawer}
              >
                Uji Buka Laci
              </button>
            }
          >
            <div className="grid gap-6 md:grid-cols-[1fr_240px]">
              <div className="space-y-3">
                <ToggleRow
                  label="Buka saat pembayaran sukses"
                  desc="Laci terbuka otomatis setelah struk terbit."
                  on={vm.draft.drawer.openOnPayment}
                  disabled={vm.isReadOnly}
                  onChange={(v) => vm.updateDrawer({ openOnPayment: v })}
                />
                <ToggleRow
                  label="Buka saat shift dimulai"
                  desc="Untuk menghitung modal awal kasir."
                  on={vm.draft.drawer.openOnShift}
                  disabled={vm.isReadOnly}
                  onChange={(v) => vm.updateDrawer({ openOnShift: v })}
                />
                <div className="mt-3">
                  <label htmlFor="drawer-delay" className="block text-[12px] font-bold uppercase tracking-wider text-fog mb-1">
                    Delay solenoid: <span className="num text-pine">{vm.draft.drawer.delayMs} ms</span>
                  </label>
                  <input
                    id="drawer-delay"
                    type="range"
                    min={0}
                    max={1000}
                    step={100}
                    disabled={vm.isReadOnly}
                    value={vm.draft.drawer.delayMs}
                    onChange={(e) => vm.updateDrawer({ delayMs: Number(e.target.value) })}
                    className="w-full accent-[#d3921f]"
                  />
                </div>
              </div>

              {/* Drawer Illustration */}
              <div className="flex flex-col items-center justify-center">
                <div className="relative h-28 w-44 overflow-visible rounded-lg border-2 border-ink/25 bg-[linear-gradient(180deg,#e8e5d6,#d9d5c2)] shadow-inner">
                  <div className="absolute left-1/2 top-3 h-1.5 w-16 -translate-x-1/2 rounded-full bg-ink/25" />
                  <div
                    className={cx(
                      'absolute inset-x-2 bottom-1.5 h-14 rounded-md border border-ink/20 bg-[linear-gradient(180deg,#f5f2e4,#e2ddc9)] shadow-md transition-transform duration-500 ease-out',
                      vm.drawerOpen && 'translate-y-[46px]'
                    )}
                  >
                    <div className="mx-auto mt-2 h-1.5 w-14 rounded-full bg-pine/50" />
                    <div className="mx-auto mt-2 grid grid-cols-4 gap-1 px-3">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <span key={i} className="h-2 rounded-[2px] bg-honey/60" />
                      ))}
                    </div>
                  </div>
                </div>
                <p
                  className={cx(
                    'num mt-3 text-[11px] font-bold uppercase tracking-wider transition-colors',
                    vm.drawerOpen ? 'text-pine' : 'text-fog'
                  )}
                >
                  {vm.drawerOpen ? 'Terbuka' : 'Terkunci'}
                </p>
              </div>
            </div>
          </SettingCard>

          {/* SECTION 6: PERANGKAT TERHUBUNG */}
          <SettingCard
            id="perangkat"
            icon="🔌"
            title="Perangkat Terhubung"
            desc="Semua periferal yang terdaftar di terminal kasir ini."
          >
            <ul className="divide-y divide-line">
              {CONTROLLED_DEVICES.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="h-2.5 w-2.5 rounded-full bg-pine" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold leading-tight text-ink">{d.name}</p>
                    <p className="num text-[11px] text-fog">{d.port}</p>
                  </div>
                  <span className="rounded-md px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider bg-pine-soft text-pine">
                    {d.status}
                  </span>
                  <button
                    type="button"
                    className="rounded-lg border border-line bg-white px-3 py-1 text-[11.5px] text-ink hover:border-pine"
                    onClick={() => vm.pushToast(`Tes koneksi ${d.name} — OK (12 ms).`, 'success')}
                  >
                    Tes
                  </button>
                </li>
              ))}
            </ul>
          </SettingCard>
        </div>
      </div>

      {/* Bottom Sticky Save Bar */}
      {!vm.isReadOnly && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-[1440px] mx-auto md:left-64">
          <div
            className={cx(
              'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-3 shadow-lg backdrop-blur transition-colors',
              vm.isDirty ? 'border-honey/60 bg-[#fdf6e3]/95' : 'border-line bg-surface/95'
            )}
          >
            <p className="text-[12.5px] font-bold text-ink">
              {vm.isDirty ? 'Ada perubahan yang belum disimpan.' : 'Semua pengaturan tersimpan.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!vm.isDirty || vm.saveState === 'saving'}
                onClick={vm.discardChanges}
                className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-paper disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Buang Perubahan
              </button>
              <button
                type="button"
                disabled={!vm.isDirty || vm.saveState === 'saving'}
                onClick={vm.saveSettings}
                className="flex items-center gap-2 rounded-lg bg-pine px-5 py-2 text-sm font-bold text-[#f2efe2] shadow-sm hover:bg-pine-deep disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {vm.saveState === 'saving' ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Menyimpan...
                  </>
                ) : (
                  <>✓ Simpan Pengaturan</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
