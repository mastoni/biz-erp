'use client'

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SKMNetworkLogo } from '@/components/brand/SKMNetworkLogo';
import { Building2, ArrowLeft } from 'lucide-react';

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
              details?: { available_businesses?: AvailableBusiness[] } 
            };
            details?: { available_businesses?: AvailableBusiness[] };
          } 
        } 
      };

      const code = err.response?.data?.error?.code || err.response?.data?.code;
      const businesses = err.response?.data?.error?.details?.available_businesses || err.response?.data?.details?.available_businesses;

      if (err.response?.status === 409 && code === 'BUSINESS_SELECTION_REQUIRED' && businesses && businesses.length > 0) {
        setAvailableBusinesses(businesses);
      } else if (err.response?.status === 403 && code === 'BUSINESS_ACCESS_DENIED') {
        setErrorMsg('Akun Anda belum terdaftar pada bisnis/tenant manapun.');
      } else if (err.response?.data?.error?.message) {
        setErrorMsg(err.response.data.error.message);
      } else if (err.response?.data?.message) {
        setErrorMsg(err.response.data.message);
      } else {
        setErrorMsg('Terjadi kesalahan pada server.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectBusiness = async (businessId: string) => {
    setErrorMsg('');
    setIsLoading(true);

    try {
      await login({ email, password, business_id: businessId, available_businesses: availableBusinesses });
      router.push('/dashboard');
    } catch (error: unknown) {
      const err = error as { 
        response?: { 
          data?: { 
            message?: string;
            error?: { message?: string };
          } 
        } 
      };
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Gagal memilih bisnis.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setAvailableBusinesses([]);
    setErrorMsg('');
  };

  if (availableBusinesses.length > 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-4">
        <Card className="w-full max-w-md border-2 border-ink/10 shadow-card">
          <CardHeader className="space-y-4">
            <SKMNetworkLogo size={48} />
            <div>
              <CardTitle className="text-2xl font-display font-bold text-ink">Pilih Bisnis</CardTitle>
              <CardDescription className="text-ink/60">
                Pilih tenant yang ingin Anda akses dengan akun <span className="font-semibold text-ink">{email}</span>:
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertTitle>Gagal Memilih Bisnis</AlertTitle>
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              {availableBusinesses.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleSelectBusiness(b.id)}
                  disabled={isLoading}
                  className="w-full flex items-center justify-between p-3.5 rounded-lg border border-ink/15 hover:border-ink/40 hover:bg-ink/5 text-left transition-all group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-md bg-ink/5 group-hover:bg-ink/10 flex items-center justify-center text-ink transition-colors">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-ink text-sm">{b.name}</p>
                      <p className="text-xs text-ink/50 font-mono">{b.id}</p>
                    </div>
                  </div>
                  {b.role && (
                    <span className="text-xs px-2 py-0.5 rounded bg-ink/10 text-ink/80 font-medium capitalize">
                      {b.role.toLowerCase()}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleBackToLogin}
              disabled={isLoading}
              className="w-full border-ink/15 hover:bg-ink/5 text-ink flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4">
      <Card className="w-full max-w-md border-2 border-ink/10 shadow-card">
        <CardHeader className="space-y-4">
          <SKMNetworkLogo size={48} />
          <div>
            <CardTitle className="text-2xl font-display font-bold text-ink">SKMNet ERP</CardTitle>
            <CardDescription className="text-ink/60">Login untuk mengakses dashboard.</CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertTitle>Gagal Login</AlertTitle>
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-ink">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="nama@perusahaan.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-ink/15 focus:border-ink focus:ring-marigold/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-ink">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-ink/15 focus:border-ink focus:ring-marigold/50"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full bg-ink text-paper hover:bg-ink-2" disabled={isLoading}>
              {isLoading ? 'Sedang masuk...' : 'Masuk'}
            </Button>
            <p className="text-sm text-ink/60 text-center">
              Belum punya akun?{' '}
              <Link href="/register" className="text-marigold-2 hover:text-marigold font-medium underline">
                Daftar
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
