'use client';

import React, { useEffect, useRef, useState } from 'react';
import { getPlatformModules, PLATFORM_PAGE_SIZE } from '@/features/platform/api';
import type { PlatformModule } from '@/features/platform/types';
import {
  getApiErrorInfo,
  formatPlatformDate,
  formatNullable,
  formatRangeLabel,
  isNextDisabled,
  isPreviousDisabled,
  shouldShowEmpty,
  shouldShowError,
  shouldShowSkeleton,
  shouldShowTable,
} from '@/features/platform/list-helpers';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const FALLBACK = 'Terjadi kesalahan saat mengambil data modul.';
const PAGE_NOUN = 'modul';

const COLUMNS = ['Kode', 'Nama', 'Pilar', 'Kategori', 'Inti', 'Status', 'Dibuat', 'Diperbarui'];

export default function PlatformModulesPage() {
  const [items, setItems] = useState<PlatformModule[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const activeRef = useRef(true);

  const load = async (nextOffset: number) => {
    setLoading(true);
    setError(null);
    setRequestId(null);
    try {
      const data = await getPlatformModules(PLATFORM_PAGE_SIZE, nextOffset);
      if (!activeRef.current) return;
      setItems(data.items);
      setTotal(data.total);
      setOffset(nextOffset);
      setHasMore(data.has_more);
    } catch (err) {
      if (!activeRef.current) return;
      const info = getApiErrorInfo(err, FALLBACK);
      setError(info.message);
      setRequestId(info.requestId);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    activeRef.current = true;
    load(0);
    return () => {
      activeRef.current = false;
    };
  }, [reloadKey]);

  const handleNext = () => {
    if (loading) return;
    load(offset + PLATFORM_PAGE_SIZE);
  };
  const handlePrev = () => {
    if (loading || offset === 0) return;
    load(Math.max(0, offset - PLATFORM_PAGE_SIZE));
  };
  const handleRetry = () => setReloadKey((k) => k + 1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold tracking-tight text-ink">Modul</h2>
        <p className="text-ink/60 mt-1">Modul ERP kanonik platform</p>
      </div>

      {shouldShowSkeleton(loading) && (
        <div className="bg-card border-2 border-ink/10 rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {COLUMNS.map((c) => (
                    <TableHead key={c}>{c}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: COLUMNS.length }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {shouldShowError(loading, error) && (
        <div className="rounded-md bg-brick/5 border border-brick/20 p-4">
          <p className="text-sm text-brick font-medium">Gagal memuat data modul</p>
          <p className="text-sm text-brick/80 mt-1">{error}</p>
          {requestId && <p className="text-xs text-brick/60 mt-2 font-mono">Request ID: {requestId}</p>}
          <Button variant="outline" size="sm" className="mt-3 border-ink/20 text-ink hover:bg-ink/5" onClick={handleRetry}>
            Coba Lagi
          </Button>
        </div>
      )}

      {shouldShowEmpty(loading, error, items.length) && (
        <div className="rounded-md border-2 border-dashed border-ink/10 bg-card p-8 text-center">
          <p className="text-sm font-medium text-ink">Belum ada modul</p>
          <p className="text-sm text-ink/60 mt-1">Tidak ada data modul pada platform ini.</p>
        </div>
      )}

      {shouldShowTable(loading, error, items.length) && (
        <>
          <div className="bg-card border-2 border-ink/10 rounded-md overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {COLUMNS.map((c) => (
                      <TableHead key={c}>{c}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.code}>
                      <TableCell className="font-mono text-xs">{formatNullable(row.code)}</TableCell>
                      <TableCell className="font-medium text-ink">{formatNullable(row.name)}</TableCell>
                      <TableCell className="text-ink/70">{formatNullable(row.pillar)}</TableCell>
                      <TableCell className="text-ink/70">{formatNullable(row.category)}</TableCell>
                      <TableCell className="text-ink/70">{formatNullable(row.is_core)}</TableCell>
                      <TableCell className="text-ink/70">{formatNullable(row.status)}</TableCell>
                      <TableCell className="text-ink/70">{formatPlatformDate(row.created_at)}</TableCell>
                      <TableCell className="text-ink/70">{formatPlatformDate(row.updated_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-ink/60">{formatRangeLabel(total, offset, PLATFORM_PAGE_SIZE, PAGE_NOUN)}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={isPreviousDisabled(loading, offset)}
                className="border-ink/20 text-ink hover:bg-ink/5"
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={isNextDisabled(loading, hasMore)}
                className="border-ink/20 text-ink hover:bg-ink/5"
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
