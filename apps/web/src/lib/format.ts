/**
 * Currency formatter for minor-unit integers (1/100 of base unit).
 * 125000 minor → "Rp 1.250,00"
 *
 * Usage: formatMinor(125000) → "Rp 1.250,00"
 */
export function formatMinor(minor: number): string {
  const major = minor / 100;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(major);
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
