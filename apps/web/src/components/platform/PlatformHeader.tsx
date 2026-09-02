'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { getPlatformRoleLabel, PLATFORM_NAVIGATION } from '@/features/platform/list-helpers';
import { SKMNetworkLogo } from '@/components/brand/SKMNetworkLogo';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function PlatformHeader() {
  const { user, platformRole, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const userInitials = user.email ? user.email.substring(0, 2).toUpperCase() : 'U';
  const roleLabel = getPlatformRoleLabel(platformRole);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-ink/10 bg-white/90 backdrop-blur px-4 md:px-6">
      <div className="flex items-center gap-4">
        {/* Mobile nav */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 flex flex-col">
            <SheetTitle className="sr-only">Menu Platform</SheetTitle>
            <div className="flex h-16 items-center px-6 border-b border-ink/10">
              <SKMNetworkLogo size={32} />
            </div>
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
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      isActive ? 'bg-ink/5 text-ink' : 'text-ink/60 hover:bg-ink/5 hover:text-ink'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>

        <div className="flex flex-col">
          <span className="text-sm font-semibold text-ink font-display">SKMNetwork</span>
          <span className="text-xs text-ink/50 uppercase tracking-wider">Platform Control Plane</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Platform context indicator */}
        <span className="hidden sm:inline-flex items-center rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-ink/70">
          Platform · {roleLabel}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" className="relative h-9 w-9 rounded-full" />}>
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-ink/10 text-ink border border-ink/10">{userInitials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-ink">{user.email}</p>
                  <p className="text-xs font-semibold text-ink/80 mt-1">Platform · {roleLabel}</p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-brick focus:text-brick cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Keluar</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
