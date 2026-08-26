/**
 * Customer API client.
 *
 * Uses the shared `api` Axios instance exclusively.
 * JWT auth, token refresh, 401 handling, X-Request-Id forwarding
 * are all managed by the shared client — not duplicated here.
 */
import { api } from '@/lib/api';
import {
  Customer,
  CustomerListResponse,
  CustomerSummaryKPI,
  CustomerCreateInput,
  CustomerUpdateInput,
} from './types';

export async function getCustomers(
  businessId: string,
  limit: number = 20,
  offset: number = 0
): Promise<CustomerListResponse> {
  const response = await api.get<CustomerListResponse>('/v1/customers', {
    params: { business_id: businessId, limit, offset },
  });
  return response.data;
}

export async function getCustomersSummary(businessId: string): Promise<CustomerSummaryKPI> {
  const response = await api.get<CustomerSummaryKPI>('/v1/customers/summary', {
    params: { business_id: businessId },
  });
  return response.data;
}

export async function getCustomer(
  businessId: string,
  id: string
): Promise<Customer> {
  const response = await api.get<Customer>(`/v1/customers/${id}`, {
    params: { business_id: businessId },
  });
  return response.data;
}

export async function createCustomer(input: CustomerCreateInput): Promise<Customer> {
  const idempotencyKey = crypto.randomUUID();
  const response = await api.post<Customer>('/v1/customers', input, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
  return response.data;
}

export async function updateCustomer(
  id: string,
  input: CustomerUpdateInput
): Promise<Customer> {
  const response = await api.put<Customer>(`/v1/customers/${id}`, input);
  return response.data;
}

export async function deleteCustomer(id: string): Promise<void> {
  await api.delete(`/v1/customers/${id}`);
}
