/**
 * ValidationLayer.js — Verify extracted data before filling UI (e.g. subtotal vs table sum).
 */

/**
 * Validate totals against table row sum. Log warning if mismatch.
 * @param {Array<{ amount: number }>} table - Extracted table rows
 * @param {{ subtotal?: number, netTotal?: number }} totals - Extracted totals
 * @param {number} [tolerance] - Allowed absolute difference (default 5)
 * @returns {{ valid: boolean, message?: string }}
 */
export function validateTotals(table, totals, tolerance = 5) {
  if (!Array.isArray(table) || !totals) {
    return { valid: true };
  }

  const sum = table.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const subtotal = totals.subtotal != null ? Number(totals.subtotal) : null;

  if (subtotal != null && Math.abs(sum - subtotal) > tolerance) {
    console.warn("[Validation] Subtotal mismatch: table sum =", sum, ", subtotal =", subtotal);
    return { valid: false, message: `Subtotal mismatch: table sum ${sum.toFixed(2)} vs subtotal ${subtotal}` };
  }

  return { valid: true };
}
