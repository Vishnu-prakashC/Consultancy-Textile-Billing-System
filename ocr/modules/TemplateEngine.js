/**
 * TemplateEngine.js — Detects invoice template and routes to the correct parser.
 * Clean, expandable, industry structure.
 */

import { parseNewGoodNits } from "./NewGoodNitsParser.js";

/**
 * Detect which company template the OCR text belongs to.
 * @param {string} text - Raw OCR text
 * @returns {string|null} Template id or null if unsupported
 */
export function detectTemplate(text) {
  if (text.includes("NEW GOOD NITS")) {
    return "NEW_GOOD_NITS";
  }
  return null;
}

/**
 * Extract structured data from OCR text using the detected template.
 * @param {string} text - Raw OCR text
 * @returns {{ customer, billMeta, table, totals }}
 * @throws {Error} If template is unsupported
 */
export function extractData(text) {
  const template = detectTemplate(text);

  if (template === "NEW_GOOD_NITS") {
    return parseNewGoodNits(text);
  }

  throw new Error("Unsupported invoice format");
}
