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
import { formatMinor } from '@/lib/format';
import { Check, Sparkles, Loader2, AlertCircle, Building2, PackageCheck } from 'lucide-react';

interface CommercialResolved {
  type: 'PLAN' | 'BUNDLE';
  code: string;
  name: string;
  family?: string;
  billing_cycle?: string;
  pricing?: {
    base_price?: number;
    discount?: number;
    tax?: number;
    final_price?: number;
    monthly?: number;
    one_time?: number;
    currency?: string;
  };
  trial_days?: number;
  marketing_badge?: string | null;
  headline?: string | null;
  description?: string | null;
  features_list?: string[];
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const planParam = searchParams.get('plan')?.trim() || '';
  const bundleParam = searchParams.get('bundle')?.trim() || '';

  const [commercialData, setCommercialData] = useState<CommercialResolved | null>(null);
  const [commercialError, setCommercialError] = useState<string | null>(null);
  const [isResolvingCommercial, setIsResolvingCommercial] = useState<boolean>(Boolean(planParam || bundleParam));

  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function resolveCommercial() {
      if (!planParam && !bundleParam) {
        setCommercialData(null);
        setCommercialError(null);
        setIsResolvingCommercial(false);
        return;
      }

      setIsResolvingCommercial(true);
      setCommercialError(null);

      try {
        const params: Record<string, string> = {};
        if (planParam) params.plan = planParam;
        if (bundleParam) params.bundle = bundleParam;

        const res = await api.get('/v1/public/commercial/resolve', { params });
        if (active) {
          setCommercialData(res.data);
          setCommercialError(null);
          setIsResolvingCommercial(false);
        }
      } catch (err: any) {
        if (active) {
          setCommercialData(null);
          const rawCode = planParam || bundleParam;
          setCommercialError(
            `Paket / bundel pilihan '${rawCode}' tidak valid atau tidak aktif. Silakan pilih paket yang tersedia.`
          );
          setIsResolvingCommercial(false);
        }
      }
    }

    resolveCommercial();

    return () => {
      active = false;
    };
  }, [planParam, bundleParam]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (commercialError) {
      setErrorMsg('Pendaftaran tidak dapat dilanjutkan dengan kode paket yang tidak valid.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Kata sandi dan konfirmasi kata sandi tidak cocok.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Kata sandi harus minimal 8 karakter.');
      return;
    }

    setIsLoading(true);

    try {
      const payload: {
        business_name: string;
        email: string;
        password: string;
        plan_code?: string;
        bundle_code?: string;
      } = {
        business_name: businessName,
        email,
        password,
      };

      if (commercialData) {
        if (commercialData.type === 'PLAN') {
          payload.plan_code = commercialData.code;
        } else if (commercialData.type === 'BUNDLE') {
          payload.bundle_code = commercialData.code;
        }
      } else if (planParam) {
        payload.plan_code = planParam.toUpperCase();
      } else if (bundleParam) {
        payload.bundle_code = bundleParam.toUpperCase();
      }

      await api.post('/v1/auth/register', payload);

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
      } else if (err.response?.data?.error?.details) {
        const details = Object.values(err.response.data.error.details).join(', ');
        setErrorMsg(details);
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
          Buat workspace bisnis Anda untuk mengakses SKMNetwork ERP
        </p>
      </div>

      {/* Package Selector / Commercial Context Banner */}
      {isResolvingCommercial && (
        <div className="p-4 rounded-xl bg-surface-soft border border-line flex items-center justify-center gap-2.5 text-xs text-fog animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin text-pine" />
          <span>Memverifikasi pilihan paket...</span>
        </div>
      )}

      {!isResolvingCommercial && commercialError && (
        <Alert variant="destructive" className="bg-clay-soft/50 border-clay/30 text-clay py-2.5">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-xs font-bold font-heading">Paket Tidak Valid</AlertTitle>
          <AlertDescription className="text-xs">
            {commercialError}{' '}
            <Link href="/register" className="font-bold underline ml-1 hover:text-clay-dark">
              Daftar akun standar
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {!isResolvingCommercial && commercialData && (
        <div className="p-4 rounded-xl bg-surface-soft border border-pine/30 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-pine bg-pine/10 px-2 py-0.5 rounded-full">
              {commercialData.marketing_badge ||
                (commercialData.type === 'PLAN' ? 'Paket ERP' : 'Paket Bundel')}
            </span>
            <span className="font-mono text-[10px] font-semibold text-fog">
              {commercialData.code}
            </span>
          </div>

          <div className="pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-extrabold text-sm text-ink">
                <Sparkles className="h-4 w-4 text-honey shrink-0" />
                <span>{commercialData.name}</span>
              </div>
              {commercialData.pricing && (
                <div className="text-right">
                  {commercialData.type === 'PLAN' && (
                    <span className="font-display font-extrabold text-sm text-ink">
                      {formatMinor(
                        commercialData.pricing.final_price ?? commercialData.pricing.base_price ?? 0
                      )}
                      <span className="font-mono text-[10px] font-normal text-fog">
                        {commercialData.billing_cycle === 'ANNUAL' ? '/thn' : '/bln'}
                      </span>
                    </span>
                  )}
                  {commercialData.type === 'BUNDLE' && (
                    <span className="font-display font-extrabold text-sm text-ink">
                      {formatMinor(commercialData.pricing.monthly ?? 0)}
                      <span className="font-mono text-[10px] font-normal text-fog">/bln</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {commercialData.headline && (
              <p className="text-xs font-medium text-ink/75 mt-1">
                {commercialData.headline}
              </p>
            )}

            {commercialData.description && (
              <p className="text-[11px] text-fog mt-0.5 leading-snug">
                {commercialData.description}
              </p>
            )}

            {Array.isArray(commercialData.features_list) && commercialData.features_list.length > 0 && (
              <ul className="mt-2.5 space-y-1 border-t border-line/60 pt-2">
                {commercialData.features_list.slice(0, 3).map((feat, idx) => (
                  <li key={idx} className="flex items-center gap-1.5 text-[11px] text-ink/80">
                    <Check className="h-3 w-3 text-pine shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {!isResolvingCommercial && !commercialData && !commercialError && (
        <div className="p-3 rounded-xl bg-surface-soft border border-line flex items-center gap-2.5">
          <Building2 className="h-4 w-4 text-pine shrink-0" />
          <p className="text-[11px] text-fog leading-tight">
            Mendaftar workspace bisnis standar. Paket langganan dapat diatur sewaktu-waktu di dalam sistem.
          </p>
        </div>
      )}

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
          disabled={isLoading || Boolean(commercialError)}
          className="w-full h-11 text-sm font-semibold rounded-lg bg-pine hover:bg-pine-dark text-paper shadow-[0_2px_0_rgba(12,32,24,0.35)] transition-all active:scale-[0.98] mt-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Mendaftarkan Bisnis...
            </span>
          ) : commercialData ? (
            `Daftar dengan ${commercialData.name}`
          ) : (
            'Daftar Akun Bisnis'
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