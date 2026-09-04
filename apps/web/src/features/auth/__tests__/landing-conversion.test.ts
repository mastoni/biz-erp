import { describe, expect, it } from 'vitest'

// Landing CTA resolution logic verification
describe('Landing to ERP Conversion Flow - Unit & Regression Tests', () => {
  const ERP_URL = 'https://erp.skmnetwork.com'

  function resolveShowcaseCtaUrl(item: {
    item_type: 'PLAN' | 'BUNDLE' | 'CATALOG_PRODUCT' | 'CUSTOM'
    item_code?: string
    cta_url?: string
  }): string {
    const rawUrl = item.cta_url?.trim()

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

  it('resolves PLAN item to erp.skmnetwork.com/register?plan=...', () => {
    const url = resolveShowcaseCtaUrl({
      item_type: 'PLAN',
      item_code: 'ERP_BASIC_MONTHLY',
      cta_url: '/register' // broken default from superadmin
    })

    expect(url).toBe('https://erp.skmnetwork.com/register?plan=ERP_BASIC_MONTHLY')
  })

  it('resolves BUNDLE item to erp.skmnetwork.com/register?bundle=...', () => {
    const url = resolveShowcaseCtaUrl({
      item_type: 'BUNDLE',
      item_code: 'BUNDLE_RETAIL_STARTER',
      cta_url: '/register'
    })

    expect(url).toBe('https://erp.skmnetwork.com/register?bundle=BUNDLE_RETAIL_STARTER')
  })

  it('resolves CATALOG_PRODUCT and CUSTOM items to #kontak', () => {
    const productUrl = resolveShowcaseCtaUrl({
      item_type: 'CATALOG_PRODUCT',
      item_code: 'PROD_CCTV_CAM',
      cta_url: '/register'
    })
    expect(productUrl).toBe('#kontak')

    const customUrl = resolveShowcaseCtaUrl({
      item_type: 'CUSTOM',
      item_code: 'CUSTOM_REQ',
      cta_url: '/register'
    })
    expect(customUrl).toBe('#kontak')
  })

  it('preserves valid explicit external URLs and explicit non-register anchors', () => {
    const externalUrl = resolveShowcaseCtaUrl({
      item_type: 'PLAN',
      item_code: 'ERP_PRO',
      cta_url: 'https://wa.me/628123456789'
    })
    expect(externalUrl).toBe('https://wa.me/628123456789')

    const anchorUrl = resolveShowcaseCtaUrl({
      item_type: 'PLAN',
      item_code: 'ERP_PRO',
      cta_url: '#custom-section'
    })
    expect(anchorUrl).toBe('#custom-section')
  })

  it('overrides landing-domain self-referencing /register', () => {
    const url = resolveShowcaseCtaUrl({
      item_type: 'PLAN',
      item_code: 'ERP_BASIC_MONTHLY',
      cta_url: 'https://skmnetwork.com/register'
    })
    expect(url).toBe('https://erp.skmnetwork.com/register?plan=ERP_BASIC_MONTHLY')
  })
})
