'use client';

import React, { useState, FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SKMNetworkLogo } from '@/components/brand/SKMNetworkLogo';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { requestPasswordReset, parsePasswordError } from '@/features/auth/password-recovery';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      await requestPasswordReset({ email });
      setIsSuccess(true);
    } catch (err) {
      setErrorMsg(parsePasswordError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-line rounded-2xl shadow-card p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <SKMNetworkLogo size={44} className="justify-center mb-1" />
          <h1 className="text-2xl font-extrabold font-heading text-ink tracking-tight">
            Lupa Kata Sandi?
          </h1>
          <p className="text-xs text-fog max-w-xs">
            Masukkan alamat email akun bisnis Anda untuk menerima tautan pemulihan kata sandi.
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <Alert variant="destructive" className="bg-clay-soft/50 border-clay/30 text-clay py-2.5">
            <AlertTitle className="text-xs font-bold font-heading">Kendala Pemulihan</AlertTitle>
            <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
          </Alert>
        )}

        {/* Success State */}
        {isSuccess ? (
          <div className="space-y-5 text-center">
            <div className="p-4 bg-pine-soft/40 border border-pine/20 rounded-xl flex flex-col items-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-pine" />
              <p className="text-xs font-semibold text-ink">Permintaan Telah Diterima</p>
              <p className="text-xs text-fog">
                Jika email <span className="font-semibold text-ink">{email}</span> terdaftar di sistem kami, instruksi pemulihan kata sandi telah dikirim. Silakan periksa kotak masuk atau folder spam Anda.
              </p>
            </div>

            <Link href="/login" className="block w-full">
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 border-line text-xs font-semibold rounded-lg hover:bg-surface-soft text-ink flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Halaman Masuk
              </Button>
            </Link>
          </div>
        ) : (
          /* Request Form */
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

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 text-sm font-semibold rounded-lg bg-pine hover:bg-pine-dark text-paper shadow-[0_2px_0_rgba(12,32,24,0.35)] transition-all active:scale-[0.98] mt-2 cursor-pointer"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mengirim Instruksi...
                </span>
              ) : (
                'Kirim Tautan Pemulihan'
              )}
            </Button>

            <div className="pt-2 text-center">
              <Link
                href="/login"
                className="text-xs font-medium text-fog hover:text-ink flex items-center justify-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Kembali ke Halaman Masuk
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
