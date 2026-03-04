/**
 * NewGoodNitsParser.js — Structured extraction for NEW GOOD NITS knitting invoices.
 * Returns { customer, billMeta, table, totals }.
 * Uses OCR-normalized text for flexible matching.
 */

import { parseTable } from "./TableParser.js";

/**
 * Normalize OCR text to fix common misreads (0/O, spacing, labels).
 * Character correction for numeric/label contexts. Run before any extraction.
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
  t = t.replace(/\bNo\./g, "No:");
  t = t.replace(/\bG5T\b/gi, "GST");
  return t;
}

/**
 * Extract customer using GST-first anchor: find GST, then 5 lines above; first uppercase-heavy = name, rest = address.
 * State from (number) or "Tamil Nadu". Works even when "To" is broken.
 * @param {string} text - Full OCR text (prefer normalized)
 * @returns {{ name: string|null, address: string, gstNo: string|null, state: string|null }|null}
 */
export function extractCustomer(text) {
  const gstPattern = /GST\s*No\s*[:\-]?\s*([A-Z0-9]{15})/i;
  const gstMatch = text.match(gstPattern);
  if (gstMatch) {
    const gstNo = gstMatch[1];
    const beforeGst = text.slice(0, gstMatch.index);
    const linesAbove = beforeGst.split("\n").map((l) => l.trim()).filter(Boolean).slice(-6);
    const nameLine = linesAbove.find((l) => /[A-Z]/.test(l) && (l.match(/[A-Z]/g)?.length ?? 0) >= 2 && l.length <= 80);
    const name = nameLine || linesAbove[0] || null;
    const rest = nameLine ? linesAbove.filter((l) => l !== nameLine) : linesAbove.slice(1);
    const stateMatch = text.match(/\((\d+)\)|Tamil\s*Nadu/i);
    const state = stateMatch?.[1] || (stateMatch ? "Tamil Nadu" : null);
    return {
      name,
      address: rest.join(", ") || "",
      gstNo,
      state
    };
  }

  const fuzzyToPattern = /(?:To|T0|T\s*o|7o)\.?\s*([\s\S]*?)GST\s*No\s*[:\-]?\s*([A-Z0-9]{15})/i;
  const customerBlockMatch = text.match(fuzzyToPattern);
  if (customerBlockMatch) {
    const block = customerBlockMatch[1];
    const gstNo = customerBlockMatch[2];
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const stateMatch = text.match(/Tamil\s*Nadu\s*\((\d+)\)|\((\d+)\)/i);
    return {
      name: lines[0] || null,
      address: lines.slice(1).join(", ") || "",
      gstNo: gstNo || null,
      state: stateMatch?.[1] || stateMatch?.[2] || null
    };
  }

  const fallback = text.match(/(?:To|T0|T\s*o|7o)\.?\s*([\s\S]*?)GST\s*No/i);
  if (fallback) {
    const block = fallback[1];
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const gstNoMatch = text.match(/GST\s*No\s*[:\-]?\s*([A-Z0-9]{10,20})/i);
    return {
      name: lines[0] || null,
      address: lines.slice(1).join(", ") || "",
      gstNo: gstNoMatch?.[1]?.replace(/\s/g, "") || null,
      state: text.match(/\((\d+)\)/)?.[1] || null
    };
  }

  return null;
}

/**
 * Get top N% of text (invoice numbers and meta are always near top).
 * @param {string} text
 * @param {number} percent 0–100
 * @returns {string}
 */
function topPercent(text, percent) {
  if (!text) return "";
  const len = Math.max(1, Math.ceil((text.length * percent) / 100));
  return text.slice(0, len);
}

/**
 * Extract bill metadata. Bill No: STRICT — only top 25%, 1–6 digits after "No", reject GST line.
 * @param {string} text - Full OCR text (prefer normalized)
 * @returns {{ billNo: string|null, date: string|null, jobNo: string|null, partyDcNo: string|null }}
 */
export function extractBillMeta(text) {
  const top25 = topPercent(text, 25);

  let billNo = null;
  const lines = top25.split("\n");
  for (const line of lines) {
    if (/GST\s*No/i.test(line)) continue;
    const m = line.match(/\bNo\s*[:\-]?\s*(\d{1,6})\b/);
    if (m && m[1].length <= 6 && /^\d+$/.test(m[1])) {
      billNo = m[1];
      break;
    }
  }
  if (!billNo) {
    const fallback = top25.match(/\b(\d{1,6})\b/);
    if (fallback && !/GST|TIN|PAN|UDYAM/i.test(top25.slice(0, fallback.index + 50))) {
      billNo = fallback[1];
    }
  }

  const flexibleDate = text.match(/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}/)?.[0] || null;
  const jobNoMatch = text.match(/Job\s*No\s*[:\-]?\s*(\d+)/i);
  const partyDcMatch = text.match(/Party\s*DC\s*No\s*[:\-]?\s*(\S*)/i);
  return {
    billNo,
    date: flexibleDate,
    jobNo: jobNoMatch?.[1] || null,
    partyDcNo: partyDcMatch?.[1]?.trim() || null
  };
}

/**
 * Extract totals ONLY from block between first TOTAL and NET TOTAL (fuzzy). Map by numeric size.
 * Largest = Net Total, second = Subtotal, two similar small = CGST/SGST, smallest abs = Rounded Off.
 * @param {string} text - Full OCR text (prefer normalized)
 * @returns {{ subtotal: string|null, cgst: string|null, sgst: string|null, roundedOff: string|null, netTotal: string|null }}
 */
export function extractTotals(text) {
  const fuzzyTotal = /T[O0D]TAL|TOTAL/i;
  const fuzzyNetTotal = /NET\s*T[O0D]?TAL/i;
  const startIdx = text.search(fuzzyTotal);
  const netIdx = text.search(fuzzyNetTotal);
  let block = "";
  if (startIdx !== -1 && netIdx !== -1 && netIdx > startIdx) {
    block = text.slice(startIdx, netIdx + 50);
  } else if (startIdx !== -1) {
    block = text.slice(startIdx, startIdx + 800);
  }

  const decimals = [];
  const re = /[\d,]+\.\d+/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    const val = parseFloat(m[0].replace(/,/g, ""));
    if (Number.isFinite(val) && val < 1e7 && val >= 0) decimals.push(val);
  }

  if (decimals.length === 0) {
    return {
      subtotal: null,
      cgst: null,
      sgst: null,
      roundedOff: null,
      netTotal: null
    };
  }

  const sorted = [...decimals].sort((a, b) => b - a);
  const netTotal = sorted[0];
  const subtotal = sorted[1] ?? sorted[0];
  const twoSmall = sorted.filter((v) => v < 1000 && v > 0).slice(-2);
  const cgst = twoSmall[0] ?? null;
  const sgst = twoSmall[1] ?? twoSmall[0] ?? null;
  const roundedRaw = sorted.find((v) => v < 1 && v > -1 && v !== 0) ?? sorted[sorted.length - 1];
  const roundedOff = Math.abs(roundedRaw) < 10 ? roundedRaw : null;

  const labelCgst = block.match(/CGST\s*2\.?5%?\s*[:\-]?\s*([\d,.]+)/i)?.[1];
  const labelSgst = block.match(/SGST\s*2\.?5%?\s*[:\-]?\s*([\d,.]+)/i)?.[1];
  const labelRounded = block.match(/Rounded\s*Off\s*[:\-]?\s*([\d,.\-]+)/i)?.[1];
  const labelNet = block.match(/NET\s*T[O0D]?TAL\s*[:\-]?\s*([\d,.]+)/i)?.[1];
  const totalLineMatch = block.match(/T[O0D]?TAL\s*[:\-]?\s*[\d.]+\s+([\d,.]+)/) || block.match(/T[O0D]?TAL\s*[:\-]?\s*([\d,.]+)/);

  return {
    subtotal: (totalLineMatch?.[1] || (sorted[1] != null ? String(sorted[1]) : null))?.replace(/,/g, "") ?? null,
    cgst: (labelCgst || (cgst != null ? String(cgst) : null))?.replace(/,/g, "") ?? null,
    sgst: (labelSgst || (sgst != null ? String(sgst) : null))?.replace(/,/g, "") ?? null,
    roundedOff: (labelRounded || (roundedOff != null ? String(roundedOff) : null))?.replace(/,/g, "") ?? null,
    netTotal: (labelNet || String(netTotal))?.replace(/,/g, "") ?? null
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
