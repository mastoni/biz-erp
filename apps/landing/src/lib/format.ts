// ============================================================================
// Canonical Currency & Display Formatter for Landing Page
// Money Contract: *_minor = Rupiah integer directly (no division by 100)
// Example: 438500 -> "Rp 438.500"
// ============================================================================

const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/**
 * Format integer minor value to Indonesian Rupiah currency string.
 * @param amountMinor - Direct integer rupiah (e.g. 438500)
 */
export function formatRupiah(amountMinor: number | null | undefined): string {
  if (typeof amountMinor !== 'number' || isNaN(amountMinor)) {
    return 'Rp 0'
  }
  return idrFormatter.format(amountMinor)
}

/**
 * Helper to display human-readable billing cycle suffix
 */
export function formatBillingCycleSuffix(billingCycle?: string | null): string {
  if (!billingCycle) return ''
  const normalized = billingCycle.toUpperCase()
  if (normalized === 'MONTHLY') return '/bulan'
  if (normalized === 'YEARLY') return '/tahun'
  if (normalized === 'ONE_TIME') return ' (sekali bayar)'
  return `/${billingCycle.toLowerCase()}`
}
