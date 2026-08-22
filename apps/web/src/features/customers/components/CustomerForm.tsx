'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { createCustomer, updateCustomer } from '@/features/customers/api';
import { Customer } from '@/features/customers/types';

interface CustomerFormProps {
  businessId: string;
  customer?: Customer; // If provided, it's edit mode
}

export function CustomerForm({ businessId, customer }: CustomerFormProps) {
  const router = useRouter();
  const isEdit = !!customer;

  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): boolean => {
    if (!name.trim()) {
      setError('Nama wajib diisi.');
      return false;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Format email tidak valid.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || saving) return;

    setSaving(true);
    setError(null);

    try {
      if (isEdit && customer) {
        await updateCustomer(customer.id, {
          business_id: businessId,
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        });
        router.push(`/customers/${customer.id}`);
      } else {
        await createCustomer({
          business_id: businessId,
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        });
        router.push('/customers');
      }
    } catch (err: unknown) {
      let msg = 'Terjadi kesalahan saat menyimpan data.';
      if (err && typeof err === 'object' && 'response' in err) {
        const axErr = err as { response?: { data?: { message?: string } } };
        msg = axErr.response?.data?.message || msg;
      }
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-brick/5 border border-brick/20 p-3">
          <p className="text-sm text-brick">{error}</p>
        </div>
      )}

      <Card className="border-2 border-ink/10 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-ink">
            {isEdit ? 'Edit Pelanggan' : 'Tambah Pelanggan'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-ink">Nama <span aria-hidden>*</span></Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama lengkap pelanggan"
              required
              autoFocus
              className="border-ink/15 focus:border-ink focus:ring-marigold/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-ink">Telepon</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              className="border-ink/15 focus:border-ink focus:ring-marigold/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-ink">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@contoh.com"
              className="border-ink/15 focus:border-ink focus:ring-marigold/50"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving} className="bg-ink text-paper hover:bg-ink-2">
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saving ? 'Menyimpan...' : (isEdit ? 'Simpan Perubahan' : 'Simpan')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(customer ? `/customers/${customer.id}` : '/customers')}
          disabled={saving}
          className="border-ink/20 text-ink hover:bg-ink/5"
        >
          Batal
        </Button>
      </div>
    </form>
  );
}
