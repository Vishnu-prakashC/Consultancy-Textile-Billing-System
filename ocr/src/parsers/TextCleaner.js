/**
 * TextCleaner.js — Normalize and fix common OCR label/text errors before extraction.
 * Fuzzy matching for TOTAL, GST No, etc.
 */

/**
 * Normalize OCR text: trim, collapse spaces, fix common misreads.
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  if (!text || typeof text !== "string") return "";
  let t = text
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
  t = t.replace(/\bT0TAL\b/gi, "TOTAL");
  t = t.replace(/\bTOIAL\b/gi, "TOTAL");
  t = t.replace(/\bTDTAL\b/gi, "TOTAL");
  t = t.replace(/\bGST\s*N0\b/gi, "GST No");
  t = t.replace(/\bGSTNO\b/gi, "GST No");
  t = t.replace(/\bG5T\b/gi, "GST");
  t = t.replace(/\bNo\./g, "No:");
  return t;
}

/**
 * Fuzzy match "TOTAL" (T0TAL, TOIAL, TDTAL).
 * @param {string} word
 * @returns {boolean}
 */
export function isFuzzyTotal(word) {
  const t = (word || "").toUpperCase().replace(/\s/g, "");
  return /^T[O0D]?TAL$/.test(t) || t === "TOTAL" || t === "TOIAL" || t === "TDTAL";
}

/**
 * Fuzzy match "NET TOTAL".
 * @param {string} word
 * @returns {boolean}
 */
export function isFuzzyNetTotal(word) {
  const t = (word || "").toUpperCase().replace(/\s/g, "");
  return /^NET\s*T[O0D]?TAL$/.test(t) || /^NETTOTAL$/.test(t);
}
