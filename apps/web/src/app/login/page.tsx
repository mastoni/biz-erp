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

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      const err = error as { response?: { data?: { message?: string } } };
      if (err.response?.data?.message) {
        setErrorMsg(err.response.data.message);
      } else {
        setErrorMsg('Terjadi kesalahan pada server.');
      }
    } finally {
      setIsLoading(false);
    }
  };

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
