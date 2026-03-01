/**
 * Formats a cost amount with its currency using the locale-aware Intl.NumberFormat.
 * Falls back to a plain number string if currency is null.
 */
export function formatCost(amount: number, currency: string | null): string {
  if (!currency) return String(amount);
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}
