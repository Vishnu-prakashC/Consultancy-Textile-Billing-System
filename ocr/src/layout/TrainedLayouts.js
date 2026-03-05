/**
 * TrainedLayouts.js — Pre-trained or averaged layouts (y, h format). Load from JSON or use defaults.
 */

export const TRAINED_NEW_GOOD_NITS_LAYOUT = {
  header: { y: 0, h: 0.17 },
  customer: { y: 0.18, h: 0.16, x: 0, w: 0.6 },
  billMeta: { y: 0.18, h: 0.16, x: 0.6, w: 0.4 },
  table: { y: 0.36, h: 0.4 },
  totals: { y: 0.78, h: 0.14 }
};

/**
 * Get trained layout by template id. Returns null for unknown.
 * @param {string} templateId - e.g. "NEW_GOOD_NITS"
 * @returns {Object|null}
 */
export function getTrainedLayout(templateId) {
  if (templateId === "NEW_GOOD_NITS") return TRAINED_NEW_GOOD_NITS_LAYOUT;
  return null;
}
