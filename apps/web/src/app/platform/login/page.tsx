'use client';

import React, { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SKMNetworkLogo } from '@/components/brand/SKMNetworkLogo';
import { Loader2, ShieldAlert } from 'lucide-react';
import { parseLoginError } from '@/features/auth/login-flow';

export default function PlatformLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, status, scope } = useAuth();
  const router = useRouter();

  // Redirect if already authenticated as platform
  useEffect(() => {
    if (status === 'authenticated' && scope === 'platform') {
      router.replace('/platform');
    }
  }, [status, scope, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      // Use existing auth mechanism but pass 'x-auth-context': 'platform'
      await login({
        email,
        password,
        'x-auth-context': 'platform',
      });
      router.replace('/platform');
    } catch (error: unknown) {
      const parsed = parseLoginError(error);
      setErrorMsg(parsed.errorMsg ?? 'Terjadi kesalahan pada server. Silakan coba lagi.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-surface-soft">
      <div className="w-full max-w-md bg-surface border border-line rounded-2xl shadow-card p-6 sm:p-8 space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <SKMNetworkLogo size={44} className="justify-center mb-1" />
          <h1 className="text-2xl font-extrabold font-heading text-ink tracking-tight">
            SKMNetwork Platform
          </h1>
          <p className="text-xs text-fog flex items-center justify-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            Superadmin Control Center
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <Alert variant="destructive" className="bg-clay-soft/50 border-clay/30 text-clay py-2.5">
            <AlertTitle className="text-xs font-bold font-heading">Akses Ditolak</AlertTitle>
            <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
          </Alert>
        )}

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-ink">
              Platform Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@skmnetwork.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 text-sm rounded-lg border-line bg-white/90 focus:border-pine focus:ring-2 focus:ring-pine/15 transition-all placeholder:text-fog/50"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-semibold text-ink">
                Secure Password
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
            disabled={isSubmitting || status === 'loading'}
            className="w-full h-11 text-sm font-semibold rounded-lg bg-ink hover:bg-ink-dark text-paper shadow-md transition-all active:scale-[0.98] mt-2 cursor-pointer"
          >
            {isSubmitting || status === 'loading' ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Authenticating Platform...
              </span>
            ) : (
              'Enter Control Center'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
