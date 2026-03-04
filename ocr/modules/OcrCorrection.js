/**
 * OCR correction for numeric tokens. Apply only when token is mostly numeric.
 * Fixes: O→0, I→1, S→5, B→8 so "2I0" → "210", "125.SO" → "125.50"
 * @param {string} str - Raw token
 * @returns {string}
 */
export function repairNumericToken(str) {
  if (!str || typeof str !== "string") return str;
  const trimmed = str.trim();
  const digitCount = (trimmed.match(/\d/g) || []).length;
  const letterCount = (trimmed.match(/[A-Za-z]/g) || []).length;
  if (letterCount > digitCount + 2) return trimmed;

  let out = trimmed
    .replace(/O/g, "0")
    .replace(/I|l/g, "1")
    .replace(/S/g, "5")
    .replace(/B/g, "8");
  return out;
}

/**
 * Parse float after repair; returns null if not a valid number.
 */
export function parseRepairedNumber(str) {
  const repaired = repairNumericToken(String(str).replace(/,/g, ""));
  const n = parseFloat(repaired);
  return Number.isFinite(n) ? n : null;
}
