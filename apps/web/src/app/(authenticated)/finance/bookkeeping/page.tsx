'use client';

import { BookkeepingPage } from '@/features/finance/components/BookkeepingPage';
import { useAuth } from '@/features/auth/AuthContext';

export default function BookkeepingRoute() {
  const { business, role } = useAuth();

  if (!business) {
    return null;
  }

  return (
    <BookkeepingPage
      businessId={business.id}
      role={role === 'OWNER' ? 'OWNER' : 'CASHIER'}
    />
  );
}
