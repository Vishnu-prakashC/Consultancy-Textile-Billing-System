/**
 * TableParser.js — Line-based table row detection and column extraction.
 * Uses flexible date format and extracts weight/rate/amount from end of row for robustness.
 */

/** Flexible date pattern: 10/1/2026, 10-01-2026, 10.01.2026 */
const FLEXIBLE_DATE = /\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}/;
/** Weight: 3 decimals (or 2 if OCR drops one) */
const WEIGHT_PATTERN = /\d+\.\d{2,3}/;
/** Amount: 1–2 decimals at end of line */
const AMOUNT_AT_END = /\d+\.\d{1,2}\s*$/;

/**
 * Detect if a line is a table data row (flexible date + weight + amount at end).
 * @param {string} line - Single line of text
 * @returns {boolean}
 */
export function isTableRow(line) {
  return (
    FLEXIBLE_DATE.test(line) &&
    WEIGHT_PATTERN.test(line) &&
    AMOUNT_AT_END.test(line)
  );
}

/**
 * Parse table section from full OCR text into structured rows.
 * Extracts amount, rate, weight from end of row (last 3 columns); rest maps to slNo, dc, date, gg, fabric, counts, mill, dia.
 * Fabric can contain spaces (e.g. "COTTON RIB"). Only pushes row if weight/rate/amount parse as numbers.
 * @param {string} text - Full OCR text (prefer normalized)
 * @returns {Array<Object>} Array of row objects
 */
export function parseTable(text) {
  const lines = text.split("\n");
  const rows = [];
  let loggedOnce = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !isTableRow(trimmed)) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 10) continue;

    const amount = parseFloat(parts[parts.length - 1]);
    const rate = parseFloat(parts[parts.length - 2]);
    const weight = parseFloat(parts[parts.length - 3]);

    if (!Number.isFinite(amount) || !Number.isFinite(rate) || !Number.isFinite(weight)) {
      continue;
    }

    if (!loggedOnce) {
      console.log("[TableParser] parts sample (end-based):", parts);
      loggedOnce = true;
    }

    const leading = parts.slice(0, -3);
    const slNo = leading[0] ?? null;
    const dc = leading[1] ?? null;
    const date = leading[2] ?? null;
    const gg = leading[3] ?? null;
    const fabric = leading.length >= 8 ? leading.slice(4, -3).join(" ").trim() || null : null;
    const counts = leading[leading.length - 3] ?? null;
    const mill = leading[leading.length - 2] ?? null;
    const dia = leading[leading.length - 1] ?? null;

    rows.push({
      slNo,
      dc,
      date,
      gg,
      fabric,
      counts,
      mill,
      dia,
      weight,
      rate,
      amount
    });
  }

  return rows;
}
