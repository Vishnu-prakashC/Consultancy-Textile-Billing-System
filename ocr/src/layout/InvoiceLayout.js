/**
 * InvoiceLayout.js — Exact OCR zones for NEW GOOD NITS invoice.
 * All values are fractions of image height/width (0–1). Same format every time.
 */

export const NEW_GOOD_NITS_LAYOUT = {
  header: {
    top: 0.0,
    bottom: 0.18
  },
  customer: {
    top: 0.18,
    bottom: 0.35,
    left: 0.6,
    right: 1.0
  },
  billMeta: {
    top: 0.18,
    bottom: 0.35,
    left: 0.0,
    right: 0.6
  },
  table: {
    top: 0.35,
    bottom: 0.75
  },
  totals: {
    top: 0.75,
    bottom: 0.92
  }
};

/** @param {Object} [layout] */
export function getRegionNames(layout = NEW_GOOD_NITS_LAYOUT) {
  return Object.keys(layout);
}
