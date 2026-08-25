'use client';

import React, { useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { Building2, Check, ChevronDown, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-fog text-xs bg-surface-soft border border-line">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-fog" />
        <span>Memuat tenant...</span>
      </div>
    );
  }

  if (tenantStatus === 'empty') {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-clay text-xs bg-clay-soft border border-clay/20">
        <span>Tidak ada tenant aktif</span>
      </div>
    );
  }

  const hasMultipleTenants = availableBusinesses && availableBusinesses.length > 1;

  // Single-tenant view: clean display, no dropdown needed
  if (!hasMultipleTenants) {
    return (
      <div className="flex items-center gap-2.5 px-2 py-1">
        <div className="h-8 w-8 rounded-lg bg-surface-soft border border-line flex items-center justify-center text-ink shrink-0 shadow-xs">
          <Building2 className="h-4 w-4 text-pine" />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-ink font-heading leading-tight truncate max-w-[160px]">
              {business.name}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-pine shrink-0" title="Active Tenant" />
          </div>
          <span className="text-[10px] text-fog capitalize leading-tight">
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
        className="flex items-center gap-2.5 p-1.5 rounded-lg border border-line hover:border-ink/20 hover:bg-surface-soft transition-all text-left group focus:outline-none focus:ring-2 focus:ring-pine/20 cursor-pointer"
      >
        <div className="h-8 w-8 rounded-lg bg-surface-soft group-hover:bg-surface border border-line flex items-center justify-center text-ink shrink-0 transition-colors shadow-xs">
          {isSwitching || tenantStatus === 'switching' ? (
            <Loader2 className="h-4 w-4 animate-spin text-pine" />
          ) : (
            <Building2 className="h-4 w-4 text-pine" />
          )}
        </div>
        <div className="flex flex-col min-w-0 max-w-[140px] md:max-w-[180px]">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-ink font-heading leading-tight truncate">
              {business.name}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-pine shrink-0" title="Active Tenant" />
          </div>
          <span className="text-[10px] text-fog capitalize leading-tight">
            {role ? role.toLowerCase() : 'Tenant'}
          </span>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-fog group-hover:text-ink transition-colors ml-0.5 shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64" align="start">
        <div className="font-semibold text-[10px] text-fog uppercase tracking-wider px-3 py-1.5">
          Tenant / Bisnis Tersedia
        </div>
        <DropdownMenuSeparator />

        {localError && (
          <div className="p-2 mb-1 text-xs text-clay bg-clay-soft rounded-md">
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
                isActive ? 'bg-pine-soft font-semibold text-pine' : 'text-ink hover:bg-surface-soft'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 border ${
                  isActive ? 'bg-pine text-paper border-pine' : 'bg-surface-soft text-fog border-line'
                }`}>
                  <Building2 className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs truncate leading-snug font-medium">{b.name}</span>
                  <div className="flex items-center gap-1.5">
                    {b.role && (
                      <span className="text-[10px] text-fog capitalize font-sans">{b.role.toLowerCase()}</span>
                    )}
                    <span className="text-[10px] text-fog/70 font-mono truncate max-w-[80px]">{b.id.substring(0, 8)}...</span>
                  </div>
                </div>
              </div>
              {isActive && <Check className="h-3.5 w-3.5 text-pine ml-2 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
