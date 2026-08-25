'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, LogOut, Building2, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { useBranchContext } from '@/features/branches/BranchContext';
import { getAuthorizedNavigation, Role } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TenantSwitcher } from '@/components/layout/TenantSwitcher';
import { StatusPill } from '@/components/ui/status-pill';
import { SKMNetworkLogo } from '@/components/brand/SKMNetworkLogo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  const { user, business, role, logout } = useAuth();
  const { branches, activeBranch, selectBranch, isLoading: isBranchLoading } = useBranchContext();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (!user || !role) return null;

  const navigation = getAuthorizedNavigation(role as Role);
  const userInitials = user.email ? user.email.substring(0, 2).toUpperCase() : 'U';

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-line bg-surface/85 backdrop-blur-md px-4 md:px-6 shadow-[0_1px_2px_rgba(26,29,26,0.03)]">
      {/* Left Section: Mobile Menu + Tenant Switcher + Branch Selector */}
      <div className="flex items-center gap-3">
        {/* Mobile Navigation Drawer */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden text-ink hover:bg-surface-soft" />}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Buka menu navigasi</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 flex flex-col bg-[#0c2018] text-[#f0efe7] border-r border-[#1a2620]">
            <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
            <div className="flex h-16 items-center px-6 border-b border-[#f0efe7]/10">
              <SKMNetworkLogo dark size={28} />
            </div>
            <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[#17593e] text-[#f0efe7] font-semibold shadow-sm'
                        : 'text-[#f0efe7]/70 hover:bg-[#f0efe7]/8 hover:text-[#f0efe7]'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-[#d3921f]' : 'text-[#f0efe7]/50'}`} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-[#f0efe7]/10 bg-[#0a1b14]">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-[#17593e] text-[#f0efe7] text-xs font-bold">{userInitials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col truncate">
                  <span className="text-xs font-medium text-[#f0efe7] truncate">{business?.name || 'Workspace'}</span>
                  <span className="text-[10px] text-[#f0efe7]/60 truncate">{user.email}</span>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Tenant Switcher */}
        <TenantSwitcher />

        {/* Branch Selector Dropdown */}
        {branches && branches.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={isBranchLoading}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-soft border border-line text-xs font-medium text-ink hover:bg-surface transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-pine/20"
            >
              <Building2 className="h-3.5 w-3.5 text-fog" />
              <span className="truncate max-w-[140px]">
                {activeBranch ? activeBranch.name : 'Pilih Cabang'}
              </span>
              <ChevronDown className="h-3 w-3 text-fog ml-0.5" />
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-56" align="start">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-fog px-2.5 py-1.5">
                Pilih Cabang Operasional
              </div>
              <DropdownMenuSeparator />

              {branches.map((b) => {
                const isSelected = activeBranch?.id === b.id;
                return (
                  <DropdownMenuItem
                    key={b.id}
                    onClick={() => selectBranch(b.id)}
                    className={`flex items-center justify-between px-2.5 py-2 text-xs cursor-pointer rounded-md transition-colors ${
                      isSelected ? 'bg-pine-soft text-pine font-semibold' : 'text-ink hover:bg-surface-soft'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Building2 className={`h-3.5 w-3.5 ${isSelected ? 'text-pine' : 'text-fog'}`} />
                      <span className="truncate">{b.name}</span>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-pine shrink-0" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Right Section: Sync Status + User Profile */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:block">
          <StatusPill status="synced" label="Tersinkron" />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 hover:ring-2 hover:ring-pine/20" />}
          >
            <Avatar className="h-9 w-9 border border-line">
              <AvatarFallback className="bg-pine-soft text-pine font-bold text-xs">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <div className="flex flex-col space-y-1 p-2">
              <p className="text-xs font-semibold text-ink truncate">{user.email}</p>
              <p className="text-[11px] text-fog truncate">{business?.name}</p>
              <div className="pt-1">
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-surface-soft border border-line text-ink">
                  {role}
                </span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-clay focus:text-clay cursor-pointer text-xs">
              <LogOut className="mr-2 h-3.5 w-3.5" />
              <span>Keluar</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
