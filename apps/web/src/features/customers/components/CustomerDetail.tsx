'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Customer } from '@/features/customers/types';
import { deleteCustomer } from '@/features/customers/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Trash2, Pencil, AlertTriangle } from 'lucide-react';
import { AxiosError } from 'axios';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-3 border-b border-ink/10 last:border-0">
      <span className="text-sm font-medium text-ink/60 sm:w-48 shrink-0">{label}</span>
      <span className="text-sm text-ink break-all">{value}</span>
    </div>
  );
}

interface CustomerDetailProps {
  customer: Customer;
  isOwner: boolean;
}

export function CustomerDetail({ customer, isOwner }: CustomerDetailProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteCustomer(customer.id);
      router.push('/customers');
    } catch (err: unknown) {
      let msg = 'Gagal menghapus data pelanggan.';
      if (err instanceof AxiosError) {
        msg = err.response?.data?.message || msg;
      }
      setDeleteError(msg);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {isOwner && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/customers/${customer.id}/edit`)}
            className="border-ink/20 text-ink hover:bg-ink/5"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-brick border-brick/20 hover:bg-brick/5"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Hapus
          </Button>
        </div>
      )}

      <Card className="border-2 border-ink/10 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-ink">Detail Pelanggan</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-ink/10">
          <DetailRow label="Nama" value={<span className="font-medium text-ink">{customer.name}</span>} />
          <DetailRow label="Telepon" value={customer.phone ?? <span className="text-ink/40">-</span>} />
          <DetailRow label="Email" value={customer.email ?? <span className="text-ink/40">-</span>} />
          <DetailRow label="Dibuat" value={formatDate(customer.created_at)} />
          <DetailRow label="Diperbarui" value={formatDate(customer.updated_at)} />
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="border-2 border-ink/10 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-ink">
              <AlertTriangle className="h-5 w-5 text-marigold" />
              Hapus Pelanggan
            </DialogTitle>
            <DialogDescription className="text-ink/60">
              Data pelanggan &ldquo;{customer.name}&rdquo; akan dinonaktifkan dari daftar aktif.
              Tindakan ini tidak dapat dibatalkan melalui antarmuka.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-brick">{deleteError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting} className="border-ink/20 text-ink hover:bg-ink/5">
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="bg-brick text-white hover:bg-brick/90"
            >
              {deleting ? 'Menghapus...' : 'Ya, Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
