'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { PlatformGuard } from '@/features/auth/guards';
import { PlatformSidebar } from '@/components/platform/PlatformSidebar';
import { PlatformHeader } from '@/components/platform/PlatformHeader';

function PlatformAccessDenied() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="max-w-md rounded-md border border-brick/20 bg-brick/5 p-6 text-center">
        <h1 className="text-xl font-display font-bold text-ink">Akses Ditolak</h1>
        <p className="mt-2 text-sm text-ink/70">
          Halaman ini hanya tersedia untuk administrator platform (PLATFORM_ADMIN atau SUPER_ADMIN).
        </p>
        <p className="mt-1 text-xs text-ink/50">Sesi Anda tidak memiliki akses ke Platform Control Plane.</p>
      </div>
    </div>
  );
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === '/platform/login';

  useEffect(() => {
    if (!isLoginPage && (status === 'unauthenticated' || status === 'sessionExpired')) {
      router.push('/platform/login');
    }
  }, [status, router, isLoginPage]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink/10 border-t-ink" />
      </div>
    );
  }

  return (
    <PlatformGuard fallback={<PlatformAccessDenied />}>
      <div className="flex min-h-screen bg-paper">
        <PlatformSidebar />
        <div className="flex w-full flex-col md:pl-64">
          <PlatformHeader />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </PlatformGuard>
  );
}
