'use client';

import { PurchasesPage } from '@/features/purchases/components/PurchasesPage';
import { useAuth } from '@/features/auth/AuthContext';

export default function PurchasesRoute() {
  const { business, role } = useAuth();

  if (!business) {
    return null;
  }

  return (
    <PurchasesPage
      businessId={business.id}
      role={role === 'OWNER' ? 'OWNER' : 'CASHIER'}
    />
  );
}
