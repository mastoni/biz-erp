'use client';

import React, { useEffect, useState } from 'react';
import {
  getPlatformAiCsSettings,
  updatePlatformAiCsSettings,
} from '@/features/platform/api';
import type { PlatformAiCsSettings } from '@/features/platform/types';
import { getApiErrorInfo } from '@/features/platform/list-helpers';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bot,
  Shield,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Save,
  Lock,
  Headphones,
  Sliders,
  Cpu,
  Layers,
  Sparkles,
  HelpCircle,
  Radio,
} from 'lucide-react';

const FALLBACK_ERROR = 'Terjadi kesalahan saat memproses pengaturan AI Customer Service.';

export default function PlatformAiCsPage() {
  const [settings, setSettings] = useState<PlatformAiCsSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State
  const [isEnabled, setIsEnabled] = useState(true);
  const [humanEscalationEnabled, setHumanEscalationEnabled] = useState(true);

  async function loadSettings() {
    setLoading(true);
    setError(null);
    try {
      const res = await getPlatformAiCsSettings();
      if (res.settings) {
        setSettings(res.settings);
        setIsEnabled(res.settings.is_enabled);
        setHumanEscalationEnabled(res.settings.human_escalation_enabled);
      }
    } catch (err) {
      const info = getApiErrorInfo(err, FALLBACK_ERROR);
      setError(info.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await updatePlatformAiCsSettings({
        is_enabled: isEnabled,
        human_escalation_enabled: humanEscalationEnabled,
      });

      if (res.settings) {
        setSettings(res.settings);
        setIsEnabled(res.settings.is_enabled);
        setHumanEscalationEnabled(res.settings.human_escalation_enabled);
        setSuccessMessage('Pengaturan AI Customer Service berhasil disimpan.');
      }
    } catch (err) {
      const info = getApiErrorInfo(err, 'Gagal menyimpan pengaturan AI CS.');
      setError(info.message);
    } finally {
      setSaving(false);
    }
  }

  const isDirty =
    settings !== null &&
    (isEnabled !== settings.is_enabled ||
      humanEscalationEnabled !== settings.human_escalation_enabled);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink font-display">
              AI CS Control & Settings
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold text-ink/70">
              <Shield className="h-3 w-3" />
              SUPER_ADMIN
            </span>
          </div>
          <p className="text-sm text-ink/70 mt-1">
            Pusat kendali operasional dan status subsistem AI Customer Service SKMNetwork.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadSettings}
          disabled={loading || saving}
          className="self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Segarkan
        </Button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-lg border border-brick/30 bg-brick/5 p-4 text-sm text-brick flex items-start gap-3">
          <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Gagal memuat atau menyimpan</p>
            <p className="mt-0.5 text-xs text-brick/90">{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-pine/30 bg-pine/5 p-4 text-sm text-pine flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !settings ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl md:col-span-2" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Operational Status Card */}
          <div className="rounded-xl border border-ink/10 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-ink/5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink/5 text-ink">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-ink">Status Operasional Subsistem</h2>
                  <p className="text-xs text-ink/60">Indikator kesehatan runtime & ketersediaan AI CS</p>
                </div>
              </div>

              {/* Health Badge */}
              <div>
                {settings?.operational_health === 'HEALTHY' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-pine/10 px-3 py-1 text-xs font-semibold text-pine">
                    <span className="h-2 w-2 rounded-full bg-pine animate-pulse" />
                    HEALTHY / OPERATIONAL
                  </span>
                ) : settings?.operational_health === 'DEGRADED' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    DEGRADED (DISABLED)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brick/10 px-3 py-1 text-xs font-semibold text-brick">
                    <XCircle className="h-3.5 w-3.5" />
                    UNAVAILABLE
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-2">
              <div className="rounded-lg bg-paper/60 p-3 border border-ink/5">
                <p className="text-xs text-ink/50 uppercase tracking-wider font-medium">Status Layanan</p>
                <p className="text-sm font-semibold text-ink mt-1">
                  {isEnabled ? (
                    <span className="text-pine flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" /> Aktif untuk Tenant
                    </span>
                  ) : (
                    <span className="text-brick flex items-center gap-1">
                      <XCircle className="h-4 w-4" /> Dinonaktifkan
                    </span>
                  )}
                </p>
              </div>

              <div className="rounded-lg bg-paper/60 p-3 border border-ink/5">
                <p className="text-xs text-ink/50 uppercase tracking-wider font-medium">Eskalasi Staf</p>
                <p className="text-sm font-semibold text-ink mt-1">
                  {humanEscalationEnabled ? (
                    <span className="text-pine flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" /> Diizinkan (Tiket Bantuan)
                    </span>
                  ) : (
                    <span className="text-ink/60 flex items-center gap-1">
                      <Lock className="h-4 w-4" /> Diblokir Sementara
                    </span>
                  )}
                </p>
              </div>

              <div className="rounded-lg bg-paper/60 p-3 border border-ink/5">
                <p className="text-xs text-ink/50 uppercase tracking-wider font-medium">Database Backend</p>
                <p className="text-sm font-semibold text-ink mt-1 flex items-center gap-1 text-pine">
                  <CheckCircle2 className="h-4 w-4" /> Terhubung & Tersinkronisasi
                </p>
              </div>
            </div>
          </div>

          {/* Authoritative Live Controls */}
          <div className="rounded-xl border border-ink/10 bg-white p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-ink/5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink/5 text-ink">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-ink">Kontrol Aktif Platform</h2>
                <p className="text-xs text-ink/60">Pengaturan otoritatif yang langsung berlaku pada seluruh tenant</p>
              </div>
            </div>

            {/* Control 1: is_enabled */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-paper/40 border border-ink/5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-ink/70" />
                  <span className="font-semibold text-sm text-ink">Aktivasi AI Customer Service</span>
                </div>
                <p className="text-xs text-ink/70 max-w-xl">
                  Mengontrol ketersediaan subsistem AI CS secara menyeluruh. Saat dimatikan, permintaan percakapan dan pengiriman pesan dari tenant akan ditolak dengan status <code className="bg-sand/60 px-1 py-0.5 rounded text-[11px]">AI_CS_DISABLED</code>.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                    className="sr-only peer"
                    disabled={saving}
                  />
                  <div className="w-11 h-6 bg-ink/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ink/20 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pine"></div>
                </label>
                <span className="text-xs font-semibold w-16 text-right text-ink">
                  {isEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>

            {/* Control 2: human_escalation_enabled */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-paper/40 border border-ink/5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Headphones className="h-4 w-4 text-ink/70" />
                  <span className="font-semibold text-sm text-ink">Eskalasi ke Bantuan Staf / Tiket Support</span>
                </div>
                <p className="text-xs text-ink/70 max-w-xl">
                  Mengizinkan percakapan AI untuk membuat tiket bantuan staf baru secara otomatis atau manual saat eskalasi diperlukan.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={humanEscalationEnabled}
                    onChange={(e) => setHumanEscalationEnabled(e.target.checked)}
                    className="sr-only peer"
                    disabled={saving}
                  />
                  <div className="w-11 h-6 bg-ink/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ink/20 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pine"></div>
                </label>
                <span className="text-xs font-semibold w-16 text-right text-ink">
                  {humanEscalationEnabled ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>
            </div>
          </div>

          {/* Authoritative Read-Only Configuration */}
          <div className="rounded-xl border border-ink/10 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-ink/5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink/5 text-ink">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-ink">Konfigurasi Engine & Provider (Read-Only)</h2>
                <p className="text-xs text-ink/60">Informasi engine runtime yang aktif pada subsistem saat ini</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-ink/10 bg-paper/30 p-4">
                <div className="flex items-center justify-between text-xs text-ink/60 mb-1 font-medium">
                  <span>Provider LLM</span>
                  <Lock className="h-3 w-3 text-ink/40" />
                </div>
                <p className="text-sm font-bold text-ink font-display">
                  {settings?.provider || 'DETERMINISTIC'}
                </p>
                <p className="text-[11px] text-ink/50 mt-1">
                  Deterministic / Development Provider (Aman, zero external billing).
                </p>
              </div>

              <div className="rounded-lg border border-ink/10 bg-paper/30 p-4">
                <div className="flex items-center justify-between text-xs text-ink/60 mb-1 font-medium">
                  <span>Model Identifier</span>
                  <Lock className="h-3 w-3 text-ink/40" />
                </div>
                <p className="text-sm font-bold text-ink font-display">
                  {settings?.model || 'rule-engine-v1'}
                </p>
                <p className="text-[11px] text-ink/50 mt-1">
                  Rule-based deterministic classifier & tool-calling dispatcher.
                </p>
              </div>

              <div className="rounded-lg border border-ink/10 bg-paper/30 p-4">
                <div className="flex items-center justify-between text-xs text-ink/60 mb-1 font-medium">
                  <span>Fallback Behavior</span>
                  <Lock className="h-3 w-3 text-ink/40" />
                </div>
                <p className="text-sm font-bold text-ink font-display">
                  {settings?.fallback_behavior || 'GENERAL_FAQ'}
                </p>
                <p className="text-[11px] text-ink/50 mt-1">
                  Respons standar informasi ekosistem saat tidak ada kecocokan intent khusus.
                </p>
              </div>
            </div>
          </div>

          {/* Unsupported Future Capabilities Section */}
          <div className="rounded-xl border border-dashed border-ink/20 bg-sand/20 p-6 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-ink/10">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sand text-ink/70">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">Fitur Lanjutan Mendatang</h3>
                <p className="text-xs text-ink/50">Kapabilitas yang direncanakan pada fase arsitektur berikutnya</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              <div className="p-3 rounded-lg bg-white/70 border border-ink/5 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">External LLM Adapter</span>
                  <span className="text-[10px] bg-sand px-1.5 py-0.5 rounded text-ink/60 font-medium">Belum tersedia</span>
                </div>
                <p className="text-ink/50 text-[11px]">Integrasi OpenAI / Anthropic / Gemini Cloud API.</p>
              </div>

              <div className="p-3 rounded-lg bg-white/70 border border-ink/5 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">Dynamic Vector KB / RAG</span>
                  <span className="text-[10px] bg-sand px-1.5 py-0.5 rounded text-ink/60 font-medium">Belum tersedia</span>
                </div>
                <p className="text-ink/50 text-[11px]">Pencarian dokumen semantik berbasis embedding pgvector.</p>
              </div>

              <div className="p-3 rounded-lg bg-white/70 border border-ink/5 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">Operating Hours & Jadwal</span>
                  <span className="text-[10px] bg-sand px-1.5 py-0.5 rounded text-ink/60 font-medium">Belum tersedia</span>
                </div>
                <p className="text-ink/50 text-[11px]">Pembatasan jam operasional bot dan routing waktu.</p>
              </div>

              <div className="p-3 rounded-lg bg-white/70 border border-ink/5 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">Token & Usage Quota</span>
                  <span className="text-[10px] bg-sand px-1.5 py-0.5 rounded text-ink/60 font-medium">Belum tersedia</span>
                </div>
                <p className="text-ink/50 text-[11px]">Batas konsumsi token per tenant dan billing tambahan.</p>
              </div>

              <div className="p-3 rounded-lg bg-white/70 border border-ink/5 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">Omnichannel WA / Voice</span>
                  <span className="text-[10px] bg-sand px-1.5 py-0.5 rounded text-ink/60 font-medium">Belum tersedia</span>
                </div>
                <p className="text-ink/50 text-[11px]">Integrasi WhatsApp Bot dan Voice streaming gateway.</p>
              </div>

              <div className="p-3 rounded-lg bg-white/70 border border-ink/5 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">System Prompt Customizer</span>
                  <span className="text-[10px] bg-sand px-1.5 py-0.5 rounded text-ink/60 font-medium">Belum tersedia</span>
                </div>
                <p className="text-ink/50 text-[11px]">Editor persona dan instruksi dasar LLM platform.</p>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (settings) {
                  setIsEnabled(settings.is_enabled);
                  setHumanEscalationEnabled(settings.human_escalation_enabled);
                }
              }}
              disabled={!isDirty || saving}
            >
              Batalkan
            </Button>

            <Button
              type="submit"
              disabled={!isDirty || saving}
              className="bg-pine hover:bg-pine/90 text-white min-w-[140px]"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Simpan Perubahan
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
