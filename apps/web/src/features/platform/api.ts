/**
 * Platform Control Plane API client.
 *
 * Implements endpoints for Platform Governance & Tenant Lifecycle:
 *   GET /v1/platform/context
 *   GET /v1/platform/businesses
 *   GET /v1/platform/businesses/:id
 *   POST /v1/platform/businesses/:id/approve
 *   POST /v1/platform/businesses/:id/reject
 *   POST /v1/platform/businesses/:id/suspend
 *   POST /v1/platform/businesses/:id/reactivate
 *   GET /v1/platform/modules
 *   GET /v1/platform/plans
 *   GET /v1/platform/bundles
 *   GET /v1/platform/subscriptions
 */
import { api } from '@/lib/api';
import {
  PlatformContext,
  PlatformPaginated,
  PlatformBusiness,
  PlatformBusinessesResponse,
  PlatformBusinessDetail,
  PlatformModule,
  PlatformPlan,
  PlatformBundle,
  PlatformSubscription,
  BusinessLifecycleStatus,
} from './types';

export type {
  PlatformBusinessesResponse,
  PlatformBusinessDetail,
  PlatformBusiness,
  BusinessLifecycleStatus,
};

/** Default page size for platform list endpoints (backend allows 1-200). */
export const PLATFORM_PAGE_SIZE = 20;

export async function getPlatformContext(): Promise<PlatformContext> {
  const res = await api.get<PlatformContext>('/v1/platform/context');
  return res.data;
}

export interface GetBusinessesParams {
  limit?: number;
  offset?: number;
  status?: BusinessLifecycleStatus | 'ALL';
  search?: string;
}

export async function getPlatformBusinesses(
  paramsOrLimit?: GetBusinessesParams | number,
  offsetArg?: number
): Promise<PlatformBusinessesResponse> {
  let limit = PLATFORM_PAGE_SIZE;
  let offset = 0;
  let status: BusinessLifecycleStatus | 'ALL' | undefined;
  let search: string | undefined;

  if (typeof paramsOrLimit === 'number') {
    limit = paramsOrLimit;
    offset = offsetArg ?? 0;
  } else if (paramsOrLimit && typeof paramsOrLimit === 'object') {
    limit = paramsOrLimit.limit ?? PLATFORM_PAGE_SIZE;
    offset = paramsOrLimit.offset ?? 0;
    status = paramsOrLimit.status;
    search = paramsOrLimit.search;
  }

  const res = await api.get<PlatformBusinessesResponse>('/v1/platform/businesses', {
    params: {
      limit,
      offset,
      status,
      search,
    },
  });
  return res.data;
}

export async function getPlatformBusinessById(id: string): Promise<PlatformBusinessDetail> {
  const res = await api.get<PlatformBusinessDetail>(`/v1/platform/businesses/${id}`);
  return res.data;
}

export async function approvePlatformBusiness(id: string): Promise<{ message: string; business: PlatformBusiness }> {
  const res = await api.post<{ message: string; business: PlatformBusiness }>(`/v1/platform/businesses/${id}/approve`);
  return res.data;
}

export async function rejectPlatformBusiness(
  id: string,
  reason: string
): Promise<{ message: string; business: PlatformBusiness }> {
  const res = await api.post<{ message: string; business: PlatformBusiness }>(`/v1/platform/businesses/${id}/reject`, {
    reason,
  });
  return res.data;
}

export async function suspendPlatformBusiness(
  id: string,
  reason: string
): Promise<{ message: string; business: PlatformBusiness }> {
  const res = await api.post<{ message: string; business: PlatformBusiness }>(`/v1/platform/businesses/${id}/suspend`, {
    reason,
  });
  return res.data;
}

export async function reactivatePlatformBusiness(
  id: string
): Promise<{ message: string; business: PlatformBusiness }> {
  const res = await api.post<{ message: string; business: PlatformBusiness }>(`/v1/platform/businesses/${id}/reactivate`);
  return res.data;
}

export async function getPlatformModules(
  limit: number = PLATFORM_PAGE_SIZE,
  offset: number = 0
): Promise<PlatformPaginated<PlatformModule>> {
  const res = await api.get<PlatformPaginated<PlatformModule>>('/v1/platform/modules', {
    params: { limit, offset },
  });
  return res.data;
}

export async function getPlatformPlans(
  limit: number = PLATFORM_PAGE_SIZE,
  offset: number = 0
): Promise<PlatformPaginated<PlatformPlan>> {
  const res = await api.get<PlatformPaginated<PlatformPlan>>('/v1/platform/plans', {
    params: { limit, offset },
  });
  return res.data;
}

export async function getPlatformBundles(
  limit: number = PLATFORM_PAGE_SIZE,
  offset: number = 0
): Promise<PlatformPaginated<PlatformBundle>> {
  const res = await api.get<PlatformPaginated<PlatformBundle>>('/v1/platform/bundles', {
    params: { limit, offset },
  });
  return res.data;
}

export async function getPlatformSubscriptions(
  limit: number = PLATFORM_PAGE_SIZE,
  offset: number = 0
): Promise<PlatformPaginated<PlatformSubscription>> {
  const res = await api.get<PlatformPaginated<PlatformSubscription>>('/v1/platform/subscriptions', {
    params: { limit, offset },
  });
  return res.data;
}
