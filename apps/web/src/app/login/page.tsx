'use client';

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SKMNetworkLogo } from '@/components/brand/SKMNetworkLogo';
import { Building2, ArrowLeft, Loader2, ArrowRight } from 'lucide-react';

interface AvailableBusiness {
  id: string;
  name: string;
  role?: string;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [availableBusinesses, setAvailableBusinesses] = useState<AvailableBusiness[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      await login({ email, password });
      router.push('/dashboard');
    } catch (error: unknown) {
      const err = error as {
        response?: {
          status?: number;
          data?: {
            message?: string;
            code?: string;
            error?: {
              code?: string;
              message?: string;
              details?: { available_businesses?: AvailableBusiness[] };
            };
            details?: { available_businesses?: AvailableBusiness[] };
          };
        };
      };

      const code = err.response?.data?.error?.code || err.response?.data?.code;
      const businesses =
        err.response?.data?.error?.details?.available_businesses ||
        err.response?.data?.details?.available_businesses;

      if (
        err.response?.status === 409 &&
        code === 'BUSINESS_SELECTION_REQUIRED' &&
        businesses &&
        businesses.length > 0
      ) {
        setAvailableBusinesses(businesses);
      } else if (err.response?.status === 403 && code === 'BUSINESS_ACCESS_DENIED') {
        setErrorMsg('Akun Anda belum terdaftar pada bisnis/tenant manapun.');
      } else if (err.response?.data?.error?.message) {
        setErrorMsg(err.response.data.error.message);
      } else if (err.response?.data?.message) {
        setErrorMsg(err.response.data.message);
      } else {
        setErrorMsg('Terjadi kesalahan pada server. Silakan coba lagi.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectBusiness = async (businessId: string) => {
    setErrorMsg('');
    setIsLoading(true);

    try {
      await login({
        email,
        password,
        business_id: businessId,
        available_businesses: availableBusinesses,
      });
      router.push('/dashboard');
    } catch (error: unknown) {
      const err = error as {
        response?: {
          data?: {
            message?: string;
            error?: { message?: string };
          };
        };
      };
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Gagal memilih bisnis.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setAvailableBusinesses([]);
    setErrorMsg('');
  };

  // Multi-tenant business selection step
  if (availableBusinesses.length > 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface border border-line rounded-2xl shadow-card p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <SKMNetworkLogo size={40} className="justify-center" />
            <h1 className="text-xl font-extrabold font-heading text-ink tracking-tight">
              Pilih Bisnis / Tenant
            </h1>
            <p className="text-xs text-fog max-w-xs">
              Pilih workspace yang ingin Anda akses dengan akun{' '}
              <span className="font-semibold text-ink">{email}</span>:
            </p>
          </div>

          {errorMsg && (
            <Alert variant="destructive" className="bg-clay-soft/50 border-clay/30 text-clay">
              <AlertTitle className="text-xs font-bold font-heading">Gagal Memilih Bisnis</AlertTitle>
              <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            {availableBusinesses.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => handleSelectBusiness(b.id)}
                disabled={isLoading}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-line hover:border-pine/40 hover:bg-pine-soft/30 text-left transition-all group disabled:opacity-50 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-surface-soft border border-line flex items-center justify-center text-ink group-hover:bg-pine-soft group-hover:text-pine transition-colors shrink-0">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="truncate">
                    <p className="font-semibold text-ink text-xs truncate">{b.name}</p>
                    <p className="text-[11px] text-fog font-mono truncate">{b.id.substring(0, 18)}...</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {b.role && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-soft border border-line text-ink font-semibold uppercase tracking-wider">
                      {b.role.toLowerCase()}
                    </span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 text-fog group-hover:text-pine group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleBackToLogin}
            disabled={isLoading}
            className="w-full h-10 border-line hover:bg-surface-soft text-ink flex items-center justify-center gap-2 text-xs font-semibold rounded-lg"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke Login
          </Button>
        </div>
      </div>
    );
  }

  // Primary Login Form
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-line rounded-2xl shadow-card p-6 sm:p-8 space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <SKMNetworkLogo size={44} className="justify-center mb-1" />
          <h1 className="text-2xl font-extrabold font-heading text-ink tracking-tight">
            SKMNet ERP
          </h1>
          <p className="text-xs text-fog">
            Sistem Manajemen Bisnis & Point of Sale
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <Alert variant="destructive" className="bg-clay-soft/50 border-clay/30 text-clay py-2.5">
            <AlertTitle className="text-xs font-bold font-heading">Gagal Masuk</AlertTitle>
            <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
          </Alert>
        )}

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-ink">
              Email Pengguna
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="nama@perusahaan.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 text-sm rounded-lg border-line bg-white/90 focus:border-pine focus:ring-2 focus:ring-pine/15 transition-all placeholder:text-fog/50"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-semibold text-ink">
                Kata Sandi
              </Label>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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
                Memverifikasi Akun...
              </span>
            ) : (
              'Masuk ke Workspace'
            )}
          </Button>

          <div className="pt-2 text-center">
            <p className="text-xs text-fog">
              Belum memiliki akun bisnis?{' '}
              <Link
                href="/register"
                className="font-semibold text-pine hover:underline transition-colors"
              >
                Daftar sekarang
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
