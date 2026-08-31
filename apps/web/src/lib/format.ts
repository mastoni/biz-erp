/**
 * Currency formatter for IDR rupiah values.
 * Input is in rupiah (canonical convention: *_minor fields store rupiah directly).
 * 438500 → "Rp 438.500"
 *
 * Usage: formatMinor(438500) → "Rp 438.500"
 */
export function formatMinor(minor: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(minor);
}

/**
 * Format a Unix epoch milliseconds timestamp to a human-readable local date+time.
 */
export function formatEpochMs(epochMs: number): string {
  return new Date(epochMs).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
