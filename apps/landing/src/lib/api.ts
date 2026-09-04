import type { PublicShowcaseResponse, ShowcaseSection } from '../types'

// ============================================================================
// API Base URL Resolution
// Prioritizes VITE_API_URL environment injection with canonical production fallback.
// ============================================================================

export function getApiBaseUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_API_URL
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.replace(/\/+$/, '')
  }

  // Canonical production endpoint
  return 'https://api.skmnetwork.com'
}

// ============================================================================
// Public Commercial Showcase Client
// Unauthenticated, timeout-protected, safe failure handling
// ============================================================================

export interface FetchShowcaseOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

/**
 * Fetch public showcase items published by Platform Superadmin.
 * Strictly public/unauthenticated.
 */
export async function fetchPublicShowcase(
  section?: ShowcaseSection,
  options?: FetchShowcaseOptions
): Promise<PublicShowcaseResponse> {
  const baseUrl = getApiBaseUrl()
  const url = new URL(`${baseUrl}/v1/public/showcase`)
  if (section) {
    url.searchParams.set('section', section)
  }

  const timeoutMs = options?.timeoutMs ?? 8000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: options?.signal || controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.warn(`[PublicShowcase] HTTP ${response.status} from ${url.toString()}`)
      return { items: [] }
    }

    const data = await response.json()
    if (data && Array.isArray(data.items)) {
      return data as PublicShowcaseResponse
    }

    return { items: [] }
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error?.name === 'AbortError') {
      console.warn(`[PublicShowcase] Request timed out after ${timeoutMs}ms`)
    } else {
      console.warn('[PublicShowcase] Failed to fetch showcase items:', error?.message || error)
    }
    // Return empty items instead of crashing landing page
    return { items: [] }
  }
}
