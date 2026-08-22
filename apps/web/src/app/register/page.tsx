'use client'

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SKMNetworkLogo } from '@/components/brand/SKMNetworkLogo';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    if (password !== confirmPassword) {
      setErrorMsg('Password dan konfirmasi password tidak cocok.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.post('/v1/auth/register', {
        business_name: businessName,
        email,
        password,
      });

      setSuccessMsg('Pendaftaran berhasil! Mengalihkan ke login...');
      
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string; details?: Record<string, string> } }; status?: number } };
      if (err.response?.status === 429) {
        setErrorMsg('Terlalu banyak percobaan pendaftaran. Silakan coba lagi nanti.');
      } else if (err.response?.data?.error?.message) {
        setErrorMsg(err.response.data.error.message);
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
            <CardTitle className="text-2xl font-display font-bold text-ink">Daftar Akun Baru</CardTitle>
            <CardDescription className="text-ink/60">Buat akun dan bisnis Anda untuk mengakses SKMNet ERP.</CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertTitle>Gagal</AlertTitle>
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}
            {successMsg && (
              <Alert className="border-leaf/20 bg-leaf/5 text-leaf">
                <AlertTitle>Berhasil</AlertTitle>
                <AlertDescription>{successMsg}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-ink">Nama Bisnis</Label>
              <Input 
                id="businessName" 
                type="text" 
                placeholder="Nama bisnis Anda" 
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                className="border-ink/15 focus:border-ink focus:ring-marigold/50"
              />
            </div>
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
                placeholder="Minimal 8 karakter" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="border-ink/15 focus:border-ink focus:ring-marigold/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-ink">Konfirmasi Password</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                placeholder="Ulangi password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="border-ink/15 focus:border-ink focus:ring-marigold/50"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full bg-ink text-paper hover:bg-ink-2" disabled={isLoading}>
              {isLoading ? 'Mendaftarkan...' : 'Daftar'}
            </Button>
            <p className="text-sm text-ink/60 text-center">
              Sudah punya akun?{' '}
              <Link href="/login" className="text-marigold-2 hover:text-marigold font-medium underline">
                Masuk
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}