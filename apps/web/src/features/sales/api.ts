/**
 * Sales API client.
 *
 * Uses the shared `api` Axios instance exclusively.
 * JWT auth, token refresh, 401 handling, X-Request-Id forwarding
 * are all managed by the shared client — not duplicated here.
 *
 * Web Sales is READ-ONLY. No create/update/delete.
 * Backend endpoint: GET /v1/sync/sales
 */
import { api } from '@/lib/api';
import { SalesListResponse } from './types';

export async function getSales(
  businessId: string,
  since: number = 0,
  limit: number = 500
): Promise<SalesListResponse> {
  const response = await api.get<SalesListResponse>('/v1/sync/sales', {
    params: {
      business_id: businessId,
      since,
      limit,
    },
  });
  return response.data;
}
