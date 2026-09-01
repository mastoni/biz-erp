'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getAuthorizedNavigation, Role } from '@/lib/rbac';
import { useAuth } from '@/features/auth/AuthContext';
import { SKMNetworkLogo } from '@/components/brand/SKMNetworkLogo';

export interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps = {}) {
  const { role } = useAuth();
  const pathname = usePathname();

  if (!role) return null;

  const navigation = getAuthorizedNavigation(role as Role);

  return (
    <aside className={`hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-[#0c2018] text-[#f0efe7] border-r border-[#1a2620] z-30 ${className || ''}`}>
      {/* Brand Header */}
      <div className="flex h-16 items-center px-6 border-b border-[#f0efe7]/10 bg-[#0c2018]">
        <SKMNetworkLogo dark size={32} />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#17593e] text-[#f0efe7] font-semibold shadow-sm border border-[#1f7350]/40'
                  : 'text-[#f0efe7]/70 hover:bg-[#f0efe7]/8 hover:text-[#f0efe7]'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#d3921f]' : 'text-[#f0efe7]/50'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Footer */}
      <div className="p-4 border-t border-[#f0efe7]/10 bg-[#0a1b14]">
        <div className="flex items-center justify-between text-[11px] text-[#f0efe7]/45 font-mono">
          <span>v1.1 ERP</span>
          <span className="h-1.5 w-1.5 rounded-full bg-[#17593e]" />
          <span>PROD</span>
        </div>
      </div>
    </aside>
  );
}
