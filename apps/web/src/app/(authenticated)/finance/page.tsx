'use client';

import { FinanceOverviewPage } from '@/features/finance/components/FinanceOverviewPage';
import { useAuth } from '@/features/auth/AuthContext';

export default function FinanceOverviewRoute() {
  const { business, role } = useAuth();

  if (!business) {
    return null;
  }

  return (
    <FinanceOverviewPage
      businessId={business.id}
      role={role === 'OWNER' ? 'OWNER' : 'CASHIER'}
    />
  );
}
