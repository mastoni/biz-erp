'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { createBranch, getApiErrorMessage } from '@/features/inventory/api';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function NewBranchPage() {
  const router = useRouter();
  const { business, isOwner } = useAuth();

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOwner()) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-md border border-red-200">
          Only an owner can create a branch.
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business?.id) return;
    if (!name.trim()) {
      setError('Branch name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await createBranch(business.id, name.trim());
      router.push('/inventory');
      router.refresh();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to create branch'));
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Add New Branch</h2>
        <p className="text-zinc-600 mt-1">Create a branch before managing inventory.</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 rounded-md p-6 space-y-4">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-zinc-700">Branch Name *</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border-zinc-200 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Cabang Pusat"
          />
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <Button variant="outline" type="button" onClick={() => router.push('/inventory')} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Branch
          </Button>
        </div>
      </form>
    </div>
  );
}
