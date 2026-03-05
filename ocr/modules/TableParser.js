/**
 * TableParser.js — Backward numeric parsing for low-clarity OCR.
 * Uses OCR correction (O→0, I→1, S→5, B→8) so "125.SO" and "2I0" parse correctly.
 */

import { parseRepairedNumber } from "./OcrCorrection.js";

const FUZZY_TOTAL = /T[O0D]?TAL|TOTAL|TOIAL|TDTAL/i;
const NUMERIC_TOKEN = /[\d,]+\.?\d*/g;

/**
 * Extract numeric tokens from line; try repaired parse for broken OCR (e.g. 125.SO → 125.50, 2I0 → 210).
 */
function getNumericTokens(line) {
  const tokens = [];
  const values = [];
  const re = /[\d,]+\.?[\dA-Za-z]*/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const raw = m[0].replace(/,/g, "");
    let v = parseFloat(raw);
    if (!Number.isFinite(v)) v = parseRepairedNumber(m[0]);
    if (v != null && Number.isFinite(v)) {
      tokens.push(m[0]);
      values.push(v);
    }
  }
  return { tokens, values };
}

/**
 * Check if line looks like a table row: has at least 2 numeric tokens at end (rate, amount); prefer 3 (weight, rate, amount).
 * Relaxed so OCR with bad weight still yields a row.
 */
function looksLikeTableRow(line) {
  const { values } = getNumericTokens(line);
  if (values.length < 2) return false;
  const a = values[values.length - 1];
  const r = values[values.length - 2];
  if (!Number.isFinite(a) || !Number.isFinite(r)) return false;
  if (a <= 0 || a > 1e10) return false;
  return true;
}

/**
 * Parse a single line using backward numeric: last 2 or 3 = (weight?), rate, amount; rest = leading columns.
 */
function parseRowBackward(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const { values, tokens } = getNumericTokens(trimmed);
  if (values.length < 2) return null;

  const amount = values[values.length - 1];
  const rate = values[values.length - 2];
  const weight = values.length >= 3 ? values[values.length - 3] : null;
  if (!Number.isFinite(amount) || !Number.isFinite(rate)) return null;

  const lastTwoStart = values.length >= 3 ? tokens.length - 3 : tokens.length - 2;
  const thirdLastToken = tokens[lastTwoStart];
  const startOfLastN = thirdLastToken ? trimmed.indexOf(thirdLastToken) : -1;
  const leadingStr = startOfLastN >= 0 ? trimmed.slice(0, startOfLastN).trim() : "";
  const leading = leadingStr ? leadingStr.split(/\s+/) : [];

  const slNo = leading[0] ?? null;
  const dc = leading[1] ?? null;
  const date = leading[2] ?? null;
  const gg = leading[3] ?? null;
  const counts = leading.length >= 7 ? leading[leading.length - 3] : null;
  const mill = leading.length >= 7 ? leading[leading.length - 2] : null;
  const dia = leading.length >= 7 ? leading[leading.length - 1] : null;
  const fabric = leading.length >= 8 ? leading.slice(4, -3).join(" ").trim() || null : null;

  return {
    slNo,
    dc,
    date,
    gg,
    fabric: fabric || null,
    counts,
    mill,
    dia,
    weight: weight ?? null,
    rate,
    amount
  };
}

/**
 * Find index of first line matching TOTAL (fuzzy). Table rows are above this.
 */
function findTotalLineIndex(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (FUZZY_TOTAL.test(lines[i])) return i;
  }
  return lines.length;
}

/**
 * Find index of header line (S.No, D.C., Fabric, GG, COUNTS, MILL, DIA, Wt, Rate, Amount). Rows start after this.
 */
function findHeaderLineIndex(lines) {
  const headerKeywords = /S\.?\s*No|D\.?\s*C\.?|Fabric|Wt\.?\s*Kgs|Rate|Amount|GG|COUNTS|MILL|DIA/i;
  for (let i = 0; i < lines.length; i++) {
    if (headerKeywords.test(lines[i])) return i;
  }
  return -1;
}

/**
 * Parse table using backward numeric parsing. Only consider lines between header and TOTAL.
 * If no header, use fallback: any line with ≥3 numeric tokens (amount, rate, weight at end).
 * @param {string} text - Full OCR text (prefer normalized)
 * @returns {Array<Object>} Array of row objects
 */
export function parseTable(text) {
  const lines = text.split("\n");
  const totalIdx = findTotalLineIndex(lines);
  const headerIdx = findHeaderLineIndex(lines);
  const startIdx = headerIdx >= 0 ? headerIdx + 1 : 0;
  const endIdx = totalIdx;

  const rows = [];
  for (let i = startIdx; i < endIdx; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (FUZZY_TOTAL.test(line) || /CGST|SGST|NET\s*T/i.test(line)) break;
    if (!looksLikeTableRow(line)) continue;

    const row = parseRowBackward(line);
    if (row) rows.push(row);
  }

  if (rows.length === 0) {
    for (let i = 0; i < endIdx; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      if (FUZZY_TOTAL.test(line) || /CGST|SGST|NET\s*T/i.test(line)) break;
      if (!looksLikeTableRow(line)) continue;
      const row = parseRowBackward(line);
      if (row) rows.push(row);
    }
  }

  return rows;
}
