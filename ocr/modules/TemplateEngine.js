/**
 * TemplateEngine.js — Detects invoice template and routes to the correct parser.
 * Supports position-aware extraction and region-based extraction (OCR per region).
 */

import { parseNewGoodNits, extractCustomer, extractBillMeta, extractTotals, normalizeOcrText } from "./NewGoodNitsParser.js";
import { parseTable } from "./TableParser.js";
import { extractSpatial } from "./SpatialExtractor.js";

/**
 * Detect which company template the OCR text belongs to.
 * Uses multiple signals so low-clarity OCR still triggers (e.g. "KNITTING INVOICE", "GOOD NITS").
 * @param {string} text - Raw OCR text
 * @returns {string|null} Template id or null if unsupported
 */
export function detectTemplate(text) {
  const upper = (text || "").toUpperCase();
  if (upper.includes("NEW GOOD NITS")) return "NEW_GOOD_NITS";
  if (upper.includes("KNITTING INVOICE") && (upper.includes("GOOD NITS") || upper.includes("NEW GOOD"))) return "NEW_GOOD_NITS";
  if (upper.includes("GOOD NITS") && upper.includes("TIRUPUR")) return "NEW_GOOD_NITS";
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

/**
 * Extract structured data from region OCR texts (region-based OCR path).
 * Each region was OCR'd separately, so text order is stable per region.
 * @param {{ header?: string, customer: string, billMeta: string, table: string, totals: string }} regionTexts
 * @returns {{ customer: object|null, billMeta: object, table: Array, totals: object }}
 */
export function extractDataFromRegions(regionTexts) {
  const customerText = normalizeOcrText(regionTexts.customer || "");
  const billMetaText = normalizeOcrText(regionTexts.billMeta || "");
  const tableText = normalizeOcrText(regionTexts.table || "");
  const totalsText = normalizeOcrText(regionTexts.totals || "");

  const customer = extractCustomer(customerText);
  const billMeta = extractBillMeta(billMetaText);
  const table = parseTable(tableText);
  const totals = extractTotals(totalsText);

  return {
    customer: customer || null,
    billMeta,
    table,
    totals
  };
}

/**
 * Extract using word-level bounding boxes when available (position-aware).
 * Merges spatial result with text result; spatial overrides where it has values.
 * @param {Array<{ text: string, bbox?: { x0, y0, x1, y1 } }>} words - From Tesseract data.words
 * @param {string} text - Full OCR text (for text-based fallback)
 * @returns {{ customer, billMeta, table, totals }}
 */
export function extractDataWithWords(words, text) {
  const template = detectTemplate(text);
  if (template !== "NEW_GOOD_NITS") {
    return extractData(text);
  }

  const textResult = parseNewGoodNits(text);
  if (!words?.length) return textResult;

  return extractSpatial(words, textResult);
}
