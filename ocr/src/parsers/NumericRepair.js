/**
 * NumericRepair.js — Fix common OCR mistakes in numeric tokens.
 * O→0, I/l→1, S→5, B→8. Apply only when token is mostly numeric.
 */

/**
 * Repair a single token (e.g. "125.SO" → "125.50", "2I0" → "210").
 * @param {string} str - Raw token
 * @returns {string}
 */
export function repairNumericToken(str) {
  if (!str || typeof str !== "string") return str;
  const t = str.trim();
  const digits = (t.match(/\d/g) || []).length;
  const letters = (t.match(/[A-Za-z]/g) || []).length;
  if (letters > digits + 2) return t;

  return t
    .replace(/O/g, "0")
    .replace(/I|l/g, "1")
    .replace(/S/g, "5")
    .replace(/B/g, "8");
}

/**
 * Parse string as number after repair; strip commas first.
 * @param {string} str
 * @returns {number|null}
 */
export function parseRepairedNumber(str) {
  const cleaned = String(str).replace(/,/g, "");
  const repaired = repairNumericToken(cleaned);
  const n = parseFloat(repaired);
  return Number.isFinite(n) ? n : null;
}
