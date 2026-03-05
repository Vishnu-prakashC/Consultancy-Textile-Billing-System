/**
 * TotalsExtractor.js — Extract subtotal, CGST, SGST, netTotal from totals region text.
 * Numbers from regex; netTotal = last decimal; CGST/SGST from label regex.
 */

export function extractTotals(text) {
  let subtotal = null;
  let cgst = null;
  let sgst = null;
  let netTotal = null;
  let roundedOff = null;

  if (!text || typeof text !== "string") {
    return { subtotal, cgst, sgst, roundedOff, netTotal };
  }

  const numbers = text.match(/[\d,]+\.\d+/g);
  if (numbers && numbers.length) {
    const parsed = numbers.map((n) => parseFloat(n.replace(/,/g, ""))).filter((n) => !isNaN(n) && n < 1e8);
    if (parsed.length) netTotal = parsed[parsed.length - 1];
    if (parsed.length >= 2) subtotal = parsed[parsed.length - 2];
  }

  const cgstMatch = text.match(/CGST.*?([\d,]+\.\d+)/i);
  if (cgstMatch) cgst = parseFloat(cgstMatch[1].replace(/,/g, ""));

  const sgstMatch = text.match(/SGST.*?([\d,]+\.\d+)/i);
  if (sgstMatch) sgst = parseFloat(sgstMatch[1].replace(/,/g, ""));

  const roundedMatch = text.match(/Rounded\s*Off|Round\s*Off.*?([\d,.\-]+)/i);
  if (roundedMatch && roundedMatch[1]) roundedOff = parseFloat(roundedMatch[1].replace(/,/g, ""));

  return { subtotal, cgst, sgst, roundedOff, netTotal };
}
