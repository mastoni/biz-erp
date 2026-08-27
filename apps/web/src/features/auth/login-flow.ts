/**
 * Pure, dependency-free helpers for the multi-step login flow.
 *
 * Extracted from the login page component so the business-selection contract
 * can be unit-tested without React or a DOM environment.
 *
 * AUTH-UX security contract:
 *   Only business_id values returned by the server in
 *   error.details.available_businesses are accepted for re-submission.
 *   The client MUST NOT allow an invented or injected business_id.
 *   Validation is enforced by validateBusinessSelection() before the
 *   second login call is dispatched.
 */

export type LoginStep = 'credentials' | 'submitting' | 'business_selection' | 'error'

export interface AvailableBusiness {
  id: string
  name: string
  role?: string
}

export interface ParsedLoginError {
  step: 'business_selection' | 'error'
  availableBusinesses?: AvailableBusiness[]
  errorMsg?: string
}

// UUID v1-v5 regex (RFC 4122).
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Security guard: validate that a selected businessId is one of the IDs
 * returned by the server in the BUSINESS_SELECTION_REQUIRED response.
 *
 * Returns { valid: true } when safe to submit.
 * Returns { valid: false, error: string } when the ID should be rejected
 * without calling the API.
 */
export function validateBusinessSelection(
  businessId: string,
  allowedBusinesses: AvailableBusiness[],
): { valid: boolean; error?: string } {
  if (!UUID_REGEX.test(businessId)) {
    return { valid: false, error: 'ID bisnis tidak valid.' }
  }
  const found = allowedBusinesses.some((b) => b.id === businessId)
  if (!found) {
    return { valid: false, error: 'Pilihan bisnis tidak tersedia.' }
  }
  return { valid: true }
}

type AxiosErrorShape = {
  response?: {
    status?: number
    data?: {
      error?: {
        code?: string
        message?: string
        details?: { available_businesses?: AvailableBusiness[] }
      }
      code?: string
      message?: string
      details?: { available_businesses?: AvailableBusiness[] }
    }
  }
}

/**
 * Parse an Axios error thrown by POST /v1/auth/login and return a typed
 * step transition result for the login state machine.
 *
 * 409 + BUSINESS_SELECTION_REQUIRED => step: 'business_selection'
 * 403 + BUSINESS_ACCESS_DENIED      => step: 'error' (no tenant membership)
 * anything else                     => step: 'error' (generic message)
 */
export function parseLoginError(error: unknown): ParsedLoginError {
  const err = error as AxiosErrorShape
  const status = err?.response?.status
  const data = err?.response?.data
  const code = data?.error?.code ?? data?.code
  const businesses =
    data?.error?.details?.available_businesses ?? data?.details?.available_businesses

  if (
    status === 409 &&
    code === 'BUSINESS_SELECTION_REQUIRED' &&
    Array.isArray(businesses) &&
    businesses.length > 0
  ) {
    return { step: 'business_selection', availableBusinesses: businesses }
  }

  if (status === 403 && code === 'BUSINESS_ACCESS_DENIED') {
    return { step: 'error', errorMsg: 'Akun Anda belum terdaftar pada bisnis/tenant manapun.' }
  }

  const msg =
    data?.error?.message ?? data?.message ?? 'Terjadi kesalahan pada server. Silakan coba lagi.'
  return { step: 'error', errorMsg: msg }
}
