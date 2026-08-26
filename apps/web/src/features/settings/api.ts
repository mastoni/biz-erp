import { api } from '@/lib/api';
import { StoreSettings, StoreSettingsUpdatePayload } from './types';

export async function getStoreSettings(
  businessId: string,
  branchId?: string | null
): Promise<StoreSettings> {
  const params: Record<string, string> = { business_id: businessId };
  if (branchId && branchId.trim().length > 0) {
    params.branch_id = branchId.trim();
  }
  const response = await api.get<StoreSettings>('/v1/settings/store', { params });
  return response.data;
}

export async function updateStoreSettings(
  businessId: string,
  branchId: string | null | undefined,
  payload: StoreSettingsUpdatePayload
): Promise<StoreSettings> {
  const params: Record<string, string> = { business_id: businessId };
  if (branchId && branchId.trim().length > 0) {
    params.branch_id = branchId.trim();
  }
  const response = await api.put<StoreSettings>('/v1/settings/store', payload, { params });
  return response.data;
}
