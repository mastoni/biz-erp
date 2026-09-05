import { api } from '@/lib/api';
import axios from 'axios';
import {
  CustomerSubscriptionDto,
  CustomerSubscriptionDetailDto,
  CustomerSubscriptionListResponse,
  CreateCustomerSubscriptionPayload,
  UpdateCustomerSubscriptionPayload,
  SubscriptionActionPayload,
  GenerateInvoicePayload,
  CustomerSubscriptionFilterModel,
  CustomerInvoiceDto,
  CustomerInvoiceDetailDto,
  CustomerInvoiceListResponse,
  RecordInvoicePaymentPayload,
  CancelInvoicePayload,
  CustomerInvoiceFilterModel,
  BillingDashboardKPI,
} from './types';

export function getBillingApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error) || (error && typeof error === 'object' && (error as { isAxiosError?: boolean }).isAxiosError)) {
    const errObj = error as { response?: { status?: number; data?: { message?: string; code?: string; error?: { message?: string; code?: string } } }; message?: string };
    const data = errObj.response?.data;
    const message = data?.message || data?.error?.message;
    const code = data?.code || data?.error?.code;

    if (errObj.response?.status === 403) {
      if (message?.includes('financial pricing')) {
        return 'Akses ditolak: Hanya pemilik (OWNER) yang berhak mengubah nominal harga atau siklus tagihan.';
      }
      if (message?.includes('cancel')) {
        return 'Akses ditolak: Hanya pemilik (OWNER) yang berhak membatalkan langganan atau tagihan.';
      }
      return message || 'Akses ditolak: Anda tidak memiliki izin untuk tindakan ini.';
    }

    if (errObj.response?.status === 409) {
      if (code === 'PAYMENT_EXISTS' || message?.includes('payment')) {
        return 'Tagihan tidak dapat dibatalkan karena sudah memiliki riwayat pembayaran yang tercatat.';
      }
      if (code === 'INVALID_STATE' || message?.includes('status')) {
        return message || 'Tindakan tidak valid untuk status langganan atau tagihan saat ini.';
      }
      return message || 'Terjadi konflik data atau operasi duplikat.';
    }

    if (errObj.response?.status === 404) {
      return 'Data langganan atau tagihan tidak ditemukan dalam konteks bisnis Anda.';
    }

    if (errObj.response?.status === 400) {
      return message || 'Format data tidak valid. Periksa kembali isian form Anda.';
    }

    return message || errObj.message || 'Terjadi kesalahan sistem';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Terjadi kesalahan sistem yang tidak diketahui';
}

// =========================================================================
// CUSTOMER SUBSCRIPTION API CALLS
// =========================================================================

export async function getCustomerSubscriptions(
  filters: CustomerSubscriptionFilterModel = {}
): Promise<CustomerSubscriptionListResponse> {
  const response = await api.get<CustomerSubscriptionListResponse>('/v1/customer-subscriptions', {
    params: {
      ...(filters.customer_id ? { customer_id: filters.customer_id } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.billing_cycle ? { billing_cycle: filters.billing_cycle } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.limit !== undefined ? { limit: filters.limit } : {}),
      ...(filters.offset !== undefined ? { offset: filters.offset } : {}),
    },
  });
  return response.data;
}

export async function getCustomerSubscription(id: string): Promise<CustomerSubscriptionDetailDto> {
  const response = await api.get<CustomerSubscriptionDetailDto>(`/v1/customer-subscriptions/${id}`);
  return response.data;
}

export async function createCustomerSubscription(
  payload: CreateCustomerSubscriptionPayload
): Promise<CustomerSubscriptionDto> {
  const response = await api.post<CustomerSubscriptionDto>('/v1/customer-subscriptions', payload);
  return response.data;
}

export async function updateCustomerSubscription(
  id: string,
  payload: UpdateCustomerSubscriptionPayload
): Promise<CustomerSubscriptionDto> {
  const response = await api.patch<CustomerSubscriptionDto>(`/v1/customer-subscriptions/${id}`, payload);
  return response.data;
}

export async function pauseCustomerSubscription(
  id: string,
  payload: SubscriptionActionPayload = {}
): Promise<CustomerSubscriptionDto> {
  const response = await api.post<CustomerSubscriptionDto>(`/v1/customer-subscriptions/${id}/pause`, payload);
  return response.data;
}

export async function resumeCustomerSubscription(
  id: string,
  payload: SubscriptionActionPayload = {}
): Promise<CustomerSubscriptionDto> {
  const response = await api.post<CustomerSubscriptionDto>(`/v1/customer-subscriptions/${id}/resume`, payload);
  return response.data;
}

export async function cancelCustomerSubscription(
  id: string,
  payload: SubscriptionActionPayload = {}
): Promise<CustomerSubscriptionDto> {
  const response = await api.post<CustomerSubscriptionDto>(`/v1/customer-subscriptions/${id}/cancel`, payload);
  return response.data;
}

export async function generateCustomerInvoice(
  subscriptionId: string,
  payload: GenerateInvoicePayload = {}
): Promise<CustomerInvoiceDto> {
  const response = await api.post<CustomerInvoiceDto>(
    `/v1/customer-subscriptions/${subscriptionId}/generate-invoice`,
    payload
  );
  return response.data;
}

// =========================================================================
// CUSTOMER INVOICE API CALLS
// =========================================================================

export async function getCustomerInvoices(
  filters: CustomerInvoiceFilterModel = {}
): Promise<CustomerInvoiceListResponse> {
  const response = await api.get<CustomerInvoiceListResponse>('/v1/customer-invoices', {
    params: {
      ...(filters.customer_id ? { customer_id: filters.customer_id } : {}),
      ...(filters.customer_subscription_id ? { customer_subscription_id: filters.customer_subscription_id } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.date_from ? { date_from: filters.date_from } : {}),
      ...(filters.date_to ? { date_to: filters.date_to } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.limit !== undefined ? { limit: filters.limit } : {}),
      ...(filters.offset !== undefined ? { offset: filters.offset } : {}),
    },
  });
  return response.data;
}

export async function getCustomerInvoice(id: string): Promise<CustomerInvoiceDetailDto> {
  const response = await api.get<CustomerInvoiceDetailDto>(`/v1/customer-invoices/${id}`);
  return response.data;
}

export async function recordCustomerInvoicePayment(
  invoiceId: string,
  payload: RecordInvoicePaymentPayload
): Promise<CustomerInvoiceDto> {
  const response = await api.post<CustomerInvoiceDto>(`/v1/customer-invoices/${invoiceId}/payments`, payload);
  return response.data;
}

export async function cancelCustomerInvoice(
  invoiceId: string,
  payload: CancelInvoicePayload = {}
): Promise<CustomerInvoiceDto> {
  const response = await api.post<CustomerInvoiceDto>(`/v1/customer-invoices/${invoiceId}/cancel`, payload);
  return response.data;
}

// =========================================================================
// DASHBOARD KPI COMPUTATION
// =========================================================================

export async function getBillingDashboardKPI(): Promise<BillingDashboardKPI> {
  // Fetch subscriptions and invoices in parallel
  const [subRes, invRes] = await Promise.all([
    getCustomerSubscriptions({ limit: 500 }),
    getCustomerInvoices({ limit: 500 }),
  ]);

  const subscriptions = subRes.items || [];
  const invoices = invRes.items || [];

  const activeSubscriptions = subscriptions.filter((s) => s.status === 'ACTIVE');
  const pausedSubscriptions = subscriptions.filter((s) => s.status === 'PAUSED');

  // Compute MRR from active subscriptions
  const monthlyRecurringRevenueMinor = activeSubscriptions.reduce((sum, s) => {
    let monthlyAmount = s.total_minor;
    if (s.billing_cycle === 'QUARTERLY') monthlyAmount = Math.round(s.total_minor / 3);
    else if (s.billing_cycle === 'SEMI_ANNUAL') monthlyAmount = Math.round(s.total_minor / 6);
    else if (s.billing_cycle === 'ANNUAL') monthlyAmount = Math.round(s.total_minor / 12);
    return sum + monthlyAmount;
  }, 0);

  // Upcoming billing (next 7 days)
  const now = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(now.getDate() + 7);
  const nowStr = now.toISOString().slice(0, 10);
  const nextWeekStr = nextWeek.toISOString().slice(0, 10);

  const upcomingSubs = activeSubscriptions.filter(
    (s) => s.next_billing_date >= nowStr && s.next_billing_date <= nextWeekStr
  );
  const upcomingBillingCount = upcomingSubs.length;
  const upcomingBillingAmountMinor = upcomingSubs.reduce((sum, s) => sum + s.total_minor, 0);

  // Overdue Invoices
  const overdueInvoices = invoices.filter((i) => i.status === 'OVERDUE');
  const overdueInvoicesCount = overdueInvoices.length;
  const overdueInvoicesAmountMinor = overdueInvoices.reduce(
    (sum, i) => sum + (i.outstanding_minor ?? i.total_minor),
    0
  );

  // Outstanding Receivables (ISSUED + OVERDUE)
  const unpaidInvoices = invoices.filter((i) => i.status === 'ISSUED' || i.status === 'OVERDUE');
  const totalOutstandingReceivablesMinor = unpaidInvoices.reduce(
    (sum, i) => sum + (i.outstanding_minor ?? i.total_minor),
    0
  );

  // Paid this month
  const currentYearMonth = now.toISOString().slice(0, 7);
  const paidInvoicesThisMonth = invoices.filter(
    (i) => i.status === 'PAID' && i.paid_at && i.paid_at.startsWith(currentYearMonth)
  );
  const totalPaidThisMonthMinor = paidInvoicesThisMonth.reduce(
    (sum, i) => sum + (i.paid_minor ?? i.total_minor),
    0
  );

  return {
    activeSubscriptionsCount: activeSubscriptions.length,
    pausedSubscriptionsCount: pausedSubscriptions.length,
    totalSubscriptionsCount: subscriptions.length,
    monthlyRecurringRevenueMinor,
    upcomingBillingCount,
    upcomingBillingAmountMinor,
    overdueInvoicesCount,
    overdueInvoicesAmountMinor,
    totalOutstandingReceivablesMinor,
    totalPaidThisMonthMinor,
  };
}
