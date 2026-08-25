'use client';

import React, { useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { Building2, Check, ChevronDown, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function TenantSwitcher() {
  const {
    business,
    availableBusinesses,
    role,
    tenantStatus,
    switchTenant,
    error,
  } = useAuth();

  const [isSwitching, setIsSwitching] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (tenantStatus === 'loading' || !business) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-ink/50 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-ink/40" />
        <span className="text-xs">Memuat tenant...</span>
      </div>
    );
  }

  if (tenantStatus === 'empty') {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-brick text-xs">
        <span>Tidak ada tenant aktif</span>
      </div>
    );
  }

  const hasMultipleTenants = availableBusinesses && availableBusinesses.length > 1;

  // Single-tenant view: clean display, no dropdown needed
  if (!hasMultipleTenants) {
    return (
      <div className="flex items-center gap-2.5 px-1 py-1">
        <div className="h-8 w-8 rounded-md bg-ink/5 border border-ink/10 flex items-center justify-center text-ink shrink-0">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-ink font-display leading-tight truncate max-w-[180px]">
              {business.name}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" title="Active Tenant" />
          </div>
          <span className="text-xs text-ink/60 capitalize leading-tight">
            {role ? role.toLowerCase() : 'Tenant'}
          </span>
        </div>
      </div>
    );
  }

  const handleSelectTenant = async (businessId: string) => {
    if (businessId === business.id) return;

    setIsSwitching(true);
    setLocalError(null);

    try {
      await switchTenant(businessId);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Gagal beralih tenant');
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isSwitching || tenantStatus === 'switching'}
        className="flex items-center gap-2.5 p-1.5 rounded-lg border border-ink/10 hover:border-ink/25 hover:bg-ink/5 transition-all text-left group focus:outline-none focus:ring-2 focus:ring-ink/10"
      >
        <div className="h-8 w-8 rounded-md bg-ink/5 group-hover:bg-ink/10 border border-ink/10 flex items-center justify-center text-ink shrink-0 transition-colors">
          {isSwitching || tenantStatus === 'switching' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Building2 className="h-4 w-4" />
          )}
        </div>
        <div className="flex flex-col min-w-0 max-w-[160px] md:max-w-[200px]">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-ink font-display leading-tight truncate">
              {business.name}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" title="Active Tenant" />
          </div>
          <span className="text-xs text-ink/60 capitalize leading-tight">
            {role ? role.toLowerCase() : 'Tenant'}
          </span>
        </div>
        <ChevronDown className="h-4 w-4 text-ink/40 group-hover:text-ink/70 transition-colors ml-1 shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64" align="start">
        <DropdownMenuLabel className="font-normal text-xs text-ink/60 uppercase tracking-wider px-3 py-1.5">
          Tenant / Bisnis Tersedia
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {localError && (
          <div className="p-2 mb-1 text-xs text-brick bg-brick/10 rounded">
            {localError}
          </div>
        )}

        {availableBusinesses.map((b) => {
          const isActive = b.id === business.id;
          return (
            <DropdownMenuItem
              key={b.id}
              onClick={() => handleSelectTenant(b.id)}
              disabled={isSwitching || tenantStatus === 'switching'}
              className={`flex items-center justify-between p-2.5 cursor-pointer rounded-md transition-colors ${
                isActive ? 'bg-ink/5 font-medium text-ink' : 'text-ink/80 hover:bg-ink/5 hover:text-ink'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`h-7 w-7 rounded flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-ink text-paper' : 'bg-ink/5 text-ink/70'
                }`}>
                  <Building2 className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm truncate leading-snug">{b.name}</span>
                  <div className="flex items-center gap-1.5">
                    {b.role && (
                      <span className="text-[10px] text-ink/50 capitalize font-sans">{b.role.toLowerCase()}</span>
                    )}
                    <span className="text-[10px] text-ink/40 font-mono truncate max-w-[80px]">{b.id.substring(0, 8)}...</span>
                  </div>
                </div>
              </div>
              {isActive && <Check className="h-4 w-4 text-ink ml-2 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
