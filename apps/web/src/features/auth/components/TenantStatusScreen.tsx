'use client';

import React, { useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { Clock, AlertTriangle, XCircle, RefreshCw, LogOut, ShieldCheck, Mail } from 'lucide-react';
import { SKMNetworkLogo } from '@/components/brand/SKMNetworkLogo';

export function TenantStatusScreen({ status, businessName }: { status: string; businessName: string }) {
  const { logout, switchTenant, business } = useAuth();
  const [checking, setChecking] = useState(false);

  const handleRefresh = async () => {
    if (!business?.id) return;
    setChecking(true);
    try {
      await switchTenant(business.id);
    } catch {
      // Ignored
    } finally {
      setChecking(false);
    }
  };

  if (status === 'PENDING_REVIEW') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-4 md:p-8">
        <div className="w-full max-w-lg rounded-2xl border border-amber-200/80 bg-white p-6 md:p-8 shadow-sm text-center">
          <div className="flex justify-center mb-4">
            <SKMNetworkLogo size={36} />
          </div>

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
            <Clock className="h-7 w-7 animate-pulse" />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 mb-3">
            <ShieldCheck className="h-3.5 w-3.5" />
            Status: Menunggu Persetujuan
          </span>

          <h1 className="text-xl md:text-2xl font-bold font-display text-ink">
            Pendaftaran Sedang Ditinjau
          </h1>

          <p className="mt-2 text-sm text-ink/70">
            Terima kasih telah mendaftar. Akun bisnis{' '}
            <strong className="text-ink font-semibold">{businessName}</strong> saat ini sedang dalam antrean review oleh tim Superadmin SKMNetwork.
          </p>

          <div className="mt-6 rounded-xl border border-amber-100 bg-amber-50/50 p-4 text-left text-xs text-amber-900 leading-relaxed">
            <p className="font-semibold mb-1">Tahap Verifikasi Platform:</p>
            <ul className="list-disc list-inside space-y-1 text-amber-800/90">
              <li>Pemeriksaan data identitas & legalitas pendaftaran</li>
              <li>Aktivasi katalog modul dan langganan tenant</li>
              <li>Akses ERP akan otomatis terbuka setelah disetujui</li>
            </ul>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleRefresh}
              disabled={checking}
              className="flex items-center justify-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-xs font-semibold text-paper shadow-2xs transition hover:bg-ink/90 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              <span>Periksa Status Terbaru</span>
            </button>

            <button
              onClick={logout}
              className="flex items-center justify-center gap-2 rounded-xl border border-line bg-card px-5 py-2.5 text-xs font-semibold text-ink shadow-2xs transition hover:bg-paper cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Keluar / Ganti Akun</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'SUSPENDED') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-4 md:p-8">
        <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-6 md:p-8 shadow-sm text-center">
          <div className="flex justify-center mb-4">
            <SKMNetworkLogo size={36} />
          </div>

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
            <AlertTriangle className="h-7 w-7" />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-800 mb-3">
            Status: Ditangguhkan (Suspended)
          </span>

          <h1 className="text-xl md:text-2xl font-bold font-display text-ink">
            Akses Bisnis Ditangguhkan
          </h1>

          <p className="mt-2 text-sm text-ink/70">
            Akses operasional untuk bisnis{' '}
            <strong className="text-ink font-semibold">{businessName}</strong> ditangguhkan sementara oleh administrator platform.
          </p>

          <div className="mt-6 rounded-xl border border-rose-100 bg-rose-50/50 p-4 text-left text-xs text-rose-900 leading-relaxed">
            <p className="font-semibold mb-1">Bantuan & Reaktivasi:</p>
            <p className="text-rose-800/90">
              Silakan hubungi tim dukungan SKMNetwork untuk informasi lebih lanjut mengenai tagihan atau status kepatuhan akun bisnis Anda.
            </p>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="mailto:support@skmnetwork.com"
              className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-rose-700 cursor-pointer"
            >
              <Mail className="h-4 w-4" />
              <span>Hubungi Dukungan</span>
            </a>

            <button
              onClick={logout}
              className="flex items-center justify-center gap-2 rounded-xl border border-line bg-card px-5 py-2.5 text-xs font-semibold text-ink shadow-2xs transition hover:bg-paper cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'REJECTED') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-4 md:p-8">
        <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-6 md:p-8 shadow-sm text-center">
          <div className="flex justify-center mb-4">
            <SKMNetworkLogo size={36} />
          </div>

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
            <XCircle className="h-7 w-7" />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-800 mb-3">
            Status: Pendaftaran Ditolak
          </span>

          <h1 className="text-xl md:text-2xl font-bold font-display text-ink">
            Pendaftaran Tidak Disetujui
          </h1>

          <p className="mt-2 text-sm text-ink/70">
            Pengajuan pendaftaran akun bisnis{' '}
            <strong className="text-ink font-semibold">{businessName}</strong> belum dapat disetujui oleh tim verifikasi SKMNetwork.
          </p>

          <div className="mt-6 flex justify-center">
            <button
              onClick={logout}
              className="flex items-center justify-center gap-2 rounded-xl border border-line bg-card px-6 py-2.5 text-xs font-semibold text-ink shadow-2xs transition hover:bg-paper cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Keluar / Daftar Ulang</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
