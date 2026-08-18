'use client'

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { canAccessRoute, Role } from '@/lib/rbac';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { status, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated' || status === 'sessionExpired') {
      router.push('/login');
    } else if (status === 'authenticated' && role) {
      if (!canAccessRoute(role as Role, pathname)) {
        router.push('/403');
      }
    }
  }, [status, role, pathname, router]);

  if (status === 'loading' || status === 'unauthenticated' || status === 'sessionExpired') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900" />
          <p className="text-sm text-zinc-500">Memuat sesi...</p>
        </div>
      </div>
    );
  }

  if (status === 'authenticated' && role && !canAccessRoute(role as Role, pathname)) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="flex min-h-screen bg-zinc-50">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex w-full flex-col md:pl-64">
        {/* Header */}
        <Header />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
