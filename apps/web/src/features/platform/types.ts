export interface PlatformContext {
  scope: 'platform';
  role: 'PLATFORM_ADMIN' | 'SUPER_ADMIN';
  userId: string;
  businessId: null;
}

export interface PlatformPaginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export type BusinessLifecycleStatus = 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'TERMINATED';

export interface BusinessListSummary {
  pending_count: number;
  active_count: number;
  suspended_count: number;
  rejected_count: number;
  total: number;
}

export interface PlatformBusiness {
  id: string;
  name: string;
  status: BusinessLifecycleStatus;
  owner_user_id?: string | null;
  owner_email?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  rejected_reason?: string | null;
  rejected_at?: string | null;
  suspended_reason?: string | null;
  suspended_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformBusinessesResponse extends PlatformPaginated<PlatformBusiness> {
  summary: BusinessListSummary;
}

export interface PlatformBusinessDetail extends PlatformBusiness {
  owner_name?: string | null;
  approver_email?: string | null;
  rejector_email?: string | null;
  suspender_email?: string | null;
  reactivated_at?: string | null;
  reactivated_by?: string | null;
  reactivator_email?: string | null;
  branch_count: number;
  active_subscription_count: number;
  user_count: number;
}

export interface PlatformModule {
  code: string;
  name: string;
  pillar: string | null;
  category: string | null;
  is_core: boolean;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformPlan {
  code: string;
  name: string;
  family: string | null;
  tier: string | null;
  billing_cycle: string | null;
  type: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformBundle {
  code: string;
  name: string;
  target_segment: string | null;
  installation_required: boolean;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformSubscription {
  id: string;
  business_id: string;
  account_customer_id: string | null;
  plan_code: string;
  plan_family: string | null;
  family_code: string | null;
  source: string | null;
  status: string | null;
  starts_at: string | null;
  ends_at: string | null;
  billing_cycle: string | null;
  final_price: number | null;
  currency: string | null;
  created_at: string;
}

export interface PlatformOverviewKPIs {
  total_businesses: number;
  active_subscriptions: number;
  estimated_mrr_minor: number;
  total_plans: number;
  total_modules: number;
}

export interface PlanDistributionItem {
  plan_code: string;
  plan_name: string;
  count: number;
  color: string;
}

export interface SubscriptionStatusDistributionItem {
  status: string;
  label: string;
  count: number;
  tone: 'pine' | 'tide' | 'clay' | 'fog';
}

export interface PlatformOverviewState {
  context: PlatformContext | null;
  kpis: PlatformOverviewKPIs;
  planDistribution: PlanDistributionItem[];
  statusDistribution: SubscriptionStatusDistributionItem[];
  recentBusinesses: PlatformBusiness[];
  recentSubscriptions: PlatformSubscription[];
  loading: boolean;
  error: string | null;
  requestId: string | null;
  refresh: () => Promise<void>;
}
