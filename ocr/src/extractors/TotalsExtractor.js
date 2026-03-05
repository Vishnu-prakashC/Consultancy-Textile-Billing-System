/**
 * TotalsExtractor.js — Extract totals from totals region text.
 * Detect TOTAL, CGST, SGST, ROUNDED OFF, NET TOTAL; extract numeric values using NumericRepair.
 */

import { parseRepairedNumber } from "../parsers/NumericRepair.js";
import { normalizeText } from "../parsers/TextCleaner.js";

/**
 * Extract totals from OCR text of the totals region.
 * @param {string} text - Raw OCR text from totals region
 * @returns {{ subtotal: number|null, cgst: number|null, sgst: number|null, roundedOff: number|null, netTotal: number|null }}
 */
export function extractTotals(text) {
  const t = normalizeText(text || "");
  const result = {
    subtotal: null,
    cgst: null,
    sgst: null,
    roundedOff: null,
    netTotal: null
  };

  const decimals = [];
  const re = /[\d,]+\.?\d*/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    const v = parseRepairedNumber(m[0]);
    if (v != null && v >= 0 && v < 1e8) decimals.push(v);
  }
  if (!decimals.length) return result;

  const sorted = [...decimals].sort((a, b) => b - a);
  result.netTotal = sorted[0];
  result.subtotal = sorted[1] ?? sorted[0];

  const labelCgst = t.match(/CGST\s*2\.?5%?\s*[:\-]?\s*([\d,.]+)/i)?.[1];
  const labelSgst = t.match(/SGST\s*2\.?5%?\s*[:\-]?\s*([\d,.]+)/i)?.[1];
  const labelRounded = t.match(/Rounded\s*Off|Round\s*Off|ROUNDED\s*OFF\s*[:\-]?\s*([\d,.\-]+)/i)?.[1];
  const labelNet = t.match(/NET\s*T[O0D]?TAL\s*[:\-]?\s*([\d,.]+)/i)?.[1];

  if (labelCgst) result.cgst = parseRepairedNumber(labelCgst);
  else {
    const small = sorted.filter((v) => v > 0 && v < 2000).slice(-2);
    result.cgst = small[0] ?? null;
    result.sgst = small[1] ?? small[0] ?? null;
  }
  if (labelSgst) result.sgst = parseRepairedNumber(labelSgst);
  if (labelRounded) result.roundedOff = parseRepairedNumber(labelRounded);
  else {
    const r = sorted.find((v) => v > 0 && v < 1 && v !== 0);
    result.roundedOff = r != null ? r : null;
  }
  if (labelNet) result.netTotal = parseRepairedNumber(labelNet);

  return result;
}
