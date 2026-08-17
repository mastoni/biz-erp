'use client'

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { canAccessRoute, getAuthorizedNavigation, Role } from '@/lib/rbac';
import Link from 'next/link';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { status, user, business, role, logout } = useAuth();
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
    return <div className="flex min-h-screen items-center justify-center">Memuat sesi...</div>;
  }

  if (status === 'authenticated' && role && !canAccessRoute(role as Role, pathname)) {
    return null; // Will redirect in useEffect
  }

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <aside className="w-64 bg-white border-r flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-4 border-b">
          <h1 className="font-bold text-lg">SKMNet-ERP</h1>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {getAuthorizedNavigation(role as Role).map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`block px-3 py-2 rounded font-medium ${
                      isActive ? 'bg-zinc-100 text-zinc-900' : 'hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-zinc-500">
              {business?.name || 'Bisnis Aktif'}
            </span>
            <span className="px-2 py-1 bg-zinc-100 text-xs rounded border text-zinc-600">
              {role}
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm">{user?.email || 'User'}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>Logout</Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
