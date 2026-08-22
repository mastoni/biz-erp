'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getAuthorizedNavigation, Role } from '@/lib/rbac';
import { useAuth } from '@/features/auth/AuthContext';
import { SKMNetworkLogo } from '@/components/brand/SKMNetworkLogo';

export function Sidebar() {
  const { role } = useAuth();
  const pathname = usePathname();

  if (!role) return null;

  const navigation = getAuthorizedNavigation(role as Role);

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-ink/10">
      <div className="flex h-16 items-center px-6 border-b border-ink/10">
        <SKMNetworkLogo size={32} />
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-ink/5 text-ink'
                  : 'text-ink/60 hover:bg-ink/5 hover:text-ink'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-ink' : 'text-ink/50'}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-ink/10">
        <div className="text-xs text-ink/40 text-center">
          SKMNetwork ERP
        </div>
      </div>
    </aside>
  );
}
