/**
 * ValidationModule.js — Business logic validation for extracted invoice data.
 * Validates table sum, GST amounts, and net total.
 */

/**
 * Parse numeric string from OCR (handles "20,490.10").
 * @param {string|null} str
 * @returns {number}
 */
function toNumber(str) {
  if (str == null || str === "") return 0;
  return parseFloat(String(str).replace(/,/g, "")) || 0;
}

/**
 * Validate that sum of table row amounts matches subtotal (within ₹1).
 * @param {Array<{ amount: number }>} rows - Parsed table rows
 * @param {string|null} subtotalStr - Subtotal from totals section
 * @returns {boolean}
 */
export function validateTableSum(rows, subtotalStr) {
  const calculated = rows.reduce((sum, r) => sum + (r.amount || 0), 0);
  const subtotal = toNumber(subtotalStr);
  return Math.abs(calculated - subtotal) < 1;
}

/**
 * Validate CGST and SGST are each 2.5% of subtotal (within ₹1).
 * @param {string|null} subtotalStr
 * @param {string|null} cgstStr
 * @param {string|null} sgstStr
 * @returns {boolean}
 */
export function validateGST(subtotalStr, cgstStr, sgstStr) {
  const subtotal = toNumber(subtotalStr);
  const cgst = toNumber(cgstStr);
  const sgst = toNumber(sgstStr);
  const expected = subtotal * 0.025;
  return (
    Math.abs(expected - cgst) < 1 &&
    Math.abs(expected - sgst) < 1
  );
}

/**
 * Validate net total = subtotal + CGST + SGST [+ roundedOff] (within ₹1).
 * @param {string|null} subtotalStr
 * @param {string|null} cgstStr
 * @param {string|null} sgstStr
 * @param {string|null} netStr
 * @param {string|null} [roundedOffStr] - If provided, expected = subtotal + cgst + sgst + roundedOff
 * @returns {boolean}
 */
export function validateNetTotal(subtotalStr, cgstStr, sgstStr, netStr, roundedOffStr = null) {
  const subtotal = toNumber(subtotalStr);
  const cgst = toNumber(cgstStr);
  const sgst = toNumber(sgstStr);
  const net = toNumber(netStr);
  const roundedOff = roundedOffStr != null ? toNumber(roundedOffStr) : 0;
  const expected = subtotal + cgst + sgst + roundedOff;
  return Math.abs(expected - net) < 1;
}
