'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getAuthorizedNavigation, Role } from '@/lib/rbac';
import { useAuth } from '@/features/auth/AuthContext';

export function Sidebar() {
  const { role } = useAuth();
  const pathname = usePathname();
  
  if (!role) return null;

  const navigation = getAuthorizedNavigation(role as Role);

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-zinc-200">
      <div className="flex h-16 items-center px-6 border-b border-zinc-200">
        <span className="text-xl font-bold text-zinc-900 tracking-tight">SKMNet ERP</span>
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
                  ? 'bg-zinc-100 text-zinc-900' 
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-zinc-900' : 'text-zinc-500'}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-zinc-200">
        <div className="text-xs text-zinc-400 text-center">
          SKMNet v4.1.5
        </div>
      </div>
    </aside>
  );
}
