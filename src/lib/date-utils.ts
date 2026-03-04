/**
 * Format a Date as YYYY-MM-DD (ISO date string, local time, no TZ shift).
 * Used for URL query params, occurrence keys, and date-range comparisons.
 */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
