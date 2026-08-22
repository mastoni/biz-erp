'use client';

import React from 'react';
import { Customer } from '@/features/customers/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatCustomerDate } from '../list-helpers';

interface CustomersTableProps {
  customers: Customer[];
  isOwner: boolean;
}

export function CustomersTable({ customers, isOwner }: CustomersTableProps) {
  const router = useRouter();

  return (
    <div className="bg-card border-2 border-ink/10 rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-ink/5">
              <TableHead className="whitespace-nowrap font-semibold text-ink">Nama</TableHead>
              <TableHead className="whitespace-nowrap font-semibold text-ink">Telepon</TableHead>
              <TableHead className="whitespace-nowrap font-semibold text-ink">Email</TableHead>
              <TableHead className="whitespace-nowrap font-semibold text-ink">Dibuat</TableHead>
              <TableHead className="whitespace-nowrap font-semibold text-ink">Diperbarui</TableHead>
              <TableHead className="whitespace-nowrap font-semibold text-ink text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((cust) => (
              <TableRow key={cust.id} className="hover:bg-ink/5 transition-colors">
                <TableCell className="font-medium text-sm whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => router.push(`/customers/${cust.id}`)}
                    className="text-left hover:underline focus:underline text-ink"
                  >
                    {cust.name}
                  </button>
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap text-ink/60">
                  {cust.phone ?? <span className="text-ink/40">-</span>}
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap text-ink/60">
                  {cust.email ?? <span className="text-ink/40">-</span>}
                </TableCell>
                    <TableCell className="text-sm text-ink/60 whitespace-nowrap">
                      {formatCustomerDate(cust.created_at)}
                    </TableCell>
                    <TableCell className="text-sm text-ink/60 whitespace-nowrap">
                      {formatCustomerDate(cust.updated_at)}
                    </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/customers/${cust.id}`)}
                      aria-label={`View ${cust.name}`}
                      className="text-ink hover:bg-ink/5"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {isOwner && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/customers/${cust.id}/edit`)}
                          aria-label={`Edit ${cust.name}`}
                          className="text-ink hover:bg-ink/5"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
