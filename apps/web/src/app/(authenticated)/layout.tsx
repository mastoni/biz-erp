'use client'

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { TenantGuard } from '@/features/auth/guards';
import { BranchProvider } from '@/features/branches/BranchContext';
import { canAccessRoute, Role } from '@/lib/rbac';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

function TenantAccessDenied() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="max-w-md rounded-md border border-brick/20 bg-brick/5 p-6 text-center">
        <h1 className="text-xl font-display font-bold text-ink">Akses Ditolak</h1>
        <p className="mt-2 text-sm text-ink/70">
          Halaman ini hanya tersedia untuk sesi bisnis/tenant (OWNER atau CASHIER).
        </p>
        <p className="mt-1 text-xs text-ink/50">
          Sesi platform (PLATFORM_ADMIN / SUPER_ADMIN) tidak dapat mengakses ERP tenant.
        </p>
      </div>
    </div>
  );
}

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
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink/10 border-t-ink" />
          <p className="text-sm text-ink/60">Memuat sesi...</p>
        </div>
      </div>
    );
  }

  if (status === 'authenticated' && role && !canAccessRoute(role as Role, pathname)) {
    return null; // Will redirect in useEffect
  }

  // Scope gate: tenant ERP pages require an explicit tenant session. Platform
  // sessions (PLATFORM_ADMIN / SUPER_ADMIN) are rejected here, so they can never
  // enter the tenant shell by UI state alone. The server remains authoritative.
  return (
    <TenantGuard fallback={<TenantAccessDenied />}>
      <BranchProvider>
        <div className="flex min-h-screen bg-paper">
           {/* Desktop Sidebar */}
           <Sidebar className="no-print" />

           {/* Main Content Area */}
           <div className="flex w-full flex-col md:pl-64">
             {/* Header */}
             <Header className="no-print" />

             {/* Page Content */}
             <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
               <div className="mx-auto max-w-7xl">
                 {children}
               </div>
             </main>
           </div>
        </div>
      </BranchProvider>
    </TenantGuard>
  );
}
