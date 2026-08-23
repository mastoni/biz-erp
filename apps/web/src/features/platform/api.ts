/**
 * Platform Control Plane API client (read-only).
 *
 * Consumes ONLY the existing platform read endpoints implemented in 41B:
 *   GET /v1/platform/context
 *   GET /v1/platform/businesses
 *   GET /v1/platform/modules
 *   GET /v1/platform/plans
 *   GET /v1/platform/bundles
 *   GET /v1/platform/subscriptions
 *
 * No POST/PUT/PATCH/DELETE. No new endpoints. Uses the shared `api` Axios
 * instance so JWT auth, refresh, and X-Request-Id handling are reused.
 */
import { api } from '@/lib/api';
import {
  PlatformContext,
  PlatformPaginated,
  PlatformBusiness,
  PlatformModule,
  PlatformPlan,
  PlatformBundle,
  PlatformSubscription,
} from './types';

/** Default page size for platform list endpoints (backend allows 1-200). */
export const PLATFORM_PAGE_SIZE = 20;

export async function getPlatformContext(): Promise<PlatformContext> {
  const res = await api.get<PlatformContext>('/v1/platform/context');
  return res.data;
}

export async function getPlatformBusinesses(
  limit: number = PLATFORM_PAGE_SIZE,
  offset: number = 0
): Promise<PlatformPaginated<PlatformBusiness>> {
  const res = await api.get<PlatformPaginated<PlatformBusiness>>('/v1/platform/businesses', {
    params: { limit, offset },
  });
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
