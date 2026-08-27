'use client';

import { SuppliersPage } from '@/features/suppliers/components/SuppliersPage';
import { useAuth } from '@/features/auth/AuthContext';

export default function SuppliersRoute() {
  const { business, role } = useAuth();

  if (!business) {
    return null;
  }

  return (
    <SuppliersPage
      businessId={business.id}
      role={role === 'OWNER' ? 'OWNER' : 'CASHIER'}
    />
  );
}
