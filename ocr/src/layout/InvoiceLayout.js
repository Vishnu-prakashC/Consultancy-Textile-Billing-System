/**
 * InvoiceLayout.js — Normalized region positions for NEW GOOD NITS invoice.
 * Values are fractions of image height (0–1). rightSide: true means right half of the same vertical band.
 */

export const NEW_GOOD_NITS_LAYOUT = {
  header: { top: 0.0, bottom: 0.18 },
  customer: { top: 0.18, bottom: 0.35, left: 0, right: 0.52 },
  billMeta: { top: 0.18, bottom: 0.35, rightSide: true },
  table: { top: 0.35, bottom: 0.75 },
  totals: { top: 0.75, bottom: 0.92 }
};

/**
 * Get all region names for the layout.
 * @param {Object} layout
 * @returns {string[]}
 */
export function getRegionNames(layout = NEW_GOOD_NITS_LAYOUT) {
  return Object.keys(layout);
}
