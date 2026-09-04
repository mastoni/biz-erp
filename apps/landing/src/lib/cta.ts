import { ERP_URL } from '../data'
import type { PublicShowcaseItem } from '../types'

/**
 * Resolve CTA URL contextually for showcase items:
 * - PLAN: https://erp.skmnetwork.com/register?plan=${item.item_code}
 * - BUNDLE: https://erp.skmnetwork.com/register?bundle=${item.item_code}
 * - CATALOG_PRODUCT / CUSTOM: #kontak
 *
 * Overrides known broken relative registration targets ('/register', etc.)
 * Preserves valid explicit external URLs and valid explicit anchor targets.
 */
export function resolveShowcaseCtaUrl(item: PublicShowcaseItem): string {
  const rawUrl = item.cta_url?.trim()

  // If explicit URL is provided that is NOT the broken relative landing registration
  if (
    rawUrl &&
    rawUrl !== '/register' &&
    rawUrl !== '/register/' &&
    rawUrl !== 'https://skmnetwork.com/register' &&
    rawUrl !== 'https://www.skmnetwork.com/register'
  ) {
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('#')) {
      return rawUrl
    }
  }

  if (item.item_type === 'PLAN') {
    return item.item_code
      ? `${ERP_URL}/register?plan=${encodeURIComponent(item.item_code)}`
      : `${ERP_URL}/register`
  }

  if (item.item_type === 'BUNDLE') {
    return item.item_code
      ? `${ERP_URL}/register?bundle=${encodeURIComponent(item.item_code)}`
      : `${ERP_URL}/register`
  }

  if (item.item_type === 'CATALOG_PRODUCT' || item.item_type === 'CUSTOM') {
    return '#kontak'
  }

  return `${ERP_URL}/register`
}
