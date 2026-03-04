/**
 * NewGoodNitsParser.js — Structured extraction for NEW GOOD NITS knitting invoices.
 * Returns { customer, billMeta, table, totals }.
 * Uses OCR-normalized text for flexible matching.
 */

import { parseTable } from "./TableParser.js";

/**
 * Normalize OCR text to fix common misreads (0/O, spacing, T0TAL, GST N0, etc.).
 * @param {string} text - Raw OCR text
 * @returns {string}
 */
export function normalizeOcrText(text) {
  if (!text || typeof text !== "string") return "";
  let t = text
    .replace(/\r/g, "")
    .replace(/ +/g, " ")
    .trim();
  t = t.replace(/\bT0TAL\b/gi, "TOTAL");
  t = t.replace(/\bGST\s*N0\b/gi, "GST No");
  t = t.replace(/\bGSTNO\b/gi, "GST No");
  return t;
}

/**
 * Extract customer block: from "To." up to "GST No" (flexible GST label).
 * @param {string} text - Full OCR text (prefer normalized)
 * @returns {{ name: string|null, address: string }|null}
 */
export function extractCustomer(text) {
  const customerBlockMatch = text.match(/To\.(.*?)GST\s*N[O0]\s*[:.]?/s);
  if (!customerBlockMatch) return null;

  const block = customerBlockMatch[1];
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return {
    name: lines[0] || null,
    address: lines.slice(1).join(", ") || ""
  };
}

/**
 * Extract bill metadata: No, Date, Job No.
 * Date accepts DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY, DD.MM.YYYY.
 * @param {string} text - Full OCR text (prefer normalized)
 * @returns {{ billNo: string|null, date: string|null, jobNo: string|null }}
 */
export function extractBillMeta(text) {
  const flexibleDate = text.match(/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}/)?.[0] || null;
  return {
    billNo: text.match(/No\s*[.:]?\s*(\d+)/)?.[1] || null,
    date: flexibleDate,
    jobNo: text.match(/Job\s*No\s*[.:]?\s*(\d+)/)?.[1] || null
  };
}

/**
 * Extract totals section: TOTAL, CGST 2.5%, SGST 2.5%, NET TOTAL.
 * Tolerates T0TAL (O/0), "TOTAL :", "TOTAL -", and weight+amount on same line.
 * @param {string} text - Full OCR text (prefer normalized)
 * @returns {{ subtotal: string|null, cgst: string|null, sgst: string|null, netTotal: string|null }}
 */
export function extractTotals(text) {
  const totalRegex = /T[O0]TAL\s*[:\-]?\s*([\d,.]+)(?:\s+[\d,.]+)?/;
  const totalMatch = text.match(/T[O0]TAL\s*[:\-]?\s*[\d.]+\s+([\d,.]+)/) || text.match(totalRegex);
  return {
    subtotal: totalMatch?.[1] || null,
    cgst: text.match(/CGST\s*2\.5%\s*([\d,.]+)/)?.[1] || null,
    sgst: text.match(/SGST\s*2\.5%\s*([\d,.]+)/)?.[1] || null,
    netTotal: text.match(/NET\s*T[O0]TAL\s*[:\-]?\s*([\d,.]+)/)?.[1] || null
  };
}

/**
 * Master parser: customer + billMeta + table + totals.
 * Normalizes OCR text first, then runs all extractors.
 * @param {string} text - Full OCR text
 * @returns {{ customer: object|null, billMeta: object, table: Array, totals: object }}
 */
export function parseNewGoodNits(text) {
  const normalized = normalizeOcrText(text);
  const customer = extractCustomer(normalized);
  const billMeta = extractBillMeta(normalized);
  const table = parseTable(normalized);
  const totals = extractTotals(normalized);

  return {
    customer,
    billMeta,
    table,
    totals
  };
}
