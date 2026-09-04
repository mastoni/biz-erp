/**
 * Platform Control Plane API client.
 *
 * Implements endpoints for Platform Governance, Commercial Plans, Bundles, and Showcase:
 *   - /v1/platform/context
 *   - /v1/platform/businesses
 *   - /v1/platform/plans
 *   - /v1/platform/bundles
 *   - /v1/platform/showcase
 *   - /v1/platform/modules
 *   - /v1/platform/subscriptions
 *   - /v1/public/showcase
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
  PlatformPlansResponse,
  PlatformBundle,
  PlatformBundlesResponse,
  PlatformShowcaseItem,
  PlatformShowcaseResponse,
  PlatformSubscription,
  PlatformInvoice,
  PlatformInvoiceStatus,
  PlatformPayment,
  PlatformPaymentMethod,
  GatewayTransactionResult,
  InvoiceListSummary,
  PlatformInvoicesResponse,
  BusinessLifecycleStatus,
  PlatformSupportTicket,
  PlatformSupportTicketDetail,
  PlatformTicketsResponse,
  PlatformTicketAssignee,
  TicketStatus,
  TicketPriority,
  TicketListSummary,
  PlatformAuditLog,
  PlatformAuditLogsResponse,
  AuditStatus,
  AuditScope,
  AuditListSummary,
  EcosystemHealth,
  PlatformService,
  PlatformServicesResponse,
  ServiceLifecycleStatus,
  ServiceType,
  ServiceDependency,
  ServiceDependencyType,
  ServiceListSummary,
} from './types';

export type {
  PlatformPaginated,
  PlatformBusinessesResponse,
  PlatformBusinessDetail,
  PlatformBusiness,
  BusinessLifecycleStatus,
  PlatformPlan,
  PlatformPlansResponse,
  PlatformBundle,
  PlatformSubscription,
  PlatformInvoice,
  PlatformInvoiceStatus,
  PlatformPayment,
  PlatformPaymentMethod,
  GatewayTransactionResult,
  InvoiceListSummary,
  PlatformInvoicesResponse,
  PlatformSupportTicket,
  PlatformSupportTicketDetail,
  PlatformTicketsResponse,
  PlatformTicketAssignee,
  TicketStatus,
  TicketPriority,
  TicketListSummary,
  PlatformAuditLog,
  PlatformAuditLogsResponse,
  AuditStatus,
  AuditScope,
  AuditListSummary,
  EcosystemHealth,
  PlatformService,
  PlatformServicesResponse,
  ServiceLifecycleStatus,
  ServiceType,
  ServiceDependency,
  ServiceDependencyType,
  ServiceListSummary,
};

export const PLATFORM_PAGE_SIZE = 20;

export async function getPlatformContext(): Promise<PlatformContext> {
  const res = await api.get<PlatformContext>('/v1/platform/context');
  return res.data;
}

// =============================================================================
// 1. BUSINESSES LIFECYCLE (SA-1)
// =============================================================================
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
    params: { limit, offset, status, search },
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

export async function reactivatePlatformBusiness(id: string): Promise<{ message: string; business: PlatformBusiness }> {
  const res = await api.post<{ message: string; business: PlatformBusiness }>(`/v1/platform/businesses/${id}/reactivate`);
  return res.data;
}

// =============================================================================
// 2. PLANS & PRICING (SA-2)
// =============================================================================
export interface GetPlansParams {
  limit?: number;
  offset?: number;
  status?: 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'ALL';
  family?: string;
  search?: string;
}

export async function getPlatformPlans(
  paramsOrLimit?: GetPlansParams | number,
  offsetArg?: number
): Promise<PlatformPlansResponse> {
  let limit = PLATFORM_PAGE_SIZE;
  let offset = 0;
  let status: 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'ALL' | undefined;
  let family: string | undefined;
  let search: string | undefined;

  if (typeof paramsOrLimit === 'number') {
    limit = paramsOrLimit;
    offset = offsetArg ?? 0;
  } else if (paramsOrLimit && typeof paramsOrLimit === 'object') {
    limit = paramsOrLimit.limit ?? PLATFORM_PAGE_SIZE;
    offset = paramsOrLimit.offset ?? 0;
    status = paramsOrLimit.status;
    family = paramsOrLimit.family;
    search = paramsOrLimit.search;
  }

  const res = await api.get<PlatformPlansResponse>('/v1/platform/plans', {
    params: {
      limit,
      offset,
      status,
      family,
      search,
    },
  });
  return res.data;
}

export async function getPlatformPlanByCode(code: string): Promise<PlatformPlan> {
  const res = await api.get<PlatformPlan>(`/v1/platform/plans/${code}`);
  return res.data;
}

export async function createPlatformPlan(payload: Partial<PlatformPlan>): Promise<{ message: string; plan: PlatformPlan }> {
  const res = await api.post<{ message: string; plan: PlatformPlan }>('/v1/platform/plans', payload);
  return res.data;
}

export async function updatePlatformPlan(
  code: string,
  payload: Partial<PlatformPlan> & { expected_version?: number }
): Promise<{ message: string; plan: PlatformPlan }> {
  const res = await api.put<{ message: string; plan: PlatformPlan }>(`/v1/platform/plans/${code}`, payload);
  return res.data;
}

export async function setPlatformPlanStatus(
  code: string,
  status: 'DRAFT' | 'ACTIVE' | 'DEPRECATED'
): Promise<{ message: string; plan: PlatformPlan }> {
  const res = await api.patch<{ message: string; plan: PlatformPlan }>(`/v1/platform/plans/${code}/status`, { status });
  return res.data;
}

export async function setPlatformPlanModules(
  code: string,
  modules: Array<{ module_code: string; feature_overrides?: Record<string, any> }>
): Promise<{ message: string; plan_code: string; module_count: number }> {
  const res = await api.put<{ message: string; plan_code: string; module_count: number }>(
    `/v1/platform/plans/${code}/modules`,
    { modules }
  );
  return res.data;
}

// =============================================================================
// 3. BUNDLE COMPOSER (SA-2)
// =============================================================================
export interface GetBundlesParams {
  limit?: number;
  offset?: number;
  status?: 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'ALL';
  search?: string;
}

export async function getPlatformBundles(
  paramsOrLimit?: GetBundlesParams | number,
  offsetArg?: number
): Promise<PlatformBundlesResponse> {
  let limit = PLATFORM_PAGE_SIZE;
  let offset = 0;
  let status: 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'ALL' | undefined;
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

  const res = await api.get<PlatformBundlesResponse>('/v1/platform/bundles', {
    params: {
      limit,
      offset,
      status,
      search,
    },
  });
  return res.data;
}

export async function getPlatformBundleByCode(code: string): Promise<PlatformBundle> {
  const res = await api.get<PlatformBundle>(`/v1/platform/bundles/${code}`);
  return res.data;
}

export async function createPlatformBundle(
  payload: Partial<PlatformBundle>
): Promise<{ message: string; bundle: PlatformBundle }> {
  const res = await api.post<{ message: string; bundle: PlatformBundle }>('/v1/platform/bundles', payload);
  return res.data;
}

export async function updatePlatformBundle(
  code: string,
  payload: Partial<PlatformBundle> & { expected_version?: number }
): Promise<{ message: string; bundle: PlatformBundle }> {
  const res = await api.put<{ message: string; bundle: PlatformBundle }>(`/v1/platform/bundles/${code}`, payload);
  return res.data;
}

export async function setPlatformBundleStatus(
  code: string,
  status: 'DRAFT' | 'ACTIVE' | 'DEPRECATED'
): Promise<{ message: string; bundle: PlatformBundle }> {
  const res = await api.patch<{ message: string; bundle: PlatformBundle }>(`/v1/platform/bundles/${code}/status`, {
    status,
  });
  return res.data;
}

export async function setPlatformBundleItems(
  code: string,
  items: Array<{ item_type: string; item_code: string; quantity: number; required?: boolean }>
): Promise<{ message: string; bundle_code: string; item_count: number }> {
  const res = await api.put<{ message: string; bundle_code: string; item_count: number }>(
    `/v1/platform/bundles/${code}/items`,
    { items }
  );
  return res.data;
}

// =============================================================================
// 4. SHOWCASE GOVERNANCE & PREVIEW (SA-2)
// =============================================================================
export interface GetShowcaseParams {
  section?: string;
  is_published?: boolean;
}

export async function getPlatformShowcase(params?: GetShowcaseParams): Promise<PlatformShowcaseResponse> {
  const res = await api.get<PlatformShowcaseResponse>('/v1/platform/showcase', {
    params: {
      section: params?.section,
      is_published: params?.is_published,
    },
  });
  return res.data;
}

export async function getPlatformShowcaseById(id: string): Promise<PlatformShowcaseItem> {
  const res = await api.get<PlatformShowcaseItem>(`/v1/platform/showcase/${id}`);
  return res.data;
}

export async function createPlatformShowcaseItem(
  payload: Partial<PlatformShowcaseItem>
): Promise<{ message: string; item: PlatformShowcaseItem }> {
  const res = await api.post<{ message: string; item: PlatformShowcaseItem }>('/v1/platform/showcase', payload);
  return res.data;
}

export async function updatePlatformShowcaseItem(
  id: string,
  payload: Partial<PlatformShowcaseItem> & { expected_version?: number }
): Promise<{ message: string; item: PlatformShowcaseItem }> {
  const res = await api.put<{ message: string; item: PlatformShowcaseItem }>(`/v1/platform/showcase/${id}`, payload);
  return res.data;
}

export async function setPlatformShowcasePublish(
  id: string,
  is_published: boolean
): Promise<{ message: string; item: PlatformShowcaseItem }> {
  const res = await api.patch<{ message: string; item: PlatformShowcaseItem }>(`/v1/platform/showcase/${id}/publish`, {
    is_published,
  });
  return res.data;
}

export async function deletePlatformShowcaseItem(id: string): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/v1/platform/showcase/${id}`);
  return res.data;
}

export async function getPublicShowcase(section?: string): Promise<{ items: PlatformShowcaseItem[] }> {
  const res = await api.get<{ items: PlatformShowcaseItem[] }>('/v1/public/showcase', {
    params: { section },
  });
  return res.data;
}

// =============================================================================
// 5. MODULES & SUBSCRIPTIONS
// =============================================================================
export async function getPlatformModules(limit = PLATFORM_PAGE_SIZE, offset = 0): Promise<PlatformPaginated<PlatformModule>> {
  const res = await api.get<PlatformPaginated<PlatformModule>>('/v1/platform/modules', {
    params: { limit, offset },
  });
  return res.data;
}

export interface GetSubscriptionsParams {
  limit?: number;
  offset?: number;
  status?: string;
  plan_code?: string;
  business_id?: string;
  search?: string;
}

export async function getPlatformSubscriptions(
  paramsOrLimit?: GetSubscriptionsParams | number,
  offsetArg?: number
): Promise<PlatformPaginated<PlatformSubscription>> {
  let limit = PLATFORM_PAGE_SIZE;
  let offset = 0;
  let status: string | undefined;
  let plan_code: string | undefined;
  let business_id: string | undefined;
  let search: string | undefined;

  if (typeof paramsOrLimit === 'number') {
    limit = paramsOrLimit;
    offset = offsetArg ?? 0;
  } else if (paramsOrLimit && typeof paramsOrLimit === 'object') {
    limit = paramsOrLimit.limit ?? PLATFORM_PAGE_SIZE;
    offset = paramsOrLimit.offset ?? 0;
    status = paramsOrLimit.status;
    plan_code = paramsOrLimit.plan_code;
    business_id = paramsOrLimit.business_id;
    search = paramsOrLimit.search;
  }

  const res = await api.get<PlatformPaginated<PlatformSubscription>>('/v1/platform/subscriptions', {
    params: { limit, offset, status, plan_code, business_id, search },
  });
  return res.data;
}

// =============================================================================
// 5B. PLATFORM BILLING & INVOICES (PHASE PLATFORM BILLING LIFECYCLE)
// =============================================================================
export interface GetInvoicesParams {
  limit?: number;
  offset?: number;
  status?: PlatformInvoiceStatus | 'ALL';
  business_id?: string;
  subscription_id?: string;
  search?: string;
}

export async function getPlatformInvoices(
  params?: GetInvoicesParams
): Promise<PlatformInvoicesResponse> {
  const res = await api.get<PlatformInvoicesResponse>('/v1/platform/invoices', {
    params: {
      limit: params?.limit ?? PLATFORM_PAGE_SIZE,
      offset: params?.offset ?? 0,
      status: params?.status === 'ALL' ? undefined : params?.status,
      business_id: params?.business_id?.trim() || undefined,
      subscription_id: params?.subscription_id?.trim() || undefined,
      search: params?.search?.trim() || undefined,
    },
  });
  return res.data;
}

export async function getPlatformInvoiceById(id: string): Promise<PlatformInvoice> {
  const res = await api.get<PlatformInvoice>(`/v1/platform/invoices/${id}`);
  return res.data;
}

export async function generatePlatformInvoice(payload: {
  subscription_id: string;
  billing_period_start?: string;
  billing_period_end?: string;
  due_date?: string;
  notes?: string;
}): Promise<{ message: string; invoice: PlatformInvoice; is_new: boolean }> {
  const res = await api.post<{ message: string; invoice: PlatformInvoice; is_new: boolean }>(
    '/v1/platform/invoices/generate',
    payload
  );
  return res.data;
}

export async function recordPlatformPayment(
  invoiceId: string,
  payload: {
    amount?: number;
    payment_method: PlatformPaymentMethod;
    payment_reference?: string;
    notes?: string;
  }
): Promise<{ message: string; payment: PlatformPayment; invoice: PlatformInvoice; subscription_status: string }> {
  const res = await api.post<{
    message: string;
    payment: PlatformPayment;
    invoice: PlatformInvoice;
    subscription_status: string;
  }>(`/v1/platform/invoices/${invoiceId}/payments`, payload);
  return res.data;
}

export async function createPlatformInvoicePaymentToken(
  invoiceId: string
): Promise<{ message: string; transaction: GatewayTransactionResult }> {
  const res = await api.post<{ message: string; transaction: GatewayTransactionResult }>(
    `/v1/platform/invoices/${invoiceId}/payment-token`
  );
  return res.data;
}

// =============================================================================
// 6. SUPPORT TICKETS (CS AI CONTROL PLANE)
// =============================================================================
export interface GetTicketsParams {
  limit?: number;
  offset?: number;
  status?: TicketStatus | 'ALL';
  priority?: TicketPriority | 'ALL';
  search?: string;
}

export async function getPlatformTickets(
  params?: GetTicketsParams
): Promise<PlatformTicketsResponse> {
  const res = await api.get<PlatformTicketsResponse>('/v1/platform/tickets', {
    params: {
      limit: params?.limit ?? PLATFORM_PAGE_SIZE,
      offset: params?.offset ?? 0,
      status: params?.status === 'ALL' ? undefined : params?.status,
      priority: params?.priority === 'ALL' ? undefined : params?.priority,
      search: params?.search?.trim() || undefined,
    },
  });
  return res.data;
}

export async function getPlatformTicketById(id: string): Promise<PlatformSupportTicketDetail> {
  const res = await api.get<PlatformSupportTicketDetail>(`/v1/platform/tickets/${id}`);
  return res.data;
}

export async function updatePlatformTicketStatus(
  id: string,
  payload: {
    status: TicketStatus;
    assigned_to?: string | null;
  }
): Promise<{ message: string; ticket: PlatformSupportTicket }> {
  const res = await api.patch<{ message: string; ticket: PlatformSupportTicket }>(
    `/v1/platform/tickets/${id}/status`,
    payload
  );
  return res.data;
}

// =============================================================================
// 7. AUDIT LOGS & OBSERVABILITY (SA-2.8 / CONTROL PLANE)
// =============================================================================
export interface GetAuditLogsParams {
  limit?: number;
  offset?: number;
  status?: AuditStatus | 'ALL';
  actor_scope?: AuditScope | 'ALL';
  action?: string;
  service_code?: string;
  target_type?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
}

export async function getPlatformAuditLogs(
  params?: GetAuditLogsParams
): Promise<PlatformAuditLogsResponse> {
  const res = await api.get<PlatformAuditLogsResponse>('/v1/platform/audit-logs', {
    params: {
      limit: params?.limit ?? PLATFORM_PAGE_SIZE,
      offset: params?.offset ?? 0,
      status: params?.status === 'ALL' ? undefined : params?.status,
      actor_scope: params?.actor_scope === 'ALL' ? undefined : params?.actor_scope,
      action: params?.action?.trim() || undefined,
      service_code: params?.service_code?.trim() || undefined,
      target_type: params?.target_type?.trim() || undefined,
      from_date: params?.from_date?.trim() || undefined,
      to_date: params?.to_date?.trim() || undefined,
      search: params?.search?.trim() || undefined,
    },
  });
  return res.data;
}

export async function getPlatformAuditLogById(id: string): Promise<PlatformAuditLog> {
  const res = await api.get<PlatformAuditLog>(`/v1/platform/audit-logs/${id}`);
  return res.data;
}

export async function getPlatformHealth(): Promise<EcosystemHealth> {
  const res = await api.get<EcosystemHealth>('/v1/platform/observability/health');
  return res.data;
}

// =============================================================================
// 8. SERVICE REGISTRY (SA-2.5 / CONTROL PLANE)
// =============================================================================
export interface GetServicesParams {
  limit?: number;
  offset?: number;
  status?: ServiceLifecycleStatus | 'ALL';
  service_type?: ServiceType | 'ALL';
  category?: string;
  search?: string;
}

export async function getPlatformServices(
  params?: GetServicesParams
): Promise<PlatformServicesResponse> {
  const res = await api.get<PlatformServicesResponse>('/v1/platform/services', {
    params: {
      limit: params?.limit ?? PLATFORM_PAGE_SIZE,
      offset: params?.offset ?? 0,
      status: params?.status === 'ALL' ? undefined : params?.status,
      service_type: params?.service_type === 'ALL' ? undefined : params?.service_type,
      category: params?.category === 'ALL' ? undefined : params?.category,
      search: params?.search?.trim() || undefined,
    },
  });
  return res.data;
}

export async function getPlatformServiceByCode(code: string): Promise<PlatformService> {
  const res = await api.get<PlatformService>(`/v1/platform/services/${code}`);
  return res.data;
}

export async function createPlatformService(
  payload: Partial<PlatformService>
): Promise<{ message: string; service: PlatformService }> {
  const res = await api.post<{ message: string; service: PlatformService }>('/v1/platform/services', payload);
  return res.data;
}

export async function updatePlatformService(
  code: string,
  payload: Partial<PlatformService>
): Promise<{ message: string; service: PlatformService }> {
  const res = await api.patch<{ message: string; service: PlatformService }>(`/v1/platform/services/${code}`, payload);
  return res.data;
}



