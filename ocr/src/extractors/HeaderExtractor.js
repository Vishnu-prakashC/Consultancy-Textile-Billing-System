/**
 * HeaderExtractor.js — Extract company/sender info from header region text.
 * Company name, GSTIN, TIN, PAN, phone numbers, address. Uses regex patterns.
 */

/**
 * Extract header fields from OCR text of the header region.
 * @param {string} text - Raw OCR text from header region
 * @returns {{ companyName: string|null, gstin: string|null, tin: string|null, pan: string|null, phones: string[], address: string|null }}
 */
export function extractHeader(text) {
  if (!text || typeof text !== "string") {
    return { companyName: null, gstin: null, tin: null, pan: null, phones: [], address: null };
  }

  const t = text.trim();

  // GSTIN: 15-char alphanumeric, pattern 2 digits + 5 alpha + 4 digit + 1 alpha + 3 alphanumeric
  const gstinMatch = t.match(/\b(33[A-Z]{5}\d{4}[A-Z][0-9A-Z]{3}[A-Z0-9])\b/i)
    || t.match(/\b(\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b/i);
  const gstin = gstinMatch ? gstinMatch[1].replace(/\s/g, "") : null;

  // TIN: digits, often near "TIN" or "TIN:"
  const tinMatch = t.match(/TIN\s*[:\-]?\s*(\d{9,15})/i) || t.match(/\b(\d{9,12})\b/);
  const tin = tinMatch ? tinMatch[1].trim() : null;

  // PAN: AAFFF1234F style
  const panMatch = t.match(/PAN\s*[:\-]?\s*([A-Z]{5}\d{4}[A-Z])/i) || t.match(/\b([A-Z]{5}\d{4}[A-Z])\b/);
  const pan = panMatch ? panMatch[1] : null;

  // Phone numbers: 10 digits, optional spaces/dashes
  const phoneMatches = t.match(/\b\d{5}[\s\-]?\d{5}\b/g) || [];
  const phones = phoneMatches.map((p) => p.replace(/\s/g, " ").trim());

  // Company name: often first non-empty line or line containing "NEW GOOD NITS"
  let companyName = null;
  const lines = t.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const goodNitsLine = lines.find((l) => /NEW\s*GOOD\s*NITS|KNITTING\s*INVOICE/i.test(l));
  if (goodNitsLine) {
    companyName = goodNitsLine.replace(/\s+/g, " ").trim();
    if (/^KNITTING\s*INVOICE/i.test(companyName)) {
      const next = lines[lines.indexOf(companyName) + 1];
      if (next && /NEW\s*GOOD/i.test(next)) companyName = next.replace(/\s+/g, " ").trim();
    }
  }
  if (!companyName && lines.length) companyName = lines[0];

  // Address: lines after company name until GSTIN or phones
  let address = null;
  if (companyName) {
    const companyIndex = lines.findIndex(l => l === companyName);
    const remainingLines = lines.slice(companyIndex + 1);
    const addressLines = [];
    for (const line of remainingLines) {
      if (gstin && line.includes(gstin)) break;
      if (phones.some(p => line.includes(p))) break;
      addressLines.push(line);
    }
    if (addressLines.length) address = addressLines.join(", ");
  }

  return {
    companyName,
    gstin,
    tin,
    pan,
    phones,
    address
  };
}
