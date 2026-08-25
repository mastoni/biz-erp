'use client';

import React, { useState, useEffect, Suspense, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SKMNetworkLogo } from '@/components/brand/SKMNetworkLogo';
import { api } from '@/lib/api';
import { Check, Sparkles, Loader2, ArrowRight } from 'lucide-react';

interface PackageInfo {
  id: string;
  name: string;
  badge?: string;
  description: string;
  features: string[];
}

const AVAILABLE_PACKAGES: Record<string, PackageInfo> = {
  starter: {
    id: 'starter',
    name: 'Paket Starter',
    badge: 'UMKM',
    description: 'Solusi kasir POS & inventori lengkap untuk 1 cabang usaha.',
    features: ['1 Cabang Operasional', 'POS Kasir Cepat', 'Manajemen Stok & Produk', 'Laporan Harian'],
  },
  business: {
    id: 'business',
    name: 'Paket Business',
    badge: 'Populer',
    description: 'Sistem ERP terintegrasi untuk bisnis berkembang dan multi-cabang.',
    features: ['Multi-Cabang & Gudang', 'Multi-User & Role RBAC', 'Analisis Penjualan Lengkap', 'Integrasi Sync Realtime'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Paket Enterprise',
    badge: 'Kustom',
    description: 'Skalabilitas tinggi untuk jaringan ritel besar dan korporasi.',
    features: ['Multi-Tenant Terpusat', 'Dukungan CCTV & Hardware', 'SLA & Dedicated Support', 'Kustom Modul Operasional'],
  },
};

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const planParam = searchParams.get('plan')?.toLowerCase() || searchParams.get('package')?.toLowerCase() || 'starter';
  const [selectedPlan, setSelectedPlan] = useState<string>(
    AVAILABLE_PACKAGES[planParam] ? planParam : 'starter'
  );

  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const p = searchParams.get('plan')?.toLowerCase() || searchParams.get('package')?.toLowerCase();
    if (p && AVAILABLE_PACKAGES[p]) {
      setSelectedPlan(p);
    }
  }, [searchParams]);

  const activePackage = AVAILABLE_PACKAGES[selectedPlan] || AVAILABLE_PACKAGES.starter;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    if (password !== confirmPassword) {
      setErrorMsg('Kata sandi dan konfirmasi kata sandi tidak cocok.');
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Kata sandi harus minimal 8 karakter.');
      setIsLoading(false);
      return;
    }

    try {
      await api.post('/v1/auth/register', {
        business_name: businessName,
        email,
        password,
      });

      setSuccessMsg('Pendaftaran berhasil! Mengalihkan ke halaman masuk...');

      setTimeout(() => {
        router.push('/login');
      }, 1800);
    } catch (error: unknown) {
      const err = error as {
        response?: {
          data?: {
            error?: { message?: string; details?: Record<string, string> };
            message?: string;
          };
          status?: number;
        };
      };

      if (err.response?.status === 429) {
        setErrorMsg('Terlalu banyak percobaan pendaftaran. Silakan coba beberapa saat lagi.');
      } else if (err.response?.data?.error?.message) {
        setErrorMsg(err.response.data.error.message);
      } else if (err.response?.data?.message) {
        setErrorMsg(err.response.data.message);
      } else {
        setErrorMsg('Terjadi kesalahan pada server. Silakan periksa data Anda.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-surface border border-line rounded-2xl shadow-card p-6 sm:p-8 space-y-6">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center space-y-2">
        <SKMNetworkLogo size={44} className="justify-center mb-1" />
        <h1 className="text-2xl font-extrabold font-heading text-ink tracking-tight">
          Daftar Akun Baru
        </h1>
        <p className="text-xs text-fog">
          Buat workspace bisnis Anda untuk mengakses SKMNet ERP
        </p>
      </div>

      {/* Package Selector Context Banner */}
      <div className="p-3.5 rounded-xl bg-surface-soft border border-line space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-fog">
            Paket Pilihan:
          </span>
          <div className="flex items-center gap-1">
            {Object.keys(AVAILABLE_PACKAGES).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedPlan(key)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                  selectedPlan === key
                    ? 'bg-pine text-paper shadow-sm'
                    : 'bg-surface border border-line text-ink/70 hover:bg-surface-soft'
                }`}
              >
                {AVAILABLE_PACKAGES[key].name.replace('Paket ', '')}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-1">
          <div className="flex items-center gap-1.5 font-bold text-xs text-ink">
            <Sparkles className="h-3.5 w-3.5 text-honey" />
            <span>{activePackage.name}</span>
            {activePackage.badge && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-honey/20 text-honey font-bold uppercase">
                {activePackage.badge}
              </span>
            )}
          </div>
          <p className="text-[11px] text-fog mt-0.5 leading-snug">
            {activePackage.description}
          </p>
        </div>
      </div>

      {/* Error & Success Feedback Alerts */}
      {errorMsg && (
        <Alert variant="destructive" className="bg-clay-soft/50 border-clay/30 text-clay py-2.5">
          <AlertTitle className="text-xs font-bold font-heading">Pendaftaran Gagal</AlertTitle>
          <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
        </Alert>
      )}

      {successMsg && (
        <Alert className="bg-pine-soft/50 border-pine/30 text-pine py-2.5">
          <AlertTitle className="text-xs font-bold font-heading">Berhasil</AlertTitle>
          <AlertDescription className="text-xs">{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="businessName" className="text-xs font-semibold text-ink">
            Nama Bisnis / Perusahaan
          </Label>
          <Input
            id="businessName"
            type="text"
            placeholder="Contoh: Toko Kopi Nusantara"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
            className="h-10 text-sm rounded-lg border-line bg-white/90 focus:border-pine focus:ring-2 focus:ring-pine/15 transition-all placeholder:text-fog/50"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-semibold text-ink">
            Email Pemilik (Owner)
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="owner@perusahaan.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-10 text-sm rounded-lg border-line bg-white/90 focus:border-pine focus:ring-2 focus:ring-pine/15 transition-all placeholder:text-fog/50"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-semibold text-ink">
            Kata Sandi
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="Minimal 8 karakter"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="h-10 text-sm rounded-lg border-line bg-white/90 focus:border-pine focus:ring-2 focus:ring-pine/15 transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-xs font-semibold text-ink">
            Konfirmasi Kata Sandi
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Ulangi kata sandi"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="h-10 text-sm rounded-lg border-line bg-white/90 focus:border-pine focus:ring-2 focus:ring-pine/15 transition-all"
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 text-sm font-semibold rounded-lg bg-pine hover:bg-pine-dark text-paper shadow-[0_2px_0_rgba(12,32,24,0.35)] transition-all active:scale-[0.98] mt-2 cursor-pointer"
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Mendaftarkan Bisnis...
            </span>
          ) : (
            `Daftar dengan ${activePackage.name}`
          )}
        </Button>

        <div className="pt-2 text-center">
          <p className="text-xs text-fog">
            Sudah memiliki akun?{' '}
            <Link
              href="/login"
              className="font-semibold text-pine hover:underline transition-colors"
            >
              Masuk sekarang
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center p-8 bg-surface rounded-2xl border border-line shadow-card">
            <Loader2 className="h-6 w-6 animate-spin text-pine mb-2" />
            <p className="text-xs text-fog">Memuat formulir pendaftaran...</p>
          </div>
        }
      >
        <RegisterForm />
      </Suspense>
    </div>
  );
}