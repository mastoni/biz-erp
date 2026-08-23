'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PLATFORM_NAVIGATION } from '@/features/platform/list-helpers';
import { SKMNetworkLogo } from '@/components/brand/SKMNetworkLogo';

export function PlatformSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-ink/10">
      <div className="flex h-16 items-center px-6 border-b border-ink/10">
        <SKMNetworkLogo size={32} />
      </div>

      {/* Master brand + platform scope label (never SKMNet as master brand) */}
      <div className="px-6 pt-4 pb-2">
        <p className="text-sm font-semibold text-ink font-display">SKMNetwork</p>
        <p className="text-[11px] text-ink/50 uppercase tracking-wider">Platform Control Plane</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-1">
        {PLATFORM_NAVIGATION.map((item) => {
          const isActive =
            item.href === '/platform'
              ? pathname === '/platform'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-ink/5 text-ink' : 'text-ink/60 hover:bg-ink/5 hover:text-ink'
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-ink/10">
        <div className="text-xs text-ink/40 text-center">SKMNetwork Platform</div>
      </div>
    </aside>
  );
}
