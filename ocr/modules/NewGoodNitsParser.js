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
 * Extract customer using GST-first anchor. If text looks like header bleed (TIN, PAN, NEW GOOD NITS),
 * use the block after "To" and the second/last GST No (customer) instead of the first (seller).
 * @param {string} text - Full OCR text (prefer normalized)
 * @returns {{ name: string|null, address: string, gstNo: string|null, state: string|null }|null}
 */
export function extractCustomer(text) {
  const normalized = (text || "").trim();
  if (/33AAFFN|33982424698/.test(normalized)) return null;
  const hasHeaderBleed = /TIN\s*:|PAN\s*:|NEW\s*GOOD\s*NITS|KNITTING\s*INVOICE|Manikandan\s*Nagar|Dharapuram\s*Road/i.test(normalized);
  const sellerGstPrefix = /^33AAFFN/i;

  const allGstMatches = [];
  let m;
  const gstRe = /GST\s*No\s*[:\-]?\s*([A-Z0-9]{15})/gi;
  while ((m = gstRe.exec(normalized)) !== null) {
    allGstMatches.push({ index: m.index, gst: m[1].replace(/\s/g, "") });
  }

  if (hasHeaderBleed && allGstMatches.length >= 2) {
    const firstIsSeller = sellerGstPrefix.test(allGstMatches[0].gst);
    const customerGstMatch = firstIsSeller ? allGstMatches[1] : allGstMatches[allGstMatches.length - 1];
    const toMatch = normalized.match(/(?:To|T0|T\s*o|7o)\.?\s*([\s\S]*?)(?=GST\s*No\s*[:\-]?\s*[A-Z0-9]{15})/i);
    const block = toMatch ? toMatch[1].trim() : normalized.slice(0, customerGstMatch.index);
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const nameLine = lines.find((l) => /[A-Z]{2,}/.test(l) && l.length <= 60 && !/TIN|PAN|GSTIN|^\d/.test(l));
    const name = nameLine || lines[0] || null;
    const stateM = normalized.match(/STATE\s*[:\-]?\s*[^,\n]*\s*\((\d+)\)|Tamil\s*Nadu\s*\((\d+)\)|\((\d+)\)/i);
    const state = (stateM && (stateM[1] || stateM[2] || stateM[3])) || null;
    return {
      name,
      address: lines.filter((l) => l !== nameLine).join(", ") || "",
      gstNo: customerGstMatch.gst,
      state
    };
  }

  if (hasHeaderBleed && allGstMatches.length === 1 && sellerGstPrefix.test(allGstMatches[0].gst)) {
    return null;
  }

  const gstPattern = /GST\s*No\s*[:\-]?\s*([A-Z0-9]{15})/i;
  const gstMatch = text.match(gstPattern);
  if (gstMatch) {
    const gstNo = gstMatch[1].replace(/\s/g, "");
    if (sellerGstPrefix.test(gstNo) && hasHeaderBleed) return null;
    const beforeGst = text.slice(0, gstMatch.index);
    const linesAbove = beforeGst.split("\n").map((l) => l.trim()).filter(Boolean).slice(-6);
    const nameLine = linesAbove.find((l) => /[A-Z]/.test(l) && (l.match(/[A-Z]/g)?.length ?? 0) >= 2 && l.length <= 80 && !/TIN\s*:|PAN\s*:|NEW\s*GOOD\s*NITS|KNITTING\s*INVOICE/i.test(l));
    const name = nameLine || linesAbove.find((l) => !/TIN|PAN|GSTIN/i.test(l)) || linesAbove[0] || null;
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
    const gstNo = customerBlockMatch[2].replace(/\s/g, "");
    if (hasHeaderBleed && sellerGstPrefix.test(gstNo)) { /* skip seller */ } else {
      const block = customerBlockMatch[1];
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      const stateMatch = text.match(/Tamil\s*Nadu\s*\((\d+)\)|\((\d+)\)/i);
      return {
        name: lines[0] || null,
        address: lines.slice(1).join(", ") || "",
        gstNo: gstNo || null,
        state: stateMatch?.[1] || stateMatch?.[2] || null
      };
    }
  }

  const fallback = text.match(/(?:To|T0|T\s*o|7o)\.?\s*([\s\S]*?)GST\s*No\s*[:\-]?\s*([A-Z0-9]{10,20})/i);
  if (fallback) {
    const gstNo = (fallback[2] || "").replace(/\s/g, "");
    if (hasHeaderBleed && gstNo.length >= 15 && sellerGstPrefix.test(gstNo)) { /* skip */ } else {
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
 * Extract bill metadata. Prefer "No: 388" / "Date: 10/01/2026" / "Job No: 446". Reject postal codes (641, 602, 604).
 */
export function extractBillMeta(text) {
  const full = (text || "").trim();
  const top40 = full.slice(0, Math.max(1, Math.ceil(full.length * 0.4)));
  const hasPhonePattern = (s) => /\d{5}\s*\d{5}/.test(s);
  const postalCodeNumbers = ["641", "602", "604"];

  let billNo = null;
  const noMatch = full.match(/\bNo\s*[:\-]?\s*(\d{2,4})\b/);
  if (noMatch && !postalCodeNumbers.includes(noMatch[1])) {
    billNo = noMatch[1];
  }
  if (!billNo) {
    const lines = top40.split("\n");
    for (const line of lines) {
      if (/GST|TIN|PAN|UDYAM|Phone/i.test(line) || hasPhonePattern(line)) continue;
      const m = line.match(/\bNo\s*[:\-]?\s*(\d{2,4})\b/);
      if (m && !postalCodeNumbers.includes(m[1])) {
        billNo = m[1];
        break;
      }
    }
  }
  if (!billNo) {
    const fallback = top40.match(/\b(\d{2,4})\b/);
    if (fallback && !postalCodeNumbers.includes(fallback[1]) && !/GST|TIN|PAN/i.test(top40.slice(0, fallback.index + 30))) {
      billNo = fallback[1];
    }
  }

  const dateMatch = full.match(/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}/);
  const flexibleDate = dateMatch ? dateMatch[0] : null;
  const jobNoMatch = full.match(/Job\s*No\.?\s*[:\-]?\s*(\d+)/i);
  const partyDcMatch = full.match(/Party\s*DC\s*No\.?\s*[:\-]?\s*(\S*)/i);

  return {
    billNo,
    date: flexibleDate,
    jobNo: jobNoMatch ? jobNoMatch[1] : null,
    partyDcNo: partyDcMatch ? partyDcMatch[1].trim() || null : null
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
    block = text.slice(startIdx, netIdx + 120);
  } else if (startIdx !== -1) {
    block = text.slice(startIdx, startIdx + 800);
  }
  if (netIdx !== -1) {
    const afterNet = text.slice(netIdx, netIdx + 80);
    block = block + "\n" + afterNet;
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
  const subtotalMatch = block.match(/(?:20[,.]?\d{2,3}[,.]?\d{2}|[\d,]+\.\d{2})/g);
  const largeNumbers = (subtotalMatch || []).map((s) => parseFloat(s.replace(/,/g, ""))).filter((n) => n > 1000 && n < 1e7).sort((a, b) => b - a);
  const inferredSubtotal = largeNumbers[1] ?? largeNumbers[0];
  const inferredNet = largeNumbers[0];

  return {
    subtotal: (totalLineMatch?.[1] || (sorted[1] != null ? String(sorted[1]) : (inferredSubtotal != null ? String(inferredSubtotal) : null)))?.replace(/,/g, "") ?? null,
    cgst: (labelCgst || (cgst != null ? String(cgst) : null))?.replace(/,/g, "") ?? null,
    sgst: (labelSgst || (sgst != null ? String(sgst) : null))?.replace(/,/g, "") ?? null,
    roundedOff: (labelRounded || (roundedOff != null ? String(roundedOff) : null))?.replace(/,/g, "") ?? null,
    netTotal: (labelNet || (inferredNet != null ? String(inferredNet) : null) || String(netTotal))?.replace(/,/g, "") ?? null
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
