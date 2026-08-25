'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';

export default function NewProductPage() {
  const router = useRouter();
  const { isOwner, status } = useAuth();

  useEffect(() => {
    if (status === 'authenticated' && isOwner()) {
      router.replace('/products?new=1', { scroll: false });
    }
  }, [status, isOwner, router]);

  return null;
}
