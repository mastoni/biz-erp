'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;
  const { isOwner, status } = useAuth();

  useEffect(() => {
    if (status === 'authenticated' && isOwner() && productId) {
      router.replace(`/products?edit=${productId}`, { scroll: false });
    }
  }, [status, isOwner, productId, router]);

  return null;
}
