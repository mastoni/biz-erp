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
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-zinc-200 bg-white px-4 md:px-6">
      <div className="flex items-center gap-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 flex flex-col">
            <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
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
                    onClick={() => setOpen(false)}
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
            <div className="p-4 border-t border-zinc-200 bg-zinc-50">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-zinc-200 text-zinc-700">{userInitials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col truncate">
                  <span className="text-sm font-medium text-zinc-900 truncate">{business?.name || 'Loading...'}</span>
                  <span className="text-xs text-zinc-500 truncate">{user.email}</span>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        
        {/* Only show business name on mobile/tablet if space permits, hidden on desktop to let sidebar breathe or we can show it */}
        <div className="hidden md:flex flex-col">
          <span className="text-sm font-semibold text-zinc-900">{business?.name || 'Loading...'}</span>
          <span className="text-xs text-zinc-500 capitalize">{role.toLowerCase()}</span>
        </div>
        <div className="md:hidden flex flex-col">
          <span className="text-sm font-semibold text-zinc-900">{business?.name || 'SKMNet'}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" className="relative h-9 w-9 rounded-full" />}>
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-zinc-100 text-zinc-700 border border-zinc-200">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none text-zinc-900">{user.email}</p>
                <p className="text-xs leading-none text-zinc-500">{business?.name}</p>
                <p className="text-xs font-semibold text-zinc-700 mt-1 capitalize">{role.toLowerCase()}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Keluar</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
