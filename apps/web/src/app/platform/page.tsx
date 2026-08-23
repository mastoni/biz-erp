'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getPlatformContext } from '@/features/platform/api';
import {
  getApiErrorInfo,
  getPlatformContextDisplay,
  getPlatformRoleLabel,
  PLATFORM_NAVIGATION,
} from '@/features/platform/list-helpers';
import type { PlatformContext } from '@/features/platform/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const FALLBACK = 'Terjadi kesalahan saat memuat konteks platform.';

export default function PlatformOverviewPage() {
  const [context, setContext] = useState<PlatformContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    (async () => {
      setLoading(true);
      setError(null);
      setRequestId(null);
      try {
        const data = await getPlatformContext();
        if (!activeRef.current) return;
        setContext(data);
      } catch (err) {
        if (!activeRef.current) return;
        const info = getApiErrorInfo(err, FALLBACK);
        setError(info.message);
        setRequestId(info.requestId);
      } finally {
        if (activeRef.current) setLoading(false);
      }
    })();
    return () => {
      activeRef.current = false;
    };
  }, [reloadKey]);

  const sections = PLATFORM_NAVIGATION.filter((n) => n.href !== '/platform');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold tracking-tight text-ink">Platform Control Plane</h2>
        <p className="text-ink/60 mt-1">SKMNetwork — ikhtisar kendali platform</p>
      </div>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-md bg-brick/5 border border-brick/20 p-4">
          <p className="text-sm text-brick font-medium">Gagal memuat konteks platform</p>
          <p className="text-sm text-brick/80 mt-1">{error}</p>
          {requestId && <p className="text-xs text-brick/60 mt-2 font-mono">Request ID: {requestId}</p>}
          <Button
            variant="outline"
            size="sm"
            className="mt-3 border-ink/20 text-ink hover:bg-ink/5"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Coba Lagi
          </Button>
        </div>
      )}

      {!loading && !error && context && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border-2 border-ink/10 bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-ink/50">Scope</p>
            <p className="mt-1 text-lg font-semibold text-ink">{getPlatformContextDisplay(context).scope}</p>
          </div>
          <div className="rounded-md border-2 border-ink/10 bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-ink/50">Role</p>
            <p className="mt-1 text-lg font-semibold text-ink">{getPlatformRoleLabel(context.role)}</p>
          </div>
          <div className="rounded-md border-2 border-ink/10 bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-ink/50">User ID</p>
            <p className="mt-1 text-lg font-semibold text-ink font-mono truncate">{context.userId}</p>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink/50 mb-3">Bagian Platform</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md border-2 border-ink/10 bg-card p-4 text-ink font-medium hover:bg-ink/5 transition-colors"
            >
              {item.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
