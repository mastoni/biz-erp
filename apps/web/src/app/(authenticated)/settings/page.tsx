'use client';

import { useAuth } from '@/features/auth/AuthContext';
import { useBranchContext } from '@/features/branches/BranchContext';
import { SettingsView } from '@/features/settings/components/SettingsView';

export default function SettingsPage() {
  const { business, role } = useAuth();
  const { activeBranch } = useBranchContext();

  return (
    <SettingsView
      businessId={business?.id}
      branchId={activeBranch?.id}
      role={role}
    />
  );
}
