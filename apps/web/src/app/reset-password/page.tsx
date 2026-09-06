'use client';

import React, { useState, FormEvent, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SKMNetworkLogo } from '@/components/brand/SKMNetworkLogo';
import { Loader2, CheckCircle2, KeyRound } from 'lucide-react';
import { resetPassword, parsePasswordError } from '@/features/auth/password-recovery';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get('token') || '';
  const router = useRouter();

  const [token, setToken] = useState(tokenParam);
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!token) {
      setErrorMsg('Tautan pemulihan kata sandi tidak valid atau token tidak ditemukan.');
      return;
    }

    if (newPassword !== confirmation) {
      setErrorMsg('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg('Kata sandi baru minimal 8 karakter.');
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword({
        token,
        new_password: newPassword,
        confirmation,
      });
      setIsSuccess(true);
    } catch (err) {
      setErrorMsg(parsePasswordError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-surface border border-line rounded-2xl shadow-card p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col items-center text-center space-y-2">
        <SKMNetworkLogo size={44} className="justify-center mb-1" />
        <h1 className="text-2xl font-extrabold font-heading text-ink tracking-tight">
          Atur Ulang Kata Sandi
        </h1>
        <p className="text-xs text-fog max-w-xs">
          Masukkan kata sandi baru yang aman untuk akun bisnis Anda.
        </p>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <Alert variant="destructive" className="bg-clay-soft/50 border-clay/30 text-clay py-2.5">
          <AlertTitle className="text-xs font-bold font-heading">Gagal Mengatur Ulang</AlertTitle>
          <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Success State */}
      {isSuccess ? (
        <div className="space-y-5 text-center">
          <div className="p-4 bg-pine-soft/40 border border-pine/20 rounded-xl flex flex-col items-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-pine" />
            <p className="text-xs font-semibold text-ink">Kata Sandi Berhasil Diperbarui</p>
            <p className="text-xs text-fog">
              Kata sandi akun Anda telah diperbarui. Seluruh sesi login lama telah ditutup demi keamanan. Silakan masuk kembali dengan kata sandi baru Anda.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => router.push('/login')}
            className="w-full h-11 text-sm font-semibold rounded-lg bg-pine hover:bg-pine-dark text-paper shadow-[0_2px_0_rgba(12,32,24,0.35)] transition-all active:scale-[0.98] cursor-pointer"
          >
            Masuk Sekarang
          </Button>
        </div>
      ) : (
        /* Form */
        <form onSubmit={handleSubmit} className="space-y-4">
          {!tokenParam && (
            <div className="space-y-1.5">
              <Label htmlFor="token" className="text-xs font-semibold text-ink">
                Token Pemulihan
              </Label>
              <Input
                id="token"
                type="text"
                placeholder="Tempel token dari email Anda"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                className="h-10 text-sm rounded-lg border-line bg-white/90 focus:border-pine focus:ring-2 focus:ring-pine/15 transition-all"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="newPassword" className="text-xs font-semibold text-ink">
              Kata Sandi Baru
            </Label>
            <Input
              id="newPassword"
              type="password"
              placeholder="Minimal 8 karakter"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="h-10 text-sm rounded-lg border-line bg-white/90 focus:border-pine focus:ring-2 focus:ring-pine/15 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmation" className="text-xs font-semibold text-ink">
              Konfirmasi Kata Sandi Baru
            </Label>
            <Input
              id="confirmation"
              type="password"
              placeholder="Ulangi kata sandi baru"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
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
                Memperbarui Kata Sandi...
              </span>
            ) : (
              'Simpan Kata Sandi Baru'
            )}
          </Button>

          <div className="pt-2 text-center">
            <Link
              href="/login"
              className="text-xs font-medium text-fog hover:text-ink transition-colors"
            >
              Kembali ke Halaman Masuk
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-surface border border-line rounded-2xl p-8 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-pine" />
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
