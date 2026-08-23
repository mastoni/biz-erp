'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, LogOut } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { getAuthorizedNavigation, Role } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  const { user, business, role, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (!user || !role) return null;

  const navigation = getAuthorizedNavigation(role as Role);
  const userInitials = user.email ? user.email.substring(0, 2).toUpperCase() : 'U';

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-ink/10 bg-white/90 backdrop-blur px-4 md:px-6">
      <div className="flex items-center gap-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 flex flex-col">
            <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
            <div className="flex h-16 items-center px-6 border-b border-ink/10">
              <span className="text-xl font-bold text-ink tracking-tight font-display">SKMNetwork ERP</span>
            </div>
            <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setOpen(false)}
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
            <div className="p-4 border-t border-ink/10 bg-paper">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-ink/10 text-ink border border-ink/10">{userInitials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col truncate">
                  <span className="text-sm font-medium text-ink truncate">{business?.name || 'Loading...'}</span>
                  <span className="text-xs text-ink/60 truncate">{user.email}</span>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <div className="hidden md:flex flex-col">
          <span className="text-sm font-semibold text-ink font-display">{business?.name || 'Loading...'}</span>
          <span className="text-xs text-ink/60 capitalize">{role.toLowerCase()}</span>
        </div>
          <div className="md:hidden flex flex-col">
            <span className="text-sm font-semibold text-ink font-display">{business?.name || 'SKMNetwork'}</span>
          </div>
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" className="relative h-9 w-9 rounded-full" />}>
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-ink/10 text-ink border border-ink/10">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none text-ink">{user.email}</p>
                <p className="text-xs leading-none text-ink/60">{business?.name}</p>
                <p className="text-xs font-semibold text-ink/80 mt-1 capitalize">{role.toLowerCase()}</p>
              </div>
            </DropdownMenuLabel>
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
