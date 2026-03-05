/**
 * TemplateDetector.js — Identify invoice template from header text (e.g. "NEW GOOD NITS" → NEW_GOOD_NITS).
 */

/**
 * Detect template id from OCR text (e.g. header region).
 * @param {string} text - Raw OCR text from header or full page
 * @returns {string} Template id, e.g. "NEW_GOOD_NITS", or "UNKNOWN"
 */
export function detectTemplate(text) {
  const t = (text || "").toUpperCase();
  if (t.includes("NEW GOOD NITS") || (t.includes("NEW") && t.includes("GOOD") && t.includes("NITS"))) {
    return "NEW_GOOD_NITS";
  }
  return "UNKNOWN";
}
