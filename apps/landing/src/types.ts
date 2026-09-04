// ============================================================================
// Public Commercial Showcase DTO Types (Landing Page Consumer)
// Corresponds to backend GET /v1/public/showcase
// ============================================================================

export type ShowcaseSection =
  | 'HERO_FEATURED'
  | 'ERP_PLANS'
  | 'ISP_PLANS'
  | 'BUNDLES'
  | 'HARDWARE'
  | 'PROMOS'

export type ShowcaseItemType = 'PLAN' | 'BUNDLE' | 'CATALOG_PRODUCT' | 'CUSTOM'

export interface PlanPricingDTO {
  base_price: number
  discount_amount: number
  tax_amount: number
  final_price: number
  currency: string
}

export interface BundlePricingDTO {
  one_time_price: number
  monthly_price: number
  commitment_months: number
  currency: string
}

export interface CatalogProductPricingDTO {
  base_price: number
  billing_model: string
  currency: string
}

export type ShowcasePricing =
  | PlanPricingDTO
  | BundlePricingDTO
  | CatalogProductPricingDTO
  | Record<string, unknown>
  | null

export interface ShowcaseTargetDetails {
  family?: string
  billing_cycle?: string
  [key: string]: unknown
}

export interface PublicShowcaseItem {
  id: string
  section: ShowcaseSection
  item_type: ShowcaseItemType
  item_code: string
  display_name: string
  headline: string
  description: string
  marketing_badge: string | null
  features_list: string[]
  display_order: number
  is_featured: boolean
  cta_text: string
  cta_url: string
  pricing: ShowcasePricing
  target_details?: ShowcaseTargetDetails | null
}

export interface PublicShowcaseResponse {
  items: PublicShowcaseItem[]
}
