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
  summary?: any;
}

export type BusinessLifecycleStatus = 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'TERMINATED';

export interface BusinessListSummary {
  pending_count: number;
  active_count: number;
  suspended_count: number;
  rejected_count: number;
  total: number;
  [key: string]: unknown;
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

export interface PlanPricing {
  base_price: number;
  discount?: number;
  tax?: number;
  final_price: number;
  currency?: string;
}

export interface PlanLimits {
  max_branches?: number;
  max_users?: number;
  [key: string]: unknown;
}

export interface PlanModuleAssignment {
  code: string;
  name: string;
  pillar?: string | null;
  category?: string | null;
  is_core?: boolean;
  feature_overrides?: Record<string, any>;
}

export interface PlatformPlan {
  code: string;
  name: string;
  family: string | null;
  tier: string | null;
  billing_cycle: string | null;
  pricing: PlanPricing;
  type: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'DEPRECATED';
  limits: PlanLimits;
  trial_days: number;
  is_published: boolean;
  display_order: number;
  version: number;
  module_count?: number;
  modules?: PlanModuleAssignment[];
  showcase_items?: PlatformShowcaseItem[];
  created_at: string;
  updated_at: string;
}

export interface PlanListSummary {
  total: number;
  active_count: number;
  draft_count: number;
  deprecated_count: number;
  [key: string]: unknown;
}

export interface PlatformPlansResponse extends PlatformPaginated<PlatformPlan> {
  summary?: PlanListSummary;
}

export interface BundlePricing {
  one_time: number;
  monthly: number;
  commitment_months: number;
}

export interface BundleItem {
  id?: number;
  bundle_code?: string;
  item_type: 'PLAN' | 'PRODUCT' | 'SERVICE' | 'HARDWARE';
  item_code: string;
  quantity: number;
  required: boolean;
}

export interface PlatformBundle {
  code: string;
  name: string;
  pricing: BundlePricing;
  target_segment: string | null;
  installation_required: boolean;
  installation_service_code?: string | null;
  presentation_metadata?: Record<string, unknown>;
  status: 'DRAFT' | 'ACTIVE' | 'DEPRECATED';
  is_published: boolean;
  display_order: number;
  version: number;
  item_count?: number;
  items?: BundleItem[];
  showcase_items?: PlatformShowcaseItem[];
  created_at: string;
  updated_at: string;
}

export interface BundleListSummary {
  total: number;
  active_count: number;
  draft_count: number;
  deprecated_count: number;
  [key: string]: unknown;
}

export interface PlatformBundlesResponse extends PlatformPaginated<PlatformBundle> {
  summary?: BundleListSummary;
}

export interface PlatformShowcaseItem {
  id: string;
  section: 'HERO_FEATURED' | 'ERP_PLANS' | 'ISP_PLANS' | 'BUNDLES' | 'HARDWARE' | 'PROMOS';
  item_type: 'PLAN' | 'BUNDLE' | 'CATALOG_PRODUCT' | 'CUSTOM';
  plan_code?: string | null;
  bundle_code?: string | null;
  catalog_product_code?: string | null;
  custom_item_code?: string | null;
  display_name: string;
  headline?: string | null;
  description?: string | null;
  marketing_badge?: string | null;
  features_list: string[];
  display_order: number;
  is_featured: boolean;
  is_published: boolean;
  cta_text: string;
  cta_url: string;
  version?: number;
  pricing?: Record<string, unknown> | null;
  target_details?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface PlatformShowcaseResponse extends PlatformPaginated<PlatformShowcaseItem> {}

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
  final_price: number;
  currency: string;
  created_at: string;
}

// ── Overview View-Model Types ────────────────────────────────────────────────
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

// ── Support Tickets (CS AI Escalation & Control Plane) ───────────────────────
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface PlatformSupportTicket {
  id: string;
  business_id: string;
  business_name?: string | null;
  conversation_id: string | null;
  service_code: string | null;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string | null;
  assignee_name?: string | null;
  assignee_email?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  sender_type: string;
  sender_user_id: string | null;
  content: string;
  created_at: string;
}

export interface PlatformSupportTicketDetail extends PlatformSupportTicket {
  conversation_messages: TicketMessage[];
}

export interface TicketListSummary {
  open_count: number;
  in_progress_count: number;
  resolved_count: number;
  closed_count: number;
  total: number;
  [key: string]: unknown;
}

export interface PlatformTicketAssignee {
  id: string;
  name: string;
  email: string;
}

export interface PlatformTicketsResponse extends PlatformPaginated<PlatformSupportTicket> {
  summary: TicketListSummary;
  assignees: PlatformTicketAssignee[];
}

// ── Audit Logs & Observability (SA-2.8 / Control Plane) ──────────────────────
export type AuditStatus = 'SUCCESS' | 'FAILURE';
export type AuditScope = 'platform' | 'tenant' | 'system';

export interface PlatformAuditLog {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_scope: AuditScope;
  actor_role: string | null;
  action: string;
  service_code: string | null;
  target_type: string;
  target_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  diff: Record<string, unknown> | null;
  request_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: AuditStatus;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditListSummary {
  total: number;
  success_count: number;
  failure_count: number;
  [key: string]: unknown;
}

export interface PlatformAuditLogsResponse extends PlatformPaginated<PlatformAuditLog> {
  summary?: AuditListSummary;
}

export interface EcosystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  environment: string;
  uptime_seconds: number;
  timestamp: string;
  database: {
    status: 'connected' | 'disconnected';
    latency_ms: number;
    pool: {
      total: number;
      idle: number;
      waiting: number;
    };
  };
  memory: {
    heap_used_mb: number;
    heap_total_mb: number;
    rss_mb: number;
  };
}

// ── Service Registry (SA-2.5 / Control Plane) ────────────────────────────────
export type ServiceLifecycleStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'DEPRECATED' | 'RETIRED';
export type ServiceType = 'INTERNAL' | 'EXTERNAL' | 'HYBRID';
export type ServiceDependencyType = 'REQUIRED' | 'OPTIONAL';

export interface ServiceDependency {
  depends_on_service_code: string;
  dependency_type: ServiceDependencyType;
}

export interface PlatformService {
  code: string;
  name: string;
  description: string | null;
  category: string;
  service_type: ServiceType;
  owner: string;
  lifecycle_status: ServiceLifecycleStatus;
  public_visibility: boolean;
  base_capability?: Record<string, unknown>;
  provisioning_capability?: Record<string, unknown>;
  support_capability?: Record<string, unknown>;
  dependencies?: ServiceDependency[];
  created_at: string;
  updated_at: string;
}

export interface ServiceListSummary {
  total: number;
  active_count: number;
  draft_count: number;
  deprecated_count: number;
  suspended_count: number;
  retired_count: number;
  [key: string]: unknown;
}

export interface PlatformServicesResponse extends PlatformPaginated<PlatformService> {
  summary?: ServiceListSummary;
}



